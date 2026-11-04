import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: m.session }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { quoteManualBooking, saveManualBooking } from "./manual-bookings";
const d = {
  requestId: "10000000-0000-4000-8000-000000000001",
  bookingId: null,
  revision: 0,
  customerId: null,
  fullName: "Juan Dela Cruz",
  phone: "09171234567",
  email: "",
  customerType: "philippine_resident" as const,
  source: "phone" as const,
  modelId: "10000000-0000-4000-8000-000000000002",
  unitId: "10000000-0000-4000-8000-000000000003",
  startAt: "2027-01-01T09:00",
  endAt: "2027-01-02T09:00",
  services: { delivery: null, collection: null },
  extras: [],
  adjustment: { kind: "none" as const, value: 0, reason: "" },
  notes: "Internal only",
  action: "pending" as const,
  confirmationReason: "",
  expectedTotal: 1000,
  quoteToken: "quote-hash",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ supabase: { rpc: m.rpc } });
  m.rpc.mockResolvedValue({ data: { bookingId: d.requestId }, error: null });
});
it("quotes price from rental choices before customer details are completed", async () => {
  await quoteManualBooking({
    modelId: d.modelId,
    bookingId: null,
    startAt: d.startAt,
    endAt: d.endAt,
    selectedColor: "Red",
    services: d.services,
    extras: d.extras,
    adjustment: d.adjustment,
  });
  expect(m.rpc).toHaveBeenCalledWith(
    "admin_quote_manual_booking_with_color",
    expect.objectContaining({
      p_payload: expect.objectContaining({
        modelId: d.modelId,
        selectedColor: "Red",
        startAt: "2027-01-01T01:00:00.000Z",
      }),
    }),
  );
  expect(m.rpc.mock.calls[0][1].p_payload).not.toHaveProperty("fullName");
});
it("still refuses to save incomplete customer details", async () => {
  const result = await saveManualBooking({ ...d, fullName: "", phone: "" });
  expect(result.error).toBeTruthy();
  expect(m.rpc).not.toHaveBeenCalled();
});
it("requires fresh admin authorization before requesting a quote", async () => {
  m.session.mockResolvedValue(null);
  expect((await quoteManualBooking(d)).error).toContain("administrator");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("requires fresh authorization before saving", async () => {
  m.session.mockResolvedValue(null);
  expect((await saveManualBooking(d)).error).toContain("administrator");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("sends Manila timestamps, no fake email, and the original retry key to one atomic RPC", async () => {
  await saveManualBooking(d);
  expect(m.rpc).toHaveBeenCalledWith("admin_save_manual_booking_with_color", {
    p_payload: {
      ...d,
      startAt: "2027-01-01T01:00:00.000Z",
      endAt: "2027-01-02T01:00:00.000Z",
    },
  });
});
it("preserves the idempotency key on repeated submissions", async () => {
  await saveManualBooking(d);
  await saveManualBooking(d);
  expect(m.rpc.mock.calls[0][1]).toEqual(m.rpc.mock.calls[1][1]);
});
it("does not save without a reviewed quote", async () => {
  expect(
    (await saveManualBooking({ ...d, quoteToken: undefined })).error,
  ).toContain("fresh quote");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("reports inventory conflicts without claiming success", async () => {
  m.rpc.mockResolvedValue({
    error: { message: "Selected motorcycle is no longer available" },
  });
  expect((await saveManualBooking(d)).error).toContain("no longer available");
  expect(m.refresh).not.toHaveBeenCalled();
});
it("reports missing migration explicitly", async () => {
  m.rpc.mockResolvedValue({ error: { code: "PGRST202", message: "missing" } });
  expect((await saveManualBooking(d)).error).toContain("migration");
});
it("uses existing booking/list/calendar/customer routes after save", async () => {
  await saveManualBooking(d);
  expect(m.refresh).toHaveBeenCalledWith("/dashboard/calendar");
  expect(m.refresh).toHaveBeenCalledWith(`/dashboard/bookings/${d.requestId}`);
});
it("rejects unreasoned pricing overrides before the database call", async () => {
  const result = await saveManualBooking({
    ...d,
    adjustment: { kind: "fixed", value: 50, reason: "" },
  });
  expect(result.error).toContain("reason");
  expect(m.rpc).not.toHaveBeenCalled();
});

it("carries the binding color into quote and save without changing the retry key", async () => {
  await quoteManualBooking({ ...d, selectedColor: "White / Black" });
  expect(m.rpc).toHaveBeenCalledWith(
    "admin_quote_manual_booking_with_color",
    expect.objectContaining({
      p_payload: expect.objectContaining({ selectedColor: "White / Black" }),
    }),
  );
  await saveManualBooking({ ...d, selectedColor: "White / Black" });
  expect(m.rpc).toHaveBeenCalledWith(
    "admin_save_manual_booking_with_color",
    expect.objectContaining({
      p_payload: expect.objectContaining({
        selectedColor: "White / Black",
        requestId: d.requestId,
      }),
    }),
  );
});
