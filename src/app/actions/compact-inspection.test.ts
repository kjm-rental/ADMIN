import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  lookup: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: mock.session }));
vi.mock("next/cache", () => ({ revalidatePath: mock.refresh }));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
import { recordCompactInspection } from "./compact-inspection";
function form(kind = "handover") {
  const f = new FormData();
  Object.entries({
    bookingId: "10000000-0000-4000-8000-000000000001",
    idempotencyKey: "10000000-0000-4000-8000-000000000002",
    kind,
    odometerKm: "120",
    fuelPercent: "75",
    condition: "good",
    damage: "",
    notes: "",
    extraAccessories: "",
    occurredAt: "",
    accessoriesChecked: "on",
    identityChecked: "on",
  }).forEach(([k, v]) => f.set(k, v));
  f.append("accessories", "Helmet 1");
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.lookup.mockResolvedValue({ data: null, error: null });
  mock.session.mockResolvedValue({
    supabase: {
      rpc: mock.rpc,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: mock.lookup }) }),
      }),
    },
  });
  mock.rpc.mockResolvedValue({ error: null });
});
it("records automatic current time with existing guarded RPC and actual accessories", async () => {
  const start = Date.now();
  await recordCompactInspection(form());
  const args = mock.rpc.mock.calls[0][1];
  expect(args.p_details).toMatchObject({
    odometer_km: 120,
    fuel_percent: 75,
    accessories_notes: "Helmet 1",
    identity_checked: true,
    accessories_checked: true,
    existing_damage_notes: "",
    new_damage_notes: "",
  });
  expect(Date.parse(args.p_details.occurred_at)).toBeGreaterThanOrEqual(start);
  expect(mock.rpc.mock.calls[0][0]).toBe("admin_record_rental_inspection");
  expect(mock.redirect).toHaveBeenCalledWith(
    expect.stringContaining("inspection=handover"),
  );
});
it("denies unauthorized admins without writing", async () => {
  mock.session.mockResolvedValue(null);
  await expect(recordCompactInspection(form())).rejects.toThrow("sign in");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it.each(["fuelPercent", "condition", "identityChecked", "accessoriesChecked"])(
  "requires %s confirmation",
  async (field) => {
    const f = form();
    f.delete(field);
    await expect(recordCompactInspection(f)).rejects.toThrow(
      "required confirmations",
    );
    expect(mock.rpc).not.toHaveBeenCalled();
  },
);
it("requires damage details", async () => {
  const f = form();
  f.set("condition", "damage");
  await expect(recordCompactInspection(f)).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("records return damage without changing money", async () => {
  const f = form("return");
  f.set("condition", "damage");
  f.set("damage", "Mirror scratched");
  await recordCompactInspection(f);
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  expect(mock.rpc.mock.calls[0][1].p_details).toMatchObject({
    new_damage_notes: "Mirror scratched",
    identity_checked: false,
  });
});
it("keeps original actual time and idempotency key on retries", async () => {
  mock.lookup.mockResolvedValue({
    data: { occurred_at: "2026-10-26T06:00:00.000Z" },
    error: null,
  });
  await recordCompactInspection(form());
  expect(mock.rpc.mock.calls[0][1].p_details.occurred_at).toBe(
    "2026-10-26T06:00:00.000Z",
  );
});
it("accepts an explicit Manila time correction", async () => {
  const f = form();
  f.set("occurredAt", "2026-10-26T14:00");
  await recordCompactInspection(f);
  expect(mock.rpc.mock.calls[0][1].p_details.occurred_at).toBe(
    "2026-10-26T06:00:00.000Z",
  );
});
it("does not announce handover or refresh when database guards reject it", async () => {
  mock.rpc.mockResolvedValue({ error: { code: "P0001" } });
  await expect(recordCompactInspection(form())).rejects.toThrow(
    "could not be saved",
  );
  expect(mock.redirect).not.toHaveBeenCalled();
  expect(mock.refresh).not.toHaveBeenCalled();
});

it.each(["fuelPercent", "odometerKm"])(
  "rejects blank %s rather than silently saving zero",
  async (field) => {
    const f = form();
    f.set(field, "");
    await expect(recordCompactInspection(f)).rejects.toThrow();
    expect(mock.rpc).not.toHaveBeenCalled();
  },
);
