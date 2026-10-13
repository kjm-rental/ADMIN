import { requireAdmin } from "@/lib/auth";
// Read-only, paginated selects: do not silently truncate reports at Supabase's default row limit.
export async function getOperationsView() {
  const { supabase } = await requireAdmin();
  async function all<T>(
    query: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  ) {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await query(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  }
  const [bookings, payments, units, verifications, holds] = await Promise.all([
    all((a, b) =>
      supabase.from("bookings").select("*").order("id").range(a, b),
    ),
    all((a, b) =>
      supabase.from("payment_events").select("*").order("id").range(a, b),
    ),
    all((a, b) =>
      supabase
        .from("motorcycle_units")
        .select("id,status")
        .is("archived_at", null)
        .order("id")
        .range(a, b),
    ),
    all((a, b) =>
      supabase
        .from("customer_verifications")
        .select("booking_id,overall_status")
        .order("id")
        .range(a, b),
    ),
    all((a, b) =>
      supabase
        .from("booking_inventory_holds")
        .select("motorcycle_unit_id,expires_at,released_at,converted_at")
        .order("id")
        .range(a, b),
    ),
  ]);
  return { bookings, payments, units, verifications, holds };
}
