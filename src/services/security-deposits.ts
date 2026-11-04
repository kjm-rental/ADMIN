import { requireAdmin } from "@/lib/auth";
import { isMissingDepositSchema } from "@/lib/security-deposits";
// Settings pages need one configuration row, never the entire rental ledger.
export async function getSecurityDepositSettings() {
  const { supabase } = await requireAdmin();
  const result = await supabase
    .from("security_deposit_settings")
    .select("*")
    .maybeSingle();
  if (isMissingDepositSchema(result.error))
    return { available: false as const, settings: null };
  if (result.error || !result.data)
    throw Error("Security deposit settings could not be loaded.");
  return { available: true as const, settings: result.data };
}
export async function getSecurityDepositView(bookingId?: string) {
  const { supabase } = await requireAdmin();
  const settings = await supabase
    .from("security_deposit_settings")
    .select("*")
    .maybeSingle();
  if (isMissingDepositSchema(settings.error))
    return {
      available: false as const,
      settings: null,
      requirements: [],
      events: [],
      inspections: [],
    };
  if (settings.error || !settings.data)
    throw Error("Security deposit settings could not be loaded.");
  async function all<T>(
    make: (
      a: number,
      b: number,
    ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ) {
    const rows: T[] = [];
    for (let a = 0; ; a += 1000) {
      const { data, error } = await make(a, a + 999);
      if (error) throw Error("Security deposit records could not be loaded.");
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  }
  const [requirements, events, inspections] = await Promise.all([
    all((a, b) => {
      let q = supabase.from("booking_deposits").select("*").order("booking_id");
      if (bookingId) q = q.eq("booking_id", bookingId);
      return q.range(a, b);
    }),
    all((a, b) => {
      let q = supabase
        .from("security_deposit_events")
        .select("*")
        .order("sequence");
      if (bookingId) q = q.eq("booking_id", bookingId);
      return q.range(a, b);
    }),
    all((a, b) => {
      let q = supabase.from("rental_inspections").select("*").order("id");
      if (bookingId) q = q.eq("booking_id", bookingId);
      return q.range(a, b);
    }),
  ]);
  return {
    available: true as const,
    settings: settings.data,
    requirements,
    events,
    inspections,
  };
}
