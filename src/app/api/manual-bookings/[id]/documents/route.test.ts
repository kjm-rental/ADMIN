import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  upload: vi.fn(),
  rpc: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: m.session }));
import { POST } from "./route";
const id = "10000000-0000-4000-8000-000000000001";
function request(
  content = "%PDF-1.7 test",
  type = "application/pdf",
  origin = "https://admin.example.test",
) {
  const form = new FormData();
  form.set("kind", "government_id");
  form.set("document", new File([content], "private.pdf", { type }));
  return new Request(
    `https://admin.example.test/api/manual-bookings/${id}/documents`,
    { method: "POST", headers: { origin }, body: form },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  m.upload.mockResolvedValue({ error: null });
  m.rpc.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  m.session.mockResolvedValue({
    supabase: {
      from: () => {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: { booking_id: id }, error: null }),
        };
        return q;
      },
      storage: {
        from: (bucket: string) => {
          expect(bucket).toBe("identity-verification");
          return { upload: m.upload, remove: m.remove };
        },
      },
      rpc: m.rpc,
    },
  });
});
it("rejects cross-origin uploads before accessing private storage", async () => {
  expect(
    (
      await POST(
        request("%PDF-1.7", "application/pdf", "https://elsewhere.test"),
        { params: Promise.resolve({ id }) },
      )
    ).status,
  ).toBe(403);
  expect(m.upload).not.toHaveBeenCalled();
});
it("requires current admin authentication", async () => {
  m.session.mockResolvedValue(null);
  expect(
    (await POST(request(), { params: Promise.resolve({ id }) })).status,
  ).toBe(401);
  expect(m.upload).not.toHaveBeenCalled();
});
it("rejects mismatched file contents before storage", async () => {
  const response = await POST(request("<script>not a PDF</script>"), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(400);
  expect(m.upload).not.toHaveBeenCalled();
});
it("uploads only to the private booking namespace and guarded registration RPC", async () => {
  expect(
    (await POST(request(), { params: Promise.resolve({ id }) })).status,
  ).toBe(200);
  expect(m.upload.mock.calls[0][0]).toMatch(new RegExp(`^guest/${id}/`));
  expect(m.rpc).toHaveBeenCalledWith(
    "admin_register_manual_document",
    expect.objectContaining({
      p_booking: id,
      p_kind: "government_id",
      p_mime: "application/pdf",
    }),
  );
});
it("cleans up a private object if metadata registration is rejected", async () => {
  m.rpc.mockResolvedValue({
    error: { message: "Booking is no longer eligible" },
  });
  const response = await POST(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(400);
  expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0][0]]);
});
