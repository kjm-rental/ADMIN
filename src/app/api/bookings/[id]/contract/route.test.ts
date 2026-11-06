import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  load: vi.fn(),
  render: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: m.session }));
vi.mock("@/services/rental-contract", () => ({ loadRentalContract: m.load }));
vi.mock("@/lib/contracts/pdf", () => ({ renderRentalContract: m.render }));
import { GET } from "./route";
import { ContractUnavailable } from "@/lib/contracts/terms";
const id = "10000000-0000-4000-8000-000000000001";
function request(bookingId = id) {
  return GET(
    new Request(
      "https://kjmadmin.example/api/bookings/" + bookingId + "/contract",
    ),
    { params: Promise.resolve({ id: bookingId }) },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ supabase: {} });
  m.load.mockResolvedValue({ booking: { booking_reference: "KJM-SAMPLE" } });
  m.render.mockResolvedValue(new TextEncoder().encode("%PDF-sample"));
});
it("rejects non-admin sessions before reading any booking data", async () => {
  m.session.mockResolvedValue(null);
  const r = await request();
  expect(r.status).toBe(401);
  expect(m.load).not.toHaveBeenCalled();
  expect(r.headers.get("Cache-Control")).toContain("no-store");
});
it("rejects invalid identifiers without querying", async () => {
  expect((await request("invalid")).status).toBe(400);
  expect(m.load).not.toHaveBeenCalled();
});
it("returns not found without generating a document", async () => {
  m.load.mockResolvedValue(null);
  expect((await request()).status).toBe(404);
  expect(m.render).not.toHaveBeenCalled();
});
it("downloads a private PDF with a safe booking-specific filename", async () => {
  m.load.mockResolvedValue({
    booking: { booking_reference: 'KJM-TEST\r\nBad:"name' },
  });
  const r = await request();
  expect(r.status).toBe(200);
  expect(r.headers.get("Content-Type")).toBe("application/pdf");
  expect(r.headers.get("Content-Disposition")).toBe(
    'attachment; filename="KJM-Rental-Contract-KJM-TEST__Bad__name.pdf"',
  );
  expect(r.headers.get("Cache-Control")).toContain("private, no-store");
  expect(r.headers.get("Vary")).toBe("Cookie");
  expect(await r.text()).toBe("%PDF-sample");
});
it("fails closed when the original accepted agreement cannot be verified", async () => {
  m.load.mockRejectedValue(
    new ContractUnavailable("Original terms unavailable"),
  );
  const r = await request();
  expect(r.status).toBe(409);
  expect(m.render).not.toHaveBeenCalled();
});
it("keeps database details and credentials out of export errors", async () => {
  m.load.mockRejectedValue(new Error("secret database details"));
  const r = await request();
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("secret database details");
});
