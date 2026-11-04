import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  refresh: vi.fn(),
  lookup: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
import { confirmRentalOperation } from "./rental-operations";
const bookingId = "a8945f59-56b6-4813-9878-ad81440f9b54";
function form(operation = "rental_payment") {
  const f = new FormData();
  Object.entries({
    bookingId,
    operation,
    expectedCentavos: "119800",
    idempotencyKey: "19eaa705-fed3-415b-909e-878bd1464650",
    confirmed: "yes",
    amountPhp: "1",
    method: "other_offline",
    occurredAt: "2000-01-01",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }),
    }),
  });
  mocks.lookup.mockResolvedValue({ data: null, error: null });
  mocks.session.mockResolvedValue({
    supabase: { rpc: mocks.rpc, from: mocks.from },
  });
  mocks.rpc.mockResolvedValue({ error: null });
});
it.each(["rental_payment", "deposit_collection", "deposit_refund"])(
  "passes %s to the atomic server wrapper without client method/date/amount overrides",
  async (operation) => {
    await confirmRentalOperation(form(operation));
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_confirm_rental_cash_operation",
      {
        p_booking_id: bookingId,
        p_operation: operation,
        p_expected_centavos: 119800,
        p_idempotency_key: "19eaa705-fed3-415b-909e-878bd1464650",
        p_confirmed: true,
      },
    );
  },
);
it("denies an unauthorized administrator before any financial call", async () => {
  mocks.session.mockResolvedValue(null);
  await expect(confirmRentalOperation(form())).rejects.toThrow("sign in");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires explicit physical cash confirmation", async () => {
  const f = form();
  f.delete("confirmed");
  await expect(confirmRentalOperation(f)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("does not report a stale or rejected transaction as saved", async () => {
  mocks.rpc.mockResolvedValue({
    error: { code: "P0001", message: "Balance changed" },
  });
  await expect(confirmRentalOperation(form())).rejects.toThrow("Refresh");
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("retains the same idempotency key on retries", async () => {
  const f = form();
  await confirmRentalOperation(f);
  await confirmRentalOperation(f);
  expect(mocks.rpc.mock.calls[0][1].p_idempotency_key).toBe(
    mocks.rpc.mock.calls[1][1].p_idempotency_key,
  );
});

it("reports a missing RPC without attempting any alternate financial writer", async () => {
  mocks.rpc.mockResolvedValue({
    error: { code: "PGRST202", message: "schema cache technical detail" },
  });
  await expect(confirmRentalOperation(form())).rejects.toThrow(
    "No transaction was recorded",
  );
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.from).not.toHaveBeenCalled();
});
it.each(["rental_payment", "deposit_collection", "deposit_refund"])(
  "reconciles a committed %s after a lost response without creating another transaction",
  async (operation) => {
    mocks.rpc.mockResolvedValue({ error: { message: "network timeout" } });
    mocks.lookup.mockResolvedValue({
      data: {
        booking_id: bookingId,
        event_type:
          operation === "rental_payment"
            ? "payment"
            : operation === "deposit_collection"
              ? "cash_collected"
              : "cash_returned",
        amount_centavos: 119800,
      },
      error: null,
    });
    await confirmRentalOperation(form(operation));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  },
);
it("does not report success when saved status cannot be read", async () => {
  mocks.rpc.mockResolvedValue({ error: { message: "timeout" } });
  mocks.lookup.mockResolvedValue({
    data: null,
    error: { code: "unavailable" },
  });
  await expect(confirmRentalOperation(form())).rejects.toThrow(
    "status could not be confirmed",
  );
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("does not accept an unrelated amount as a successful retry", async () => {
  mocks.rpc.mockResolvedValue({ error: { message: "timeout" } });
  mocks.lookup.mockResolvedValue({
    data: { event_type: "payment", amount_centavos: 1 },
    error: null,
  });
  await expect(confirmRentalOperation(form())).rejects.toThrow(
    "status could not be confirmed",
  );
  expect(mocks.refresh).not.toHaveBeenCalled();
});
