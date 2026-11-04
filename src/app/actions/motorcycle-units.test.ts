import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  refresh: vi.fn(),
  result: {
    error: null as null | { code: string },
    data: { id: "10000000-0000-4000-8000-000000000003" },
  },
  writes: [] as { table: string; value: Record<string, unknown> }[],
  existing: {
    registration_plate: null as string | null,
    color: null as string | null,
  },
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { saveMotorcycleUnit } from "./motorcycle-units";
const model = "10000000-0000-4000-8000-000000000001";
const unit = "10000000-0000-4000-8000-000000000002";
function form(plate: string, color: string, id?: string) {
  const f = new FormData();
  f.set("modelId", model);
  f.set("plate", plate);
  f.set("color", color);
  if (id) f.set("unitId", id);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.writes = [];
  m.result = { error: null, data: { id: unit } };
  m.existing = { registration_plate: null, color: null };
  m.from.mockImplementation((table: string) => {
    let mutation = false;
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      is: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: { id: model }, error: null })),
      single: vi.fn(async () =>
        mutation
          ? m.result
          : { data: { id: unit, ...m.existing }, error: null },
      ),
      insert: vi.fn((value: Record<string, unknown>) => {
        mutation = true;
        m.writes.push({ table, value });
        return q;
      }),
      update: vi.fn((value: Record<string, unknown>) => {
        mutation = true;
        m.writes.push({ table, value });
        return q;
      }),
      then: (resolve: (r: unknown) => void) => resolve({ error: null }),
    };
    return q;
  });
  m.auth.mockResolvedValue({ user: { id: unit }, supabase: { from: m.from } });
});
it("creates one explicitly entered unit with uppercase plate and combined color", async () => {
  await saveMotorcycleUnit(form("  test-123  ", " white/black "));
  expect(m.writes[0]).toMatchObject({
    table: "motorcycle_units",
    value: {
      motorcycle_model_id: model,
      registration_plate: "TEST-123",
      color: "White / Black",
      status: "available",
    },
  });
  expect(m.writes.filter((w) => w.table === "motorcycle_units")).toHaveLength(
    1,
  );
});
it.each([
  ["", "Black"],
  ["TEST-123", ""],
  ["<script>", "Black"],
  ["TEST-123", "<script>"],
])("rejects missing/invalid new fields (%s, %s)", async (plate, color) => {
  await expect(saveMotorcycleUnit(form(plate, color))).rejects.toThrow();
  expect(m.writes).toHaveLength(0);
});
it("reports a database uniqueness conflict clearly without claiming success", async () => {
  m.result.error = { code: "23505" };
  await expect(saveMotorcycleUnit(form("TEST-123", "Black"))).rejects.toThrow(
    "already registered",
  );
  expect(m.refresh).not.toHaveBeenCalled();
});
it("edits in place and never touches booking assignments", async () => {
  m.existing = { registration_plate: "TEST-OLD", color: "Black" };
  await saveMotorcycleUnit(form("test-new", "matte black / blue", unit));
  expect(m.writes[0].value).toEqual({
    registration_plate: "TEST-NEW",
    color: "Matte Black / Blue",
  });
  expect(m.writes.map((w) => w.table)).toEqual([
    "motorcycle_units",
    "audit_logs",
  ]);
});
it("preserves incomplete legacy fields and unchanged legacy plate formatting", async () => {
  await saveMotorcycleUnit(form("", "", unit));
  expect(m.writes[0].value).toEqual({ registration_plate: null, color: null });
  m.existing.registration_plate = " legacy plate ";
  await saveMotorcycleUnit(form(" legacy plate ", "Green", unit));
  expect(m.writes[2].value.registration_plate).toBe(" legacy plate ");
});
it("requires administrator authorization before accessing inventory", async () => {
  m.auth.mockRejectedValue(Error("Administrator access required"));
  await expect(saveMotorcycleUnit(form("TEST-123", "Black"))).rejects.toThrow(
    "Administrator",
  );
  expect(m.from).not.toHaveBeenCalled();
});
