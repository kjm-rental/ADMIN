import { describe, it, expect } from "vitest";
import { depositBalance } from "./deposit-balances";
import type { BookingDeposit, DepositEvent } from "@/types/rental";
const d = {
  booking_id: "synthetic",
  option: "cash",
  required_centavos: 12345,
  is_test: true,
} as BookingDeposit;
function e(
  sequence: number,
  event_type: DepositEvent["event_type"],
  amount_centavos = 0,
): DepositEvent {
  return {
    sequence,
    event_type,
    amount_centavos,
    booking_id: d.booking_id,
    is_test: true,
  } as DepositEvent;
}
describe("separate deposit liability", () => {
  it("starts uncollected", () =>
    expect(depositBalance(d, []).status).toBe("Not collected"));
  it("reconciles partial and full returns", () => {
    const events = [e(1, "cash_collected", 12345), e(2, "cash_returned", 100)];
    expect(depositBalance(d, events)).toMatchObject({
      held: 12245,
      status: "Partially returned",
    });
    events.push(e(3, "cash_returned", 12245));
    expect(depositBalance(d, events)).toMatchObject({
      held: 0,
      status: "Fully returned",
    });
  });
  it("keeps explicit unresolved liability and orders by sequence", () =>
    expect(
      depositBalance(d, [
        e(3, "case_opened"),
        e(1, "cash_collected", 12345),
        e(2, "cash_returned", 100),
      ]),
    ).toMatchObject({
      held: 12245,
      unresolved: true,
      status: "Pending resolution",
    }));
  it("does not merge business and synthetic ledger events", () =>
    expect(
      depositBalance(d, [{ ...e(1, "cash_collected", 99999), is_test: false }])
        .held,
    ).toBe(0));
  it("does not merge booking records", () =>
    expect(
      depositBalance(d, [
        { ...e(1, "cash_collected", 99999), booking_id: "other" },
      ]).held,
    ).toBe(0));
  it("tracks physical custody separately", () => {
    const doc = { ...d, option: "eligible_id" as const, required_centavos: 0 };
    expect(depositBalance(doc, []).status).toBe("Awaiting document");
    expect(depositBalance(doc, [e(1, "id_received")])).toMatchObject({
      custody: 1,
      held: 0,
      status: "Document received",
    });
    expect(
      depositBalance(doc, [e(1, "id_received"), e(2, "id_returned")]),
    ).toMatchObject({ custody: 0, held: 0, status: "Document returned" });
  });
  it("resolves cases without changing amounts", () =>
    expect(
      depositBalance(d, [e(1, "case_opened"), e(2, "case_resolved")]),
    ).toMatchObject({ held: 0, unresolved: false }));
});
