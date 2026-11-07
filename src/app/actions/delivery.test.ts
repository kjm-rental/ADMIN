import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: m.session }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { saveDelivery } from "./delivery";
function form() {
  const f = new FormData();
  Object.entries({
    mode: "area",
    name: "Owner entered area",
    delivery_php: "200",
    collection_php: "400",
    enabled: "on",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ supabase: { rpc: m.rpc } });
  m.rpc.mockResolvedValue({ error: null });
});
it("requires active admin before any change", async () => {
  m.session.mockResolvedValue(null);
  await expect(saveDelivery(form())).rejects.toThrow("Administrator");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("saves one combined owner rate for both service directions", async () => {
  await saveDelivery(form());
  expect(m.rpc).toHaveBeenCalledWith("admin_save_delivery_area", {
    p_id: null,
    p_remove: false,
    p_values: {
      name: "Owner entered area",
      delivery_php: 200,
      collection_php: 200,
      enabled: true,
    },
  });
});
it("rejects negative or fractional unsupported fees", async () => {
  const f = form();
  f.set("delivery_php", "-1");
  await expect(saveDelivery(f)).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
});
it("does not report a removal blocked by a booking reference as successful", async () => {
  m.rpc.mockResolvedValue({ error: { code: "23503" } });
  const f = form();
  f.set("remove", "yes");
  f.set("id", "10000000-0000-4000-8000-000000000001");
  await expect(saveDelivery(f)).rejects.toThrow("disable it instead");
  expect(m.refresh).not.toHaveBeenCalled();
});
