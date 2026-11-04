import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  calls: [] as unknown[][],
  rows: {} as Record<string, unknown[]>,
  failed: "",
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: m.session }));
import { getManualBookingUnits } from "./manual-booking-units";
const input = {
  modelId: "10000000-0000-4000-8000-000000000001",
  startAt: "2035-01-01T09:00",
  endAt: "2035-01-02T09:00",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.calls = [];
  m.failed = "";
  m.rows = {
    motorcycle_units: [1, 2, 3, 4].map((n) => ({
      id: `unit-${n}`,
      internal_unit_code: `Code ${n}`,
      registration_plate: `Plate ${n}`,
      color: n === 4 ? "white/black" : "Green",
    })),
    bookings: [],
    booking_inventory_holds: [],
    motorcycle_unavailability: [],
  };
  m.from.mockImplementation((table: string) => {
    const q: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "is",
      "order",
      "in",
      "lt",
      "gt",
      "neq",
    ])
      q[method] = (...args: unknown[]) => {
        m.calls.push([table, method, ...args]);
        return q;
      };
    q.then = (resolve: (r: unknown) => unknown) =>
      Promise.resolve({
        data: m.rows[table] ?? [],
        error: m.failed === table ? { message: "private failure" } : null,
      }).then(resolve);
    return q;
  });
  m.session.mockResolvedValue({ supabase: { from: m.from } });
});
it("loads real colors and plates without customer details or a pricing quote", async () => {
  const result = await getManualBookingUnits(input);
  expect(result.error).toBeUndefined();
  expect(result.units).toHaveLength(4);
  expect(result.units[3]).toMatchObject({
    color: "White / Black",
    plate: "Plate 4",
  });
  expect(m.calls).toContainEqual([
    "motorcycle_units",
    "eq",
    "status",
    "available",
  ]);
  expect(m.calls).toContainEqual([
    "motorcycle_units",
    "is",
    "archived_at",
    null,
  ]);
});
it("excludes booked, held and maintenance units while retaining another available unit of the same color", async () => {
  m.rows.bookings = [{ motorcycle_unit_id: "unit-1" }];
  m.rows.booking_inventory_holds = [{ motorcycle_unit_id: "unit-2" }];
  m.rows.motorcycle_unavailability = [{ motorcycle_unit_id: "unit-4" }];
  expect((await getManualBookingUnits(input)).units.map((u) => u.id)).toEqual([
    "unit-3",
  ]);
  expect(m.calls).toContainEqual([
    "bookings",
    "lt",
    "start_at",
    "2035-01-02T01:00:00.000Z",
  ]);
  expect(m.calls).toContainEqual([
    "bookings",
    "gt",
    "end_at",
    "2035-01-01T01:00:00.000Z",
  ]);
  expect(m.calls).toContainEqual([
    "booking_inventory_holds",
    "is",
    "released_at",
    null,
  ]);
  expect(m.calls).toContainEqual([
    "booking_inventory_holds",
    "is",
    "converted_at",
    null,
  ]);
  expect(
    m.calls.some(
      (c) =>
        c[0] === "booking_inventory_holds" &&
        c[1] === "gt" &&
        c[2] === "expires_at",
    ),
  ).toBe(true);
});
it("excludes an edited booking's own reservation/hold from conflicts", async () => {
  const bookingId = "10000000-0000-4000-8000-000000000002";
  await getManualBookingUnits({ ...input, bookingId });
  expect(m.calls).toContainEqual(["bookings", "neq", "id", bookingId]);
  expect(m.calls).toContainEqual([
    "booking_inventory_holds",
    "neq",
    "booking_id",
    bookingId,
  ]);
});
it("requires a fresh admin session and valid dates", async () => {
  m.session.mockResolvedValueOnce(null);
  expect((await getManualBookingUnits(input)).error).toContain("administrator");
  expect(
    (await getManualBookingUnits({ ...input, endAt: input.startAt })).error,
  ).toContain("24 hours");
  expect(m.from).not.toHaveBeenCalled();
});
it("handles empty inventory and database errors without inventing colors", async () => {
  m.rows.motorcycle_units = [];
  expect(await getManualBookingUnits(input)).toEqual({ units: [] });
  expect(m.from).toHaveBeenCalledTimes(1);
  m.failed = "motorcycle_units";
  const result = await getManualBookingUnits(input);
  expect(result.units).toEqual([]);
  expect(result.error).not.toContain("private failure");
});
