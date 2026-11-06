import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ claims: vi.fn(), create: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: m.create }));
import { proxy } from "./proxy";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-public-key");
  m.create.mockReturnValue({ auth: { getClaims: m.claims } });
  m.claims.mockResolvedValue({
    data: { claims: { sub: "verified-user" } },
    error: null,
  });
});
it("allows verified identity through while pages retain their own admin checks", async () => {
  const r = await proxy(
    new NextRequest("https://admin.example/dashboard/bookings"),
  );
  expect(m.claims).toHaveBeenCalledOnce();
  expect(r.headers.get("location")).toBeNull();
});
it.each([
  { data: null, error: null },
  { data: { claims: {} }, error: null },
  {
    data: { claims: { sub: "forged-user" } },
    error: { message: "Invalid signature" },
  },
])("rejects absent or invalid verified identity", async (result) => {
  m.claims.mockResolvedValue(result);
  const r = await proxy(
    new NextRequest("https://admin.example/dashboard/bookings?status=all"),
  );
  expect(r.status).toBe(307);
  expect(r.headers.get("location")).toBe("https://admin.example/sign-in");
});
it("preserves refreshed session cookies on the response", async () => {
  m.claims.mockImplementation(async () => {
    const options = m.create.mock.calls[0][2];
    options.cookies.setAll([
      {
        name: "sb-session",
        value: "refreshed",
        options: { path: "/", httpOnly: true },
      },
    ]);
    return { data: { claims: { sub: "verified-user" } }, error: null };
  });
  const r = await proxy(new NextRequest("https://admin.example/dashboard"));
  expect(r.cookies.get("sb-session")?.value).toBe("refreshed");
});
it("keeps the secret-authenticated notification worker outside cookie auth", async () => {
  await proxy(
    new NextRequest("https://admin.example/api/internal/notifications"),
  );
  expect(m.create).not.toHaveBeenCalled();
});
