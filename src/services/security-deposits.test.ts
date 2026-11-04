import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mock.auth }));
import {
  getSecurityDepositView,
  getSecurityDepositSettings,
} from "./security-deposits";
function query(result: { data: unknown; error: unknown }) {
  const q = {
    select: () => q,
    maybeSingle: () => q,
    eq: () => q,
    order: () => q,
    range: () => q,
    then: (r: (v: typeof result) => unknown) => Promise.resolve(result).then(r),
  };
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ supabase: { from: mock.from } });
});
it("clearly marks unapplied migration without fabricated statistics", async () => {
  mock.from.mockReturnValue(query({ data: null, error: { code: "42P01" } }));
  expect(await getSecurityDepositView()).toMatchObject({
    available: false,
    requirements: [],
    events: [],
  });
});
it("does not mistake database permission failures for empty data", async () => {
  mock.from.mockReturnValue(query({ data: null, error: { code: "42501" } }));
  await expect(getSecurityDepositView()).rejects.toThrow("could not be loaded");
});
it("rejects missing singleton configuration instead of reporting zero", async () => {
  mock.from.mockReturnValue(query({ data: null, error: null }));
  await expect(getSecurityDepositView()).rejects.toThrow("could not be loaded");
});
it("accepts genuine empty ledgers with a loaded configuration", async () => {
  mock.from.mockImplementation((table: string) =>
    query({
      data: table === "security_deposit_settings" ? { id: true } : [],
      error: null,
    }),
  );
  expect(await getSecurityDepositView()).toMatchObject({
    available: true,
    requirements: [],
    events: [],
    inspections: [],
  });
});
it("fails when ledger queries fail", async () => {
  mock.from.mockImplementation((table: string) =>
    query({
      data: table === "security_deposit_settings" ? { id: true } : null,
      error: table === "security_deposit_settings" ? null : { code: "08006" },
    }),
  );
  await expect(getSecurityDepositView()).rejects.toThrow(
    "records could not be loaded",
  );
});

it("settings-only reads do not load rental ledgers or inspection history", async () => {
  mock.from.mockReturnValue(
    query({ data: { id: true, cash_enabled: false }, error: null }),
  );
  expect(await getSecurityDepositSettings()).toMatchObject({
    available: true,
    settings: { id: true },
  });
  expect(mock.from.mock.calls.map((c) => c[0])).toEqual([
    "security_deposit_settings",
  ]);
});
