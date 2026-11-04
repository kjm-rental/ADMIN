import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { saveGatewayFee } from "./gateway-fees";
const data = () => {
  const d = new FormData();
  for (const [k, v] of Object.entries({
    provider: "paymongo",
    paymentMethod: "card",
    percentage: "3.50",
    flatFeePhp: "15",
    notes: "Synthetic rate",
  }))
    d.set(k, v);
  return d;
};
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ supabase: { rpc: m.rpc } });
  m.rpc.mockResolvedValue({ data: "fake-id", error: null });
});
it("requires a fresh active admin session", async () => {
  m.auth.mockResolvedValue(null);
  await expect(saveGatewayFee(data())).rejects.toThrow("Administrator access");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("rejects forged or malformed fee values before saving", async () => {
  const d = data();
  d.set("percentage", "-5");
  await expect(saveGatewayFee(d)).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
});
it("persists only validated cost configuration through the guarded RPC", async () => {
  await saveGatewayFee(data());
  expect(m.rpc).toHaveBeenCalledExactlyOnceWith(
    "admin_save_payment_gateway_fee",
    {
      p_provider: "paymongo",
      p_payment_method: "card",
      p_percentage_basis_points: 350,
      p_flat_fee_centavos: 1500,
      p_notes: "Synthetic rate",
    },
  );
  expect(m.refresh).toHaveBeenCalledWith("/dashboard/settings");
});
it("does not report success or revalidate on a failed save", async () => {
  m.rpc.mockResolvedValue({ error: { message: "private SQL error" } });
  await expect(saveGatewayFee(data())).rejects.toThrow("could not be saved");
  expect(m.refresh).not.toHaveBeenCalled();
});
