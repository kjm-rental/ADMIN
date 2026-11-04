import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  connected: false,
  from: vi.fn(),
  units: [] as { id: string; status: string; motorcycle_model_id: string }[],
}));
vi.mock("next/server", () => ({
  connection: async () => {
    m.connected = true;
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => {
    if (!m.connected) throw Error("Clock/session access before request time");
    return { supabase: { from: m.from } };
  },
}));
import FleetDetails from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  m.connected = false;
  m.units = [];
  m.from.mockImplementation((table: string) => {
    const data =
      table === "motorcycle_models"
        ? { id: "model", display_name: "Existing model", archived_at: null }
        : table === "motorcycle_units"
          ? m.units
          : [];
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      order: () => q,
      maybeSingle: () => q,
      in: (_column: string, values: string[]) => {
        if (table === "booking_inventory_holds" && !values.length)
          throw Error("Empty unit filter");
        return q;
      },
      then: (resolve: (result: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve),
    };
    return q;
  });
});
const load = () =>
  FleetDetails({
    params: Promise.resolve({ id: "model" }),
    searchParams: Promise.resolve({}),
  });
it("defers auth and inventory clock work until request time", async () => {
  expect(await load()).toBeTruthy();
  expect(m.connected).toBe(true);
});
it("loads an empty inventory without querying holds with an empty unit filter", async () => {
  expect(await load()).toBeTruthy();
  expect(m.from).not.toHaveBeenCalledWith("booking_inventory_holds");
});
it("continues loading inventory holds for existing units", async () => {
  m.units = [{ id: "unit", status: "available", motorcycle_model_id: "model" }];
  expect(await load()).toBeTruthy();
  expect(m.from).toHaveBeenCalledWith("booking_inventory_holds");
});
