import { describe, it, expect } from "vitest";
import { inventorySummary } from "./inventory";
describe("inventory summary", () => {
  it("counts units once when booking and hold reserve the same identity", () => {
    expect(
      inventorySummary(
        [
          { id: "a", status: "available" },
          { id: "b", status: "available" },
        ],
        [{ motorcycle_unit_id: "a", status: "confirmed" }],
        [
          {
            motorcycle_unit_id: "a",
            expires_at: "2030-01-01",
            released_at: null,
            converted_at: null,
          },
        ],
        0,
      ),
    ).toEqual({
      total: 2,
      available: 1,
      reserved: 1,
      rented: 0,
      unavailable: 0,
    });
  });
  it("ignores expired holds and gives active rentals precedence", () => {
    expect(
      inventorySummary(
        [
          { id: "a", status: "available" },
          { id: "b", status: "maintenance" },
        ],
        [
          { motorcycle_unit_id: "a", status: "active" },
          { motorcycle_unit_id: "a", status: "confirmed" },
        ],
        [
          {
            motorcycle_unit_id: "b",
            expires_at: "2000-01-01",
            released_at: null,
            converted_at: null,
          },
        ],
      ),
    ).toEqual({
      total: 2,
      available: 0,
      reserved: 0,
      rented: 1,
      unavailable: 1,
    });
  });
});
