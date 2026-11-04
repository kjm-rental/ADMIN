-- PREPARED FOR REVIEW ONLY. DO NOT EXECUTE AUTOMATICALLY.
-- Requires the shared schema through 038. Canonical migration owner remains KJM MAIN.
-- No production data, prices, settings, public routes or payment providers are changed.
begin;

alter table public.bookings add column manual_adjustment_php integer not null default 0;
alter table public.bookings drop constraint bookings_total_components_check;
alter table public.bookings add constraint bookings_total_components_check
 check(quoted_total_php=base_total_php+extras_total_php+services_total_php+manual_adjustment_php);
-- Existing pricing and generated centavo columns stay unchanged. Adjustments use whole PHP.
alter table public.booking_extras_catalog add column if not exists compatible_model_ids uuid[] not null default '{}';

create table public.booking_admin_details (
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 created_by uuid not null references auth.users(id), source text not null check(source in ('whatsapp','phone','walk_in','other')),
 internal_notes text not null check(length(internal_notes)<=2000), adjustment jsonb not null,
 confirmation_reason text not null default '', revision integer not null default 1,
 created_at timestamptz not null default now()
);
create table public.admin_booking_requests (
 request_id uuid primary key, actor uuid not null references auth.users(id), fingerprint text not null,
 booking_id uuid not null references public.bookings(id), created_at timestamptz not null default now()
);
alter table public.booking_admin_details enable row level security;
alter table public.booking_admin_details force row level security;
alter table public.admin_booking_requests enable row level security;
alter table public.admin_booking_requests force row level security;
revoke all on public.booking_admin_details,public.admin_booking_requests from public,anon,authenticated;
grant select on public.booking_admin_details to authenticated;
create policy booking_admin_details_read on public.booking_admin_details for select to authenticated using((select private.is_active_admin()));

-- Extend the existing extras calculator with an exclusion for an edited booking.
-- The original five-argument entry point delegates unchanged for all public callers.
create or replace function private.calculate_extra_selection(
  p_items jsonb,p_start_at timestamptz,p_end_at timestamptz,p_pricing_units integer,p_lock boolean,p_exclude_booking uuid
) returns table(extra_id uuid,name text,price_php integer,pricing_model text,quantity integer,charged_units integer,line_total_php integer)
language plpgsql security definer set search_path='' as $$
declare item jsonb; requested_id uuid; requested_quantity integer; extra public.booking_extras_catalog%rowtype; reserved integer;
begin
  if p_items is null then p_items:='[]'::jsonb; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>20 then raise exception 'Invalid extras selection'; end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct value->>'id') from jsonb_array_elements(p_items)) then raise exception 'Duplicate extras are not allowed'; end if;
  for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    requested_id:=(item->>'id')::uuid; requested_quantity:=(item->>'quantity')::integer;
    if p_lock then select * into extra from public.booking_extras_catalog e where e.id=requested_id for update;
    else select * into extra from public.booking_extras_catalog e where e.id=requested_id; end if;
    if extra.id is null or not extra.is_active or not extra.is_available then raise exception 'A selected extra is unavailable'; end if;
    if requested_quantity is null or requested_quantity<1 or requested_quantity>extra.max_per_booking then raise exception 'Selected extra quantity exceeds its booking limit'; end if;
    select coalesce(sum(lines.quantity),0)::integer into reserved
    from public.booking_extra_items lines join public.bookings booking on booking.id=lines.booking_id
    where lines.extra_id=requested_id and booking.id is distinct from p_exclude_booking and booking.status in ('pending','confirmed','active')
      and tstzrange(booking.start_at,booking.end_at,'[)')&&tstzrange(p_start_at,p_end_at,'[)');
    if reserved+requested_quantity>extra.total_quantity then raise exception 'A selected extra has insufficient inventory'; end if;
    extra_id:=extra.id; name:=extra.name; price_php:=extra.price_php; pricing_model:=extra.pricing_model;
    quantity:=requested_quantity; charged_units:=case when extra.pricing_model='per_day' then p_pricing_units else 1 end;
    line_total_php:=extra.price_php*quantity*charged_units; return next;
  end loop;
