import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
// Static security contracts, not substitutes for applying/replaying SQL in a disposable database.
const sql = readFileSync(
  "docs/migrations/202610270039_admin_manual_bookings.sql",
  "utf8",
);
it("reuses canonical pricing, extras and delivery calculators", () => {
  expect(sql).toContain(
    "private.calculate_booking_quote(model,starts,ends,false)",
  );
  expect(sql).toContain(
    "public.get_delivery_quote(p_payload->'services',starts,ends)",
  );
  expect(sql).toContain(
    "private.calculate_extra_selection(p_payload->'extras'",
  );
});
it("rechecks availability under model/unit advisory locks", () => {
  const save = sql.slice(
    sql.indexOf("create function public.admin_save_manual_booking"),
  );
  expect(
    save.indexOf("pg_advisory_xact_lock(hashtextextended(model::text,0))"),
  ).toBeLessThan(save.indexOf("q:=public.admin_quote_manual_booking"));
  expect(save).toContain("private.manual_booking_units(model,starts,ends,bid)");
});
it("preserves expiration and does not assign pending bookings a permanent unit", () => {
  expect(sql).toContain("bs.pending_hold_minutes");
  expect(sql).toContain("expires_at>now()");
  expect(sql).toContain(
    "case when b.status='confirmed' then unit else null end",
  );
  expect(sql).not.toContain("set expires_at=now()+");
});
it("does not alter financial events or handover verification guards", () => {
  expect(sql).not.toMatch(
    /(?:insert into|update|delete from) public\.(?:payment_events|payment_intents|security_deposit_events)\b/,
  );
  expect(sql).not.toMatch(
    /(?:drop|disable) trigger.*(?:guard_identity_handover|guard_rental_workflow)/,
  );
  expect(sql).not.toMatch(
    /set (?:identity_status|license_status|overall_status)='approved'/,
  );
});
it("records explicit confirmation evidence without fake terms acceptance", () => {
  expect(sql).toContain("'booking.manual_confirmed'");
  expect(sql).toContain("'verification_pending',true");
  expect(sql).not.toContain("insert into public.booking_terms_acceptances");
});
it("prevents edits with money or inspection history and checks optimistic revision", () => {
  for (const table of [
    "payment_events",
    "payment_intents",
    "security_deposit_events",
    "rental_inspections",
  ])
    expect(sql).toContain(
      `exists(select 1 from public.${table} where booking_id=bid)`,
    );
  expect(sql).toContain(
    "actual_revision is distinct from (p_payload->>'revision')::integer",
  );
});
it("enforces binding, fingerprint and actor on idempotent requests", () => {
  expect(sql).toContain(
    "old_req.actor<>auth.uid() or old_req.fingerprint<>fingerprint",
  );
  expect(sql).toContain("request_id uuid primary key");
});
it("keeps notes behind admin RLS and exposes no write grants or anonymous admin RPC", () => {
  expect(sql).toContain(
    "alter table public.booking_admin_details force row level security",
  );
  expect(sql).not.toMatch(
    /grant (?:all|insert|update|delete).*booking_admin_details/,
  );
  expect(sql).not.toMatch(
    /grant execute on function public\.admin_.*to (?:anon|public|service_role)/,
  );
});
it("keeps optional email nullable and uses the existing bound notification channel", () => {
  expect(sql).toContain(
    "v_email text:=nullif(lower(trim(p_payload->>'email')),'')",
  );
  expect(sql).toContain(
    "if v_email is null then delete from public.guest_booking_contacts",
  );
  expect(sql).toContain("private.enqueue_kjm_notification");
  expect(sql).not.toContain("api.resend.com");
});
it("keeps a separate approved PHP 2500 cash deposit and fail-closed accessory compatibility", () => {
  expect(sql).toContain("ds.cash_amount_centavos=250000");
  expect(sql).toContain("not (model=any(e.compatible_model_ids))");
});

it("requires new entitlement review when the booked motorcycle model changes", () => {
  expect(sql).toContain("if b.motorcycle_model_id is distinct from model then");
  expect(sql).toContain(
    "set entitlement_status='under_review',overall_status='under_review'",
  );
  expect(sql).toContain(
    "approved evidence. Use an authorized identity correction",
  );
});
