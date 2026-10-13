import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  new URL(
    "../../../KJM MAIN/supabase/migrations/202610100019_quantity_managed_motorcycle_inventory.sql",
    import.meta.url,
  ),
  "utf8",
);
describe("quantity migration security contract (static)", () => {
  it("requires administrator verification and detects stale quantities", () => {
    expect(sql).toContain("private.is_active_admin()");
    expect(sql).toContain("current_total<>p_expected_total");
    expect(sql).toContain("set search_path=''");
    expect(sql).toContain("from public,anon");
  });
  it("serializes commitment changes and retains assigned units", () => {
    for (const table of [
      "bookings",
      "booking_inventory_holds",
      "motorcycle_units",
      "motorcycle_unavailability",
    ])
      expect(sql).toContain(`lock table public.${table}`);
    expect(sql).toContain("'submitted','pending','confirmed','active'");
    expect(sql).toContain("h.expires_at>now()");
    expect(sql).toContain("x.end_at>now()");
    expect(sql).toContain("archived_at=now()");
    expect(sql).not.toMatch(
      /delete\s+from|truncate|disable row level security/i,
    );
    expect(sql).toContain("'KJM-'||unit_id::text,null,'available'");
  });
});
