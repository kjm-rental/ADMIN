import { expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
import {
  livePaymentLabel,
  type LiveCheckoutStatus,
} from "./live-payment-status";
const base: LiveCheckoutStatus = {
  id: "synthetic",
  status: "session_created",
  amount_centavos: 119800,
  checkout_session_id: "cs_synthetic",
  checkout_deadline: "2099-01-01T00:00:00Z",
};
it("only labels final ledger settlement as paid", () => {
  expect(livePaymentLabel({ ...base, status: "paid" })).toBe("Paid — verified");
  expect(livePaymentLabel({ ...base, status: "review_required" })).toContain(
    "owner review",
  );
});
it.each(["failed_unpaid", "cancelled_unpaid", "expired_unpaid"])(
  "shows verified %s distinctly",
  (state) => {
    const label = livePaymentLabel({
      ...base,
      provider_status: state,
      provider_checked_at: "2026-10-26T00:00:00Z",
    });
    expect(label).toContain(
      state.startsWith("failed")
        ? "Failed"
        : state.startsWith("cancelled")
          ? "Cancelled"
          : "Expired",
    );
    expect(label).not.toContain("Paid — verified");
  },
);
it("does not infer a failed or paid payment from an elapsed deadline", () => {
  expect(
    livePaymentLabel({ ...base, checkout_deadline: "2020-01-01T00:00:00Z" }),
  ).toBe("Checkout window elapsed — reconciliation required");
});
