import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { inventorySummary } from "./inventory";
const sql = readFileSync(
  "docs/migrations/202610300040_motorcycle_unit_removal.prepared.sql",
  "utf8",
);
it("requires admin authorization and grants only the guarded RPC to authenticated users", () => {
  expect(sql).toContain("auth.uid() is null or not private.is_active_admin()");
  expect(sql).toContain(
    "grant execute on function public.admin_manage_motorcycle_unit(uuid,uuid,text,text) to authenticated",
  );
  expect(sql).toContain("from public,anon,authenticated,service_role");
});
it("serializes with inventory locks and prevents races across ALL foreign key references", () => {
  expect(sql).toContain(
    "pg_try_advisory_xact_lock(hashtextextended(p_model_id::text,0))",
  );
  expect(sql).toContain(
    "pg_try_advisory_xact_lock(hashtextextended(p_unit_id::text,0))",
  );
  expect(sql).toContain("for update nowait");
  expect(sql).toContain("pg_catalog.pg_constraint");
  expect(sql).toContain("share row exclusive mode nowait");
  expect(sql).toContain("unnest(fk.conkey,fk.confkey)");
  expect(sql).toContain(
    "before delete or update of status on public.motorcycle_units",
  );
});
it("protects dependency/history and never deletes cascading children or changes bookings", () => {
  expect(sql).toContain("private.motorcycle_unit_has_history(u.id)");
  expect(sql).toContain("a.metadata->>'old_unit'=p_unit::text");
  expect(sql).toContain("delete from public.motorcycle_units where id=u.id");
  expect(sql).not.toMatch(
    /(?:delete from|update|insert into) public\.(?:bookings|booking_inventory_holds|rental_inspections|payment_events)\b/i,
  );
  expect(sql).not.toMatch(/\bcascade\s*;/i);
  expect(sql).not.toContain("set registration_plate");
  expect(sql).not.toContain("set color");
});
it("blocks unresolved bookings, live holds and model-level demand before deactivation", () => {
  expect(sql).toContain(
    "b.status in ('submitted','pending','confirmed','active')",
  );
  expect(sql).toContain(
    "h.released_at is null and h.converted_at is null and h.expires_at>now()",
  );
  expect(sql).toContain("b.motorcycle_unit_id is null");
  expect(sql).toContain("return jsonb_build_object('outcome','blocked')");
  expect(sql).toContain("when 'deactivate' then 'inactive' else 'available'");
});
it("keeps deactivated units in the inventory count but excludes them from available count", () => {
  expect(
    inventorySummary([{ id: "unit", status: "inactive" }], [], []),
  ).toMatchObject({ total: 1, available: 0, unavailable: 1 });
  expect(
    inventorySummary([{ id: "unit", status: "available" }], [], []),
  ).toMatchObject({ total: 1, available: 1, unavailable: 0 });
  expect(inventorySummary([], [], [])).toMatchObject({
    total: 0,
    available: 0,
  });
});
