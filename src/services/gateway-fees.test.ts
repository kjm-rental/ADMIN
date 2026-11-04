import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: m.auth }));
import { getGatewayFees } from "./gateway-fees";
function query(result: unknown) {
  const q = {
    select: () => q,
    order: () => q,
    then: (r: (v: unknown) => unknown) => Promise.resolve(result).then(r),
  };
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ supabase: { from: m.from } });
});
it("provides a setup state only for a missing table", async () => {
  m.from.mockReturnValue(query({ data: null, error: { code: "PGRST205" } }));
  expect(await getGatewayFees()).toEqual({ available: false, fees: [] });
});
it("does not disguise a permission error as missing setup", async () => {
  m.from.mockReturnValue(query({ data: null, error: { code: "42501" } }));
  await expect(getGatewayFees()).rejects.toThrow("could not be loaded");
});
it("loads cost profiles without accessing payments or bookings", async () => {
  m.from.mockReturnValue(query({ data: [], error: null }));
  expect(await getGatewayFees()).toEqual({ available: true, fees: [] });
  expect(m.from.mock.calls.map((c) => c[0])).toEqual([
    "payment_gateway_fee_settings",
  ]);
});
