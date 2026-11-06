import { beforeEach, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadRentalContract } from "./rental-contract";
import { sampleRentalContract } from "@/lib/contracts/fixture";
let tables: Record<string, Record<string, unknown>[]>;
let failed: string;
let filters: [string, string, unknown][];
function db() {
  return {
    from(table: string) {
      let rows = tables[table] ?? [],
        single = false;
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          filters.push([table, key, value]);
          rows = rows.filter((row) => row[key] === value);
          return q;
        },
        order: () => q,
        single: () => {
          single = true;
          return q;
        },
        maybeSingle: () => {
          single = true;
          return q;
        },
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            data: single ? (rows[0] ?? null) : rows,
            error: failed === table ? { message: "database error" } : null,
          }).then(resolve),
      };
      return q;
    },
  } as unknown as SupabaseClient<Database>;
}
beforeEach(() => {
  const sample = sampleRentalContract(),
    id = sample.booking.id;
  failed = "";
  filters = [];
  tables = {
    bookings: [sample.booking],
    customers: [{ id, ...sample.customer }],
    motorcycle_models: [{ id, ...sample.model }],
    motorcycle_units: [{ id, ...sample.unit }],
    booking_extra_items: sample.extras.map((e) => ({ ...e, booking_id: id })),
    booking_services: [sample.services!],
    booking_deposits: [sample.deposit!],
    payment_events: sample.payments.map((e) => ({ ...e, booking_id: id })),
    booking_terms_acceptances: [{ booking_id: id, ...sample.acceptance }],
    rental_terms_versions: [
      {
        version: sample.terms.version,
        source_sha256: sample.terms.sourceSha256,
        is_current: false,
      },
    ],
  };
});
it("uses the immutable accepted version even when it is not current", async () => {
  const result = await loadRentalContract(
    db(),
    sampleRentalContract().booking.id,
  );
  expect(result?.acceptance?.terms_version).toBe("2026-10-12");
  expect(result?.booking.total_centavos).toBe(131900);
  expect(filters).toContainEqual([
    "rental_terms_versions",
    "version",
    "2026-10-12",
  ]);
  expect(filters).not.toContainEqual([
    "rental_terms_versions",
    "is_current",
    true,
  ]);
});
it("loads current terms only for an explicitly unaccepted draft", async () => {
  tables.booking_terms_acceptances = [];
  tables.rental_terms_versions[0].is_current = true;
  const result = await loadRentalContract(
    db(),
    sampleRentalContract().booking.id,
  );
  expect(result?.acceptance).toBeNull();
  expect(filters).toContainEqual(["rental_terms_versions", "is_current", true]);
});
it("does not invent missing acceptance or financial data after a query failure", async () => {
  failed = "booking_terms_acceptances";
  await expect(
    loadRentalContract(db(), sampleRentalContract().booking.id),
  ).rejects.toThrow();
});
it("refuses an acceptance hash mismatch", async () => {
  tables.booking_terms_acceptances[0].source_sha256 = "a".repeat(64);
  await expect(
    loadRentalContract(db(), sampleRentalContract().booking.id),
  ).rejects.toThrow("original terms");
});
it("returns no document for an unknown booking", async () => {
  tables.bookings = [];
  expect(
    await loadRentalContract(db(), sampleRentalContract().booking.id),
  ).toBeNull();
  expect(filters).toHaveLength(1);
});
