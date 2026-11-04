import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const sql = readFileSync(
  "../KJM MAIN/supabase/migrations/202610260036_simple_rental_operations.sql",
  "utf8",
);
it("serializes operations and rejects stale displayed amounts", () => {
  expect(sql).toContain("where id=p_booking_id for update");
  expect(sql).toContain("amount<>p_expected_centavos");
  expect(sql).toContain("if amount<=0");
});
it("reuses existing ledgers and secure financial functions", () => {
  expect(sql).toContain("return public.admin_record_offline_payment");
  expect(sql).toContain("return public.admin_record_security_deposit_event");
  expect(sql).not.toMatch(
    /create table|update public.payment_events|delete from public.payment_events/i,
  );
});
it("blocks duplicate collections and duplicate cash receipts with distinct requests", () => {
  expect(sql).toContain("if collected<>0 then");
  expect(sql).toContain("amount:=greatest(0,b.total_centavos-paid)");
  expect(sql).toContain("where idempotency_key=p_idempotency_key");
});
it("requires inspection and explicit reason for deductions and never exceeds liability", () => {
  expect(sql).toContain("p_event_type='cash_deducted'");
  expect(sql).toContain("p_amount_centavos>collected-returned");
  expect(sql).toContain("length(trim(coalesce(p_notes,'')))<5");
  expect(sql).toContain("amount:=collected-refunded-deducted");
  expect(sql).toContain("kind='return'");
});
it("preserves active-admin authorization and rejects public access", () => {
  expect(sql).toContain("if not private.is_active_admin()");
  expect(sql).toContain("from public,anon");
  expect(sql).not.toContain("to anon");
});
it("preserves handover rules and separates deduction from returned cash", () => {
  expect(sql).toContain("Recorded handover inspection required");
  expect(sql).toContain("when 'cash_deducted' then -amount_centavos");
  expect(sql).not.toContain("update public.notification_settings");
});
const viewer = readFileSync("src/components/rental-operations.tsx", "utf8");
it("normal operations require confirmation without editable financial inputs", () => {
  expect(viewer).toContain("Confirm Cash Returned");
  expect(viewer).toContain("Confirm Payment Received");
  expect(viewer).toContain("Confirm Deposit Collected");
  expect(viewer).not.toContain('type="number"');
  expect(viewer).toContain("Approved deductions");
  expect(viewer).toMatch(/kind\s*===\s*"return"/);
});
