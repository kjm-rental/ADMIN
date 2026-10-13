import { describe, expect, it } from "vitest";
import { summarizePayments, manilaDay } from "./operational-summary";
import type { Database } from "@/types/database";
type B = Database["public"]["Tables"]["bookings"]["Row"];
type E = Database["public"]["Tables"]["payment_events"]["Row"];
const booking = (
  id: string,
  total: number,
  status = "confirmed",
  test = false,
) => ({ id, total_centavos: total, status, is_test: test }) as B;
const event = (id: string, kind: string, amount: number, test = false) =>
  ({
    booking_id: id,
    event_type: kind,
    amount_centavos: amount,
    is_test: test,
  }) as E;
describe("read-only financial summaries", () => {
  it("uses centavos, subtracts adjustments, and excludes synthetic records", () => {
    const s = summarizePayments(
      [booking("live", 10000), booking("test", 99999, "confirmed", true)],
      [
        event("live", "payment", 8000),
        event("live", "refund", 1000),
        event("live", "reversal", 2000),
        event("live", "payment", 99999, true),
        event("test", "payment", 99999, true),
      ],
    );
    expect(s.net).toBe(5000);
    expect(s.outstanding).toBe(5000);
    expect(s.payments).toHaveLength(3);
  });
  it("does not treat unknown events or cancelled quotes as received revenue or receivables", () => {
    const s = summarizePayments(
      [booking("a", 1000), booking("b", 99999, "cancelled")],
      [
        event("a", "pending", 1000),
        event("a", "constructor", 1000),
        event("a", "payment", 2000),
      ],
    );
    expect(s.net).toBe(2000);
    expect(s.outstanding).toBe(0);
  });
  it("keeps test reporting explicitly separate", () => {
    expect(
      summarizePayments(
        [booking("test", 1000, "active", true)],
        [event("test", "payment", 400, true)],
        true,
      ).outstanding,
    ).toBe(600);
  });
  it("compares days in Manila across UTC midnight", () =>
    expect(manilaDay("2026-10-10T18:00:00Z")).toBe("2026-10-11"));
});
