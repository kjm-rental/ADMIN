import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getFreshAdminSession: vi.fn(),
  lookup: vi.fn(),
  audit: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: mocks.getFreshAdminSession }));
import { GET } from "./[id]/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue({
    data: {
      id: "19eaa705-fed3-415b-909e-878bd1464650",
      verification_id: "verification",
      storage_path: "guest/a8945f59-56b6-4813-9878-ad81440f9b54/file",
      booking_id: "a8945f59-56b6-4813-9878-ad81440f9b54",
      owner_user_id: null,
    },
    error: null,
  });
  mocks.audit.mockResolvedValue({ error: null });
  mocks.signed.mockResolvedValue({
    data: { signedUrl: "https://example.invalid/synthetic" },
    error: null,
  });
  mocks.getFreshAdminSession.mockResolvedValue({
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
    params: Promise.resolve({ id: "19eaa705-fed3-415b-909e-878bd1464650" }),
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
  expect(mocks.signed).toHaveBeenCalledWith("guest/a8945f59-56b6-4813-9878-ad81440f9b54/file", 300);
  expect(mocks.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      reviewer_user_id: "synthetic-admin",
      review_type: "document_access",
    }),
  );
});
it("requires administrator authorization before lookup or URL issuance", async () => {
  mocks.getFreshAdminSession.mockResolvedValue(null);
  expect((await request()).status).toBe(401);
  expect(mocks.lookup).not.toHaveBeenCalled();
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("does not cache the private redirect", async () => {
  const response = await request();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});

it("rejects paths belonging to a different booking", async () => {
  const lookup = await mocks.lookup();
  mocks.lookup.mockResolvedValue({data: {...lookup.data, storage_path: "guest/another-booking/file"}, error: null});
  expect((await request()).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("renews a signed URL on every retry request", async () => {
  await request(); await request();
  expect(mocks.signed).toHaveBeenCalledTimes(2);
});
it("handles unavailable storage without exposing provider details", async () => {
  mocks.signed.mockResolvedValue({ data: null, error: {message: "private internal storage error"} });
  const response = await request();
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("Document unavailable");
});
