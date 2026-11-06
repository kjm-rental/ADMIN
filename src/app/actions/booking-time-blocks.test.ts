import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: m.session }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import {
  addBookingTimeBlock,
  cancelBookingTimeBlock,
  enable24HourBooking,
} from "./booking-time-blocks";
function form() {
  const f = new FormData();
  Object.entries({
    startAt: "2099-11-10T23:17",
    endAt: "2099-11-11T02:43",
    scope: "pickup",
    reason: " Airport transfer ",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ supabase: { rpc: m.rpc } });
  m.rpc.mockResolvedValue({ error: null });
});
it("requires an active admin for every mutation", async () => {
  m.session.mockResolvedValue(null);
  for (const operation of [
    () => addBookingTimeBlock(form()),
    () => cancelBookingTimeBlock(form()),
    () => enable24HourBooking(),
  ])
    await expect(operation()).rejects.toThrow("Administrator");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("preserves exact Manila minutes across midnight", async () => {
  await addBookingTimeBlock(form());
  expect(m.rpc).toHaveBeenCalledWith("admin_add_booking_time_block", {
    p_start_at: "2099-11-10T15:17:00.000Z",
    p_end_at: "2099-11-10T18:43:00.000Z",
    p_scope: "pickup",
    p_reason: "Airport transfer",
  });
  expect(m.refresh).toHaveBeenCalledWith("/dashboard/settings");
});
it.each([
  { startAt: "2099-02-30T12:00" },
  { endAt: "2099-11-10T23:17" },
  { scope: "bad" },
  { endAt: "2020-01-01T00:00" },
])("rejects invalid closures %j", async (patch) => {
  const f = form();
  Object.entries(patch).forEach(([k, v]) => f.set(k, v));
  await expect(addBookingTimeBlock(f)).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
});
it("does not report failed saves as successful", async () => {
  m.rpc.mockResolvedValue({ error: { code: "42501" } });
  await expect(addBookingTimeBlock(form())).rejects.toThrow("Unable to block");
  expect(m.refresh).not.toHaveBeenCalled();
});
it("soft-removes only the chosen block through the admin RPC", async () => {
  const f = new FormData();
  f.set("id", "10000000-0000-4000-8000-000000000001");
  await cancelBookingTimeBlock(f);
  expect(m.rpc).toHaveBeenCalledWith("admin_cancel_booking_time_block", {
    p_id: f.get("id"),
  });
});