end; $$;
revoke all on function private.calculate_extra_selection(jsonb,timestamptz,timestamptz,integer,boolean,uuid) from public,anon,authenticated,service_role;
create or replace function private.calculate_extra_selection(p_items jsonb,p_start_at timestamptz,p_end_at timestamptz,p_pricing_units integer,p_lock boolean default false)
returns table(extra_id uuid,name text,price_php integer,pricing_model text,quantity integer,charged_units integer,line_total_php integer)
language sql security definer set search_path='' as $$
 select * from private.calculate_extra_selection(p_items,p_start_at,p_end_at,p_pricing_units,p_lock,null);
$$;

create function private.manual_booking_units(p_model uuid,p_start timestamptz,p_end timestamptz,p_exclude uuid)
returns table(id uuid,code text,plate text) language sql stable security definer set search_path='' as $$
 select u.id,u.internal_unit_code,u.registration_plate from public.motorcycle_units u
 where u.motorcycle_model_id=p_model and u.status='available' and u.archived_at is null
 and not exists(select 1 from public.bookings b where b.id is distinct from p_exclude and b.motorcycle_unit_id=u.id and b.status in ('pending','confirmed','active') and tstzrange(b.start_at,b.end_at,'[)')&&tstzrange(p_start,p_end,'[)'))
 and not exists(select 1 from public.booking_inventory_holds h where h.booking_id is distinct from p_exclude and h.motorcycle_unit_id=u.id and h.released_at is null and h.converted_at is null and h.expires_at>now() and tstzrange(h.start_at,h.end_at,'[)')&&tstzrange(p_start,p_end,'[)'))
 and not exists(select 1 from public.motorcycle_unavailability x where x.motorcycle_unit_id=u.id and tstzrange(x.start_at,x.end_at,'[)')&&tstzrange(p_start,p_end,'[)')) order by u.internal_unit_code;
