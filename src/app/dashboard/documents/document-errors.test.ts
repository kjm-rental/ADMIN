import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  lookup: vi.fn(),
  audit: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
import { GET } from "./[id]/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue({
    data: {
      id: "synthetic",
      verification_id: "verification",
      storage_path: "synthetic-path",
    },
    error: null,
  });
  mocks.audit.mockResolvedValue({ error: null });
  mocks.signed.mockResolvedValue({
    data: { signedUrl: "https://example.invalid/synthetic" },
    error: null,
  });
  mocks.requireAdmin.mockResolvedValue({
    user: { id: "synthetic-admin" },
    supabase: {
      from: (table: string) =>
        table === "verification_reviews"
          ? { insert: mocks.audit }
          : { select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }) },
      storage: { from: () => ({ createSignedUrl: mocks.signed }) },
    },
  });
});
const request = () =>
  GET(new Request("http://localhost/dashboard/documents/synthetic"), {
    params: Promise.resolve({ id: "synthetic" }),
  });
it("reports database lookup failure as 500 and never issues a private URL", async () => {
  mocks.lookup.mockResolvedValue({ data: null, error: { message: "failure" } });
  expect((await request()).status).toBe(500);
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("preserves genuine missing-document 404", async () => {
  mocks.lookup.mockResolvedValue({ data: null, error: null });
  expect((await request()).status).toBe(404);
});
it("never releases a signed URL when access auditing fails", async () => {
  mocks.audit.mockResolvedValue({ error: { message: "failure" } });
  expect((await request()).status).toBe(500);
});
it("retains five-minute private URL and access audit on success", async () => {
  expect((await request()).status).toBe(307);
  expect(mocks.signed).toHaveBeenCalledWith("synthetic-path", 300);
  expect(mocks.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      reviewer_user_id: "synthetic-admin",
      review_type: "document_access",
    }),
  );
});
it("requires administrator authorization before lookup or URL issuance", async () => {
  mocks.requireAdmin.mockRejectedValue(new Error("Denied"));
  await expect(request()).rejects.toThrow("Denied");
  expect(mocks.lookup).not.toHaveBeenCalled();
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("does not cache the private redirect", async () => {
  const response = await request();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
