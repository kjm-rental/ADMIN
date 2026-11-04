-- OWNER REVIEW ONLY. Do not execute automatically.
-- KJM ADMIN only. Reuses existing units, statuses, admin auth, locks and RLS.
-- Applying this file changes functions/triggers only: it removes/deactivates no
-- existing units and modifies no bookings, prices, colors, plates or payments.
begin;

-- Lock all referencing tables in a stable order before checking dependencies.
-- This also protects CASCADE/SET NULL relationships and deferred FKs. NOWAIT
-- fails safely instead of deadlocking with an in-flight booking transaction.
create function private.lock_motorcycle_unit_relationships() returns void
language plpgsql security definer set search_path='' as $$
declare child record;
begin
  for child in
    select distinct c.conrelid from pg_catalog.pg_constraint c
    where c.contype='f' and c.confrelid='public.motorcycle_units'::regclass
    order by c.conrelid
  loop
    execute format('lock table %s in share row exclusive mode nowait',child.conrelid::regclass);
  end loop;
  lock table public.audit_logs in share row exclusive mode nowait;
end;$$;
revoke all on function private.lock_motorcycle_unit_relationships() from public,anon,authenticated,service_role;

-- Any FK reference is history, even an expired/released hold or maintenance
-- record. Booking children (inspections/payments/history) are preserved through
-- their booking's reference. Never delete dependent rows to make deletion work.
create function private.motorcycle_unit_has_history(p_unit uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare fk record; predicate text; has_history boolean;
begin
  for fk in select c.conrelid,c.conkey,c.confkey
    from pg_catalog.pg_constraint c
    where c.contype='f' and c.confrelid='public.motorcycle_units'::regclass
    order by c.conrelid,c.oid
  loop
    select string_agg(format('child.%I = unit.%I',ca.attname,pa.attname),' and ' order by k.ordinality)
      into predicate
      from unnest(fk.conkey,fk.confkey) with ordinality as k(child_key,parent_key,ordinality)
      join pg_catalog.pg_attribute ca on ca.attrelid=fk.conrelid and ca.attnum=k.child_key
      join pg_catalog.pg_attribute pa on pa.attrelid='public.motorcycle_units'::regclass and pa.attnum=k.parent_key;
    execute format('select exists(select 1 from %s child join public.motorcycle_units unit on %s where unit.id=$1)',fk.conrelid::regclass,predicate)
      into has_history using p_unit;
    if has_history then return true;end if;
  end loop;
  -- Historical reassignment can leave the original unit only in booking audit
  -- metadata. Unit CRUD audit entries remain as audit history after removal;
  -- they alone do not make a never-booked unit impossible to remove.
  return exists(select 1 from public.audit_logs a where
    a.action like 'booking.%' and (
      a.metadata->>'unit_id'=p_unit::text or a.metadata->>'motorcycle_unit_id'=p_unit::text
      or a.metadata->>'old_unit'=p_unit::text or a.metadata->>'unit'=p_unit::text));
end;$$;
revoke all on function private.motorcycle_unit_has_history(uuid) from public,anon,authenticated,service_role;

create function private.motorcycle_unit_has_commitments(p_unit uuid,p_model uuid) returns boolean
language sql volatile security definer set search_path='' as $$
  select exists(select 1 from public.bookings b
    where b.motorcycle_unit_id=p_unit and b.status in ('submitted','pending','confirmed','active'))
  or exists(select 1 from public.booking_inventory_holds h
    where h.motorcycle_unit_id=p_unit and h.released_at is null and h.converted_at is null and h.expires_at>now())
  -- Preserve unassigned model-level demand without a live hold as well.
  or exists(select 1 from public.bookings b
    where b.motorcycle_model_id=p_model and b.motorcycle_unit_id is null and b.status in ('submitted','pending')
    and not exists(select 1 from public.booking_inventory_holds h where h.booking_id=b.id
      and h.released_at is null and h.converted_at is null and h.expires_at>now()));
$$;
revoke all on function private.motorcycle_unit_has_commitments(uuid,uuid) from public,anon,authenticated,service_role;

-- Defense in depth for direct administrator table writes, not only the RPC.
-- Try the existing model/unit locks because a direct write already owns a row
-- lock; waiting here could invert the booking engine's model -> unit order.
create function private.guard_motorcycle_unit_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.status is not distinct from old.status or new.status not in ('inactive','available') then return new;end if;
  end if;
  if not private.is_active_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
  if not pg_try_advisory_xact_lock(hashtextextended(old.motorcycle_model_id::text,0))
    or not pg_try_advisory_xact_lock(hashtextextended(old.id::text,0)) then
    raise exception 'Inventory is busy. Refresh and retry' using errcode='55P03';
  end if;
  perform private.lock_motorcycle_unit_relationships();
  if tg_op='DELETE' then
    if private.motorcycle_unit_has_history(old.id)
      or old.status in ('reserved','rented')
      or private.motorcycle_unit_has_commitments(old.id,old.motorcycle_model_id) then
      raise exception 'This motorcycle cannot be permanently deleted because it has booking or operational history. You can deactivate it instead.' using errcode='23503';
    end if;
    return old;
  end if;
  if new.status='inactive' and (old.status in ('reserved','rented')
    or private.motorcycle_unit_has_commitments(old.id,old.motorcycle_model_id)) then
    raise exception 'Resolve existing reservations, live holds and active rentals before deactivating this motorcycle' using errcode='23514';
  end if;
  return new;
end;$$;
revoke all on function private.guard_motorcycle_unit_lifecycle() from public,anon,authenticated,service_role;
create trigger motorcycle_units_guard_lifecycle before delete or update of status on public.motorcycle_units
for each row execute function private.guard_motorcycle_unit_lifecycle();

create function public.admin_manage_motorcycle_unit(p_model_id uuid,p_unit_id uuid,p_operation text,p_expected_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.motorcycle_units%rowtype; target_status text;
begin
  if auth.uid() is null or not private.is_active_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_operation is null or p_operation not in ('remove','deactivate','reactivate')
    or p_model_id is null or p_unit_id is null or p_expected_status is null then
    raise exception 'Invalid unit operation' using errcode='22023';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_model_id::text,0))
    or not pg_try_advisory_xact_lock(hashtextextended(p_unit_id::text,0)) then
    raise exception 'Inventory is busy. Refresh and retry' using errcode='55P03';
  end if;
  select * into u from public.motorcycle_units where id=p_unit_id and motorcycle_model_id=p_model_id and archived_at is null for update nowait;
  if not found then return jsonb_build_object('outcome','not_found');end if;
  if u.status is distinct from p_expected_status then return jsonb_build_object('outcome','stale');end if;
  perform private.lock_motorcycle_unit_relationships();
  if p_operation='remove' then
    if private.motorcycle_unit_has_history(u.id) or u.status in ('reserved','rented')
      or private.motorcycle_unit_has_commitments(u.id,u.motorcycle_model_id) then
      return jsonb_build_object('outcome','history');
    end if;
    delete from public.motorcycle_units where id=u.id;
  else
    if (p_operation='reactivate' and u.status<>'inactive') or (p_operation='deactivate' and u.status='inactive') then
      return jsonb_build_object('outcome','stale');
    end if;
    if p_operation='reactivate' and not exists(select 1 from public.motorcycle_models where id=u.motorcycle_model_id and archived_at is null) then
      return jsonb_build_object('outcome','not_found');
    end if;
    if p_operation='deactivate' and (u.status in ('reserved','rented') or private.motorcycle_unit_has_commitments(u.id,u.motorcycle_model_id)) then
      return jsonb_build_object('outcome','blocked');
    end if;
    target_status:=case p_operation when 'deactivate' then 'inactive' else 'available' end;
    update public.motorcycle_units set status=target_status where id=u.id;
  end if;
  -- Audit and mutation commit together. An audit failure rolls back the change.
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),case p_operation when 'remove' then 'unit.removed' when 'deactivate' then 'unit.deactivated' else 'unit.reactivated' end,
    'motorcycle_units',u.id,jsonb_build_object('motorcycle_model_id',u.motorcycle_model_id,'old_status',u.status,'new_status',target_status));
  return jsonb_build_object('outcome',case p_operation when 'remove' then 'removed' when 'deactivate' then 'deactivated' else 'reactivated' end);
end;$$;
revoke all on function public.admin_manage_motorcycle_unit(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_motorcycle_unit(uuid,uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