$$;
revoke all on function private.manual_booking_units(uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated,service_role;

create function public.admin_quote_manual_booking(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare model uuid:=(p_payload->>'modelId')::uuid; bid uuid:=(p_payload->>'bookingId')::uuid;
 starts timestamptz:=(p_payload->>'startAt')::timestamptz; ends timestamptz:=(p_payload->>'endAt')::timestamptz;
 q record; ds public.security_deposit_settings%rowtype; b public.bookings%rowtype;
 extra integer; service jsonb; standard integer; final integer; kind text:=p_payload->'adjustment'->>'kind'; value numeric:=(p_payload->'adjustment'->>'value')::numeric;
 result jsonb; policy timestamptz;
begin
 if not private.is_active_admin() then raise exception 'Administrator access required';end if;
 if p_payload is null or octet_length(p_payload::text)>40000 or starts is null or ends is null or starts<=now() or ends-starts<interval '24 hours' then raise exception 'Choose a future rental period of at least 24 hours';end if;
 if bid is not null then
  select * into b from public.bookings where id=bid;
  if not exists(select 1 from public.booking_admin_details where booking_id=bid) or b.status not in ('pending','confirmed') or (b.status='pending' and b.expires_at<=now()) then raise exception 'Only unexpired pending or confirmed admin bookings can be edited';end if;
  if exists(select 1 from public.payment_events where booking_id=bid) or exists(select 1 from public.payment_intents where booking_id=bid) or exists(select 1 from public.security_deposit_events where booking_id=bid) or exists(select 1 from public.rental_inspections where booking_id=bid) then raise exception 'Financial or handover history exists. Use the existing authorized adjustment workflow';end if;
 end if;
 select * into q from private.calculate_booking_quote(model,starts,ends,false);
 if exists(select 1 from jsonb_array_elements(p_payload->'extras') item join public.booking_extras_catalog e on e.id=(item->>'id')::uuid where (e.name ~* 'top[ _-]*box' or cardinality(e.compatible_model_ids)>0) and not (model=any(e.compatible_model_ids))) then raise exception 'Selected accessory is not configured as compatible with this motorcycle';end if;
 select coalesce(sum(x.line_total_php),0)::integer into extra from private.calculate_extra_selection(p_payload->'extras',starts,ends,q.pricing_units,false,bid) x;
 service:=public.get_delivery_quote(p_payload->'services',starts,ends);
 select * into ds from public.security_deposit_settings where id;
 if not coalesce(ds.cash_enabled and ds.cash_policy_approved_at is not null and ds.cash_amount_centavos=250000,false) then raise exception 'An approved separate PHP 2,500 cash security deposit policy is required';end if;
 if not exists(select 1 from public.delivery_settings where id and cash_enabled) then raise exception 'Cash booking arrangements are currently disabled';end if;
 standard:=q.total_php+extra+(service->>'totalCentavos')::integer/100;
 if kind is null or kind not in ('none','fixed','percentage','agreed') or value is null or value<0 or value>10000000 or (kind='percentage' and (value>100 or round(value,2)<>value)) or (kind<>'percentage' and value<>trunc(value)) then raise exception 'Invalid price adjustment';end if;
 if kind<>'none' and length(trim(coalesce(p_payload->'adjustment'->>'reason',''))) not between 5 and 500 then raise exception 'A price adjustment reason is required';end if;
 final:=case kind when 'none' then standard when 'fixed' then standard-value::integer when 'percentage' then round(standard*(1-value/100))::integer else value::integer end;
 if final<0 then raise exception 'Final rental amount cannot be negative';end if;
 policy:=case when bid is null then ds.updated_at else (select policy_version from public.booking_deposits where booking_id=bid) end;
 result:=jsonb_build_object('base',q.total_php,'extras',extra,'services',(service->>'totalCentavos')::integer/100,'standard',standard,'adjustment',final-standard,'final',final,'deposit',2500,'policyVersion',policy,'pricing',private.hourly_rental_breakdown(model,starts,ends,false),'delivery',service);
 result:=result||jsonb_build_object('token',encode(sha256(convert_to(result::text,'UTF8')),'hex'));
 return result||jsonb_build_object('units',coalesce((select jsonb_agg(to_jsonb(u)) from private.manual_booking_units(model,starts,ends,bid) u),'[]'::jsonb));
end;$$;
revoke all on function public.admin_quote_manual_booking(jsonb) from public,anon,service_role;
grant execute on function public.admin_quote_manual_booking(jsonb) to authenticated;

-- Explicit reservation authorization; it never approves identity or licenses.
-- The existing guard recognizes a confirmation record but still requires full verification at handover.
create function private.confirm_manual_booking(p_booking uuid,p_unit uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
 if not private.is_active_admin() or length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'Administrator confirmation reason required';end if;
 select * into b from public.bookings where id=p_booking for update;
 if b.id is null or not exists(select 1 from public.booking_admin_details where booking_id=b.id) or b.status<>'pending' or b.expires_at<=now() then raise exception 'Unexpired pending admin booking required';end if;
 perform pg_advisory_xact_lock(hashtextextended(b.motorcycle_model_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_unit::text,0));
 if not exists(select 1 from private.manual_booking_units(b.motorcycle_model_id,b.start_at,b.end_at,b.id) where id=p_unit) then raise exception 'Selected motorcycle is no longer available';end if;
 insert into public.booking_confirmation_records(booking_id,motorcycle_unit_id,auth_user_id) values(b.id,p_unit,auth.uid());
 update public.bookings set status='confirmed',motorcycle_unit_id=p_unit,approved_by=auth.uid(),expires_at=null where id=b.id;
 update public.booking_inventory_holds set converted_at=now() where booking_id=b.id and released_at is null and converted_at is null;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by) values(b.id,b.status,'confirmed',auth.uid());
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'booking.manual_confirmed','booking',b.id,jsonb_build_object('reason',p_reason,'verification_pending',true,'unit_id',p_unit));
end;$$;
revoke all on function private.confirm_manual_booking(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Keep normal confirmations unchanged. Manual reservations use the audited workflow above.
alter function public.admin_confirm_booking(uuid,uuid) rename to admin_confirm_booking_before_manual;
revoke all on function public.admin_confirm_booking_before_manual(uuid,uuid) from public,anon,authenticated,service_role;
create function public.admin_confirm_booking(p_booking_id uuid,p_unit_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_admin() then raise exception 'Administrator access required';end if;
 if exists(select 1 from public.booking_admin_details where booking_id=p_booking_id) then
  raise exception 'Use Edit admin booking to record an explicit reservation confirmation reason';
 end if;
 perform public.admin_confirm_booking_before_manual(p_booking_id,p_unit_id);
end;$$;
revoke all on function public.admin_confirm_booking(uuid,uuid) from public,anon,service_role;
grant execute on function public.admin_confirm_booking(uuid,uuid) to authenticated;

-- Only the transactionally guarded manual editor can replace service/contact snapshots.
-- No new table write grants are given; public guest snapshots remain immutable.
create function private.guard_manual_snapshot_edit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_admin() or not exists(select 1 from public.booking_admin_details a join public.bookings b on b.id=a.booking_id where b.id=old.booking_id and b.status in ('pending','confirmed'))
 or exists(select 1 from public.payment_intents where booking_id=old.booking_id) or exists(select 1 from public.payment_events where booking_id=old.booking_id) or exists(select 1 from public.security_deposit_events where booking_id=old.booking_id) or exists(select 1 from public.rental_inspections where booking_id=old.booking_id) then raise exception 'Snapshot is immutable outside eligible admin booking edits';end if;
 if tg_op='DELETE' then return old;end if;
 if new.booking_id<>old.booking_id then raise exception 'Booking identity is immutable';end if;
 return new;
end;$$;
revoke all on function private.guard_manual_snapshot_edit() from public,anon,authenticated,service_role;
drop trigger booking_services_immutable on public.booking_services;
create trigger booking_services_immutable before update or delete on public.booking_services for each row execute function private.guard_manual_snapshot_edit();
drop trigger guest_booking_contact_immutable on public.guest_booking_contacts;
create trigger guest_booking_contact_immutable before update or delete on public.guest_booking_contacts for each row execute function private.guard_manual_snapshot_edit();

create function private.manual_phone_key(p_phone text) returns text language sql immutable set search_path='' as $$
 select case when length(digits)=11 and left(digits,1)='0' then '63'||substr(digits,2) else digits end from (select regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') digits) q;
$$;
revoke all on function private.manual_phone_key(text) from public,anon,authenticated,service_role;

create function public.admin_save_manual_booking(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p_payload->>'requestId')::uuid; bid uuid:=(p_payload->>'bookingId')::uuid; cid uuid:=(p_payload->>'customerId')::uuid;
 model uuid:=(p_payload->>'modelId')::uuid; unit uuid:=(p_payload->>'unitId')::uuid;
 starts timestamptz:=(p_payload->>'startAt')::timestamptz; ends timestamptz:=(p_payload->>'endAt')::timestamptz;
 v_email text:=nullif(lower(trim(p_payload->>'email')),''); v_phone text:=trim(p_payload->>'phone'); fullname text:=trim(p_payload->>'fullName');
 kind text:=p_payload->>'customerType'; v_source text:=p_payload->>'source'; requested text:=p_payload->>'action';
 fingerprint text:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'); old_req public.admin_booking_requests%rowtype;
 b public.bookings%rowtype; ds public.security_deposit_settings%rowtype; bs public.booking_settings%rowtype;
 q jsonb; svc jsonb; line record; ref text; fresh boolean:=bid is null; actual_revision integer; matches integer; old_full_name text;
begin
 if not private.is_active_admin() then raise exception 'Administrator access required';end if;
 if req is null or unit is null or model is null or fullname is null or length(fullname) not between 2 and 160 or v_phone is null or v_phone !~ '^\+?[0-9][0-9[:space:]()-]{6,24}$' or (v_email is not null and (length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
 or kind is null or kind not in ('philippine_resident','international_visitor') or v_source is null or v_source not in ('whatsapp','phone','walk_in','other') or requested is null or requested not in ('pending','confirmed') or length(coalesce(p_payload->>'notes',''))>2000 then raise exception 'Check the customer, booking source and rental information';end if;
 if requested='confirmed' and length(trim(coalesce(p_payload->>'confirmationReason',''))) not between 5 and 500 then raise exception 'Explicit reservation confirmation reason required';end if;
 perform pg_advisory_xact_lock(hashtextextended(req::text,39));
 select * into old_req from public.admin_booking_requests where request_id=req;
 if found then
  if old_req.actor<>auth.uid() or old_req.fingerprint<>fingerprint then raise exception 'Request key was reused with different details';end if;
  return jsonb_build_object('bookingId',old_req.booking_id);
 end if;
 if not fresh then
  select * into b from public.bookings where id=bid for update;
  select revision into actual_revision from public.booking_admin_details where booking_id=bid for update;
  if actual_revision is null or actual_revision is distinct from (p_payload->>'revision')::integer then raise exception 'Booking changed. Reload before editing';end if;
  if cid is distinct from b.customer_id then raise exception 'Customer reassignment is unavailable; edit the current customer contact details';end if;
  if b.status='confirmed' and requested<>'confirmed' then raise exception 'A confirmed booking cannot be downgraded to pending';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(model::text,0));
 perform pg_advisory_xact_lock(hashtextextended(unit::text,0));
 perform 1 from public.motorcycle_units where id=unit for update;
 update public.booking_inventory_holds set released_at=now() where motorcycle_unit_id=unit and released_at is null and converted_at is null and expires_at<=now();
 -- Lock accessories in canonical order, then recompute quote and availability in the same transaction.
 perform 1 from private.calculate_extra_selection(p_payload->'extras',starts,ends,1,true,bid);
 select * into ds from public.security_deposit_settings where id for share;
 select * into bs from public.booking_settings where id for share;
 q:=public.admin_quote_manual_booking(p_payload);
 if q->>'token' is distinct from p_payload->>'quoteToken' or (q->>'final')::integer is distinct from (p_payload->>'expectedTotal')::integer then raise exception 'Price or policy changed. Review a fresh quote';end if;
 if not exists(select 1 from private.manual_booking_units(model,starts,ends,bid) where id=unit) then raise exception 'Selected motorcycle is no longer available';end if;
 select * into ds from public.security_deposit_settings where id for share;
 select * into bs from public.booking_settings where id for share;
 if bs.pending_hold_minutes is null or bs.pending_expiration_minutes is null or bs.pending_hold_minutes<=0 or bs.pending_expiration_minutes<=0 then raise exception 'Pending expiration and inventory hold policies must be configured';end if;
 -- Serialize normalized phone matching. Never silently merge ambiguous customer records.
 perform pg_advisory_xact_lock(hashtextextended(private.manual_phone_key(v_phone),39));
 if v_email is not null then perform pg_advisory_xact_lock(hashtextextended(v_email,39));end if;
 if cid is null then
  select count(*),(array_agg(id))[1] into matches,cid from public.customers where auth_user_id is null and (private.manual_phone_key(customers.phone)=private.manual_phone_key(v_phone) or (v_email is not null and lower(trim(customers.email))=v_email));
  if matches>1 then raise exception 'Multiple customers match this phone. Select the correct existing customer';end if;
  if cid is not null and not exists(select 1 from public.customers where id=cid and lower(trim(full_name))=lower(fullname)) then raise exception 'This phone belongs to an existing customer. Search and select the correct customer';end if;
 end if;
 if cid is not null and not exists(select 1 from public.customers where id=cid and auth_user_id is null) then raise exception 'Select an existing guest customer';end if;
 if cid is not null then
  select full_name into old_full_name from public.customers where id=cid for update;
  if old_full_name is distinct from fullname and (exists(select 1 from public.bookings where customer_id=cid and id is distinct from bid) or exists(select 1 from public.customer_verifications v join public.verification_reviews r on r.verification_id=v.id where v.customer_id=cid and r.result='approved')) then raise exception 'This customer name is bound to other reservations or approved evidence. Use an authorized identity correction before renaming';end if;
 end if;
 if cid is null then
  insert into public.customers(full_name,phone,email,customer_type) values(fullname,v_phone,v_email,kind) returning id into cid;
 else
  -- An edit cannot change another reservation's notification binding (it has its own immutable snapshot).
  update public.customers set full_name=fullname,phone=v_phone,email=v_email,customer_type=kind where id=cid;
 end if;
 if fresh then
  ref:='KJM-'||to_char(now() at time zone 'Asia/Manila','YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.bookings(booking_reference,customer_id,motorcycle_model_id,start_at,end_at,status,quoted_total_php,base_total_php,extras_total_php,services_total_php,manual_adjustment_php,pricing_daily_rate_php,pricing_units,submitted_at,expires_at,idempotency_key,deposit_required_centavos)
  values(ref,cid,model,starts,ends,'pending',(q->>'final')::integer,(q->>'base')::integer,(q->>'extras')::integer,(q->>'services')::integer,(q->>'adjustment')::integer,(q->'pricing'->>'dailyRatePhp')::integer,(q->'pricing'->>'pricingUnits')::integer,now(),now()+make_interval(mins=>bs.pending_expiration_minutes),req,250000) returning id into bid;
  insert into public.booking_admin_details(booking_id,created_by,source,internal_notes,adjustment,confirmation_reason) values(bid,auth.uid(),v_source,coalesce(p_payload->>'notes',''),p_payload->'adjustment',coalesce(p_payload->>'confirmationReason',''));
  insert into public.customer_verifications(booking_id,customer_id,customer_type,identity_status,license_status,entitlement_status,international_status,overall_status)
  values(bid,cid,kind,'submitted','submitted','under_review',case when kind='international_visitor' then 'under_review' else 'not_applicable' end,'submitted');
  insert into public.booking_deposits(booking_id,option,required_centavos,partial_return_allowed,collection_instructions,return_instructions,dispute_instructions,policy_version,request_fingerprint,is_test)
  values(bid,'cash',250000,ds.partial_cash_return_allowed,ds.collection_instructions,ds.return_instructions,ds.dispute_instructions,ds.updated_at,fingerprint,(select is_test from public.bookings where id=bid));
  insert into public.booking_inventory_holds(booking_id,motorcycle_unit_id,start_at,end_at,expires_at) values(bid,unit,starts,ends,least(now()+make_interval(mins=>bs.pending_hold_minutes),now()+make_interval(mins=>bs.pending_expiration_minutes)));
  insert into public.booking_status_history(booking_id,old_status,new_status,changed_by) values(bid,null,'pending',auth.uid());
 else
  if exists(select 1 from public.customer_verifications where booking_id=bid and customer_type is distinct from kind) then raise exception 'Customer residency type cannot change after creation; use verification review';end if;
  delete from public.booking_services where booking_id=bid;
  update public.bookings set motorcycle_model_id=model,motorcycle_unit_id=case when b.status='confirmed' then unit else null end,start_at=starts,end_at=ends,quoted_total_php=(q->>'final')::integer,base_total_php=(q->>'base')::integer,extras_total_php=(q->>'extras')::integer,services_total_php=(q->>'services')::integer,manual_adjustment_php=(q->>'adjustment')::integer,pricing_daily_rate_php=(q->'pricing'->>'dailyRatePhp')::integer,pricing_units=(q->'pricing'->>'pricingUnits')::integer where id=bid;
  if b.motorcycle_model_id is distinct from model then
   update public.customer_verifications set entitlement_status='under_review',overall_status='under_review',reviewed_by=null,reviewed_at=null where booking_id=bid;
   insert into public.audit_logs(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'verification.model_change_review_required','booking',bid);
  end if;
  if b.status='pending' then
   -- Editing does not extend the original hold or expiration.
   update public.booking_inventory_holds set motorcycle_unit_id=unit,start_at=starts,end_at=ends where booking_id=bid and released_at is null and converted_at is null and expires_at>now();
   if not found then raise exception 'Pending inventory hold expired; create a fresh reservation';end if;
  end if;
  update public.booking_admin_details set source=v_source,internal_notes=coalesce(p_payload->>'notes',''),adjustment=p_payload->'adjustment',confirmation_reason=coalesce(p_payload->>'confirmationReason',''),revision=revision+1 where booking_id=bid;
  delete from public.booking_extra_items where booking_id=bid;
 end if;
 -- Reuse guest recipient binding with an unissued random hash. No account, password or public access token is created.
 if v_email is null then delete from public.guest_booking_contacts where booking_id=bid;
 else
  insert into public.guest_booking_contacts(booking_id,access_hash,email,request_fingerprint) values(bid,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),v_email,fingerprint)
  on conflict(booking_id) do update set email=excluded.email,request_fingerprint=excluded.request_fingerprint;
 end if;
 svc:=q->'delivery';
 insert into public.booking_services(booking_id,delivery_area_id,collection_area_id,delivery,collection,delivery_fee_centavos,collection_fee_centavos,payment_method)
 values(bid,(p_payload->'services'->'delivery'->>'areaId')::uuid,(p_payload->'services'->'collection'->>'areaId')::uuid,nullif(svc->'delivery','null'),nullif(svc->'collection','null'),(svc->>'deliveryFeeCentavos')::integer,(svc->>'collectionFeeCentavos')::integer,'cash');
 for line in select * from private.calculate_extra_selection(p_payload->'extras',starts,ends,(q->'pricing'->>'pricingUnits')::integer,false,bid) loop
  insert into public.booking_extra_items(booking_id,extra_id,name_snapshot,price_php_snapshot,quantity,pricing_model_snapshot,charged_units,line_total_centavos) values(bid,line.extra_id,line.name,line.price_php,line.quantity,line.pricing_model,line.charged_units,line.line_total_php*100);
 end loop;
 if requested='confirmed' and (fresh or b.status='pending') then perform private.confirm_manual_booking(bid,unit,p_payload->>'confirmationReason');end if;
 -- Customer emails are skipped naturally when no guest binding/email exists. Staff events remain intact.
 begin
 perform private.enqueue_kjm_notification(bid,case when fresh then 'booking_requested' else 'booking_modified' end,case when fresh then 'request:'||bid else 'manual-edit:'||req end);
 exception when others then
 insert into public.notification_generation_errors(booking_id,source,sql_state,event_type,staff_only) values(bid,'manual_booking',sqlstate,'booking_requested',false);
 end;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when fresh then 'booking.manual_created' else 'booking.manual_edited' end,'booking',bid,jsonb_build_object('source',v_source,'standard_php',q->'standard','adjustment',p_payload->'adjustment','final_php',q->'final','old_start',b.start_at,'old_end',b.end_at,'new_start',starts,'new_end',ends,'old_model',b.motorcycle_model_id,'model',model,'old_unit',b.motorcycle_unit_id,'unit',unit,'request_id',req));
 insert into public.admin_booking_requests(request_id,actor,fingerprint,booking_id) values(req,auth.uid(),fingerprint,bid);
 return jsonb_build_object('bookingId',bid);
end;$$;
revoke all on function public.admin_save_manual_booking(jsonb) from public,anon,service_role;
grant execute on function public.admin_save_manual_booking(jsonb) to authenticated;

-- New private uploads are restricted to an eligible manual reservation and existing namespace.
create policy identity_documents_manual_admin_insert on storage.objects for insert to authenticated with check(
 bucket_id='identity-verification' and (select private.is_active_admin()) and array_length(storage.foldername(name),1)=2
 and (storage.foldername(name))[1]='guest' and exists(select 1 from public.bookings b join public.booking_admin_details a on a.booking_id=b.id
 join public.customer_verifications v on v.booking_id=b.id where b.id::text=(storage.foldername(name))[2] and b.status in ('pending','confirmed')
 and (b.status='confirmed' or b.expires_at>now()) and v.overall_status not in ('approved','rejected'))
);
create function public.admin_register_manual_document(p_booking uuid,p_kind text,p_path text,p_mime text,p_size integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;v public.customer_verifications%rowtype;category text;result uuid;
begin
 if not private.is_active_admin() then raise exception 'Administrator access required';end if;
 select * into b from public.bookings where id=p_booking for update;
 select * into v from public.customer_verifications where booking_id=p_booking for update;
 if not exists(select 1 from public.booking_admin_details where booking_id=p_booking) or b.status not in ('pending','confirmed') or (b.status='pending' and b.expires_at<=now()) or v.overall_status in ('approved','rejected') then raise exception 'Document uploads are unavailable for this booking';end if;
 category:=case when p_kind in ('government_id','passport') then 'identity' when p_kind in ('drivers_license_front','drivers_license_back') then 'license' when p_kind='international_driving_permit' then 'international' when p_kind='supporting_document' then 'entitlement' end;
 if category is null or p_path not like 'guest/'||p_booking::text||'/%' or p_size not between 1 and 8388608 or p_mime not in ('image/jpeg','image/png','image/webp','image/avif','application/pdf') or not exists(select 1 from storage.objects where bucket_id='identity-verification' and name=p_path and metadata->>'mimetype'=p_mime and (metadata->>'size')::integer=p_size) then raise exception 'Invalid private document';end if;
 if (case category when 'identity' then v.identity_status when 'license' then v.license_status when 'international' then v.international_status else v.entitlement_status end) in ('approved','rejected','not_applicable') then raise exception 'Request a correction through verification review before replacing this category';end if;
 update public.verification_documents set replaced_at=now() where booking_id=p_booking and document_kind=p_kind and replaced_at is null;
 insert into public.verification_documents(verification_id,booking_id,owner_user_id,document_kind,storage_path,mime_type,size_bytes) values(v.id,p_booking,null,p_kind,p_path,p_mime,p_size) returning id into result;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'verification.manual_uploaded','customer_verification',v.id,jsonb_build_object('document_id',result,'document_kind',p_kind));
 return result;
end;$$;
revoke all on function public.admin_register_manual_document(uuid,text,text,text,integer) from public,anon,service_role;
grant execute on function public.admin_register_manual_document(uuid,text,text,text,integer) to authenticated;
-- Delay only manual request events until services/contact snapshots exist in the save transaction.
alter function private.enqueue_kjm_notification(uuid,text,text,integer,boolean) rename to enqueue_kjm_notification_before_manual;
revoke all on function private.enqueue_kjm_notification_before_manual(uuid,text,text,integer,boolean) from public,anon,authenticated,service_role;
create function private.enqueue_kjm_notification(p_booking uuid,p_event text,p_key text,p_amount integer default null,p_staff_only boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_event='booking_requested' and exists(select 1 from public.booking_admin_details where booking_id=p_booking) and not exists(select 1 from public.booking_services where booking_id=p_booking) then return;end if;
 perform private.enqueue_kjm_notification_before_manual(p_booking,p_event,p_key,p_amount,p_staff_only);
end;$$;
revoke all on function private.enqueue_kjm_notification(uuid,text,text,integer,boolean) from public,anon,authenticated,service_role;

create function public.admin_update_manual_driving_details(p_booking uuid,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.customer_verifications%rowtype;
begin
 if not private.is_active_admin() then raise exception 'Administrator access required';end if;
 perform 1 from public.bookings b join public.booking_admin_details a on a.booking_id=b.id where b.id=p_booking and b.status in ('pending','confirmed') for update of b;
 if not found then raise exception 'Eligible admin booking required';end if;
 select * into v from public.customer_verifications where booking_id=p_booking for update;
 if v.overall_status in ('approved','rejected') or exists(select 1 from public.verification_reviews where verification_id=v.id and result='approved') then raise exception 'Approved verification evidence cannot be rewritten. Use the existing correction and review workflow';end if;
 if length(trim(coalesce(p_values->>'identityName',''))) not between 2 and 160 or length(trim(coalesce(p_values->>'licenseName',''))) not between 2 and 160 or length(trim(coalesce(p_values->>'licenseCountry',''))) not between 2 and 100 or length(trim(coalesce(p_values->>'categories',''))) not between 1 and 200 or (p_values->>'licenseExpiry')::date is null or (p_values->>'licenseExpiry')::date<(now() at time zone 'Asia/Manila')::date then raise exception 'Enter genuine names, license country, unexpired license date and motorcycle categories';end if;
 update public.customer_verifications set identity_name=trim(p_values->>'identityName'),license_name=trim(p_values->>'licenseName'),license_issuing_country=trim(p_values->>'licenseCountry'),license_expiration_date=(p_values->>'licenseExpiry')::date,permitted_vehicle_categories=trim(p_values->>'categories'),philippines_entry_date=nullif(p_values->>'entryDate','')::date where id=v.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'verification.manual_details_recorded','customer_verification',v.id);
end;$$;
revoke all on function public.admin_update_manual_driving_details(uuid,jsonb) from public,anon,service_role;
grant execute on function public.admin_update_manual_driving_details(uuid,jsonb) to authenticated;

create function public.admin_search_manual_customers(p_query text) returns table(id uuid,full_name text,phone text,email text,customer_type text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_admin() then raise exception 'Administrator access required';end if;
 if p_query is null or length(trim(p_query)) not between 2 and 100 then raise exception 'Enter at least two search characters';end if;
 return query select c.id,c.full_name,c.phone,c.email,c.customer_type from public.customers c where c.auth_user_id is null and (
 strpos(lower(c.full_name),lower(trim(p_query)))>0 or strpos(lower(coalesce(c.email,'')),lower(trim(p_query)))>0
 or (length(private.manual_phone_key(p_query))>=2 and strpos(private.manual_phone_key(c.phone),private.manual_phone_key(p_query))>0)) order by c.full_name,c.id limit 15;
end;$$;
revoke all on function public.admin_search_manual_customers(text) from public,anon,service_role;
grant execute on function public.admin_search_manual_customers(text) to authenticated;
commit;
