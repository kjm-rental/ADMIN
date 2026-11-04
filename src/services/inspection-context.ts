import { requireAdmin } from "@/lib/auth";
import { depositBalance } from "@/lib/deposit-balances";
import type { getSecurityDepositView } from "./security-deposits";
export type InspectionContext = {
  model: string;
  customer: string;
  reference: string;
  unit: string;
  selectedColor?: string | null;
  plate?: string | null;
  pickup: string;
  latestOdometer: number | null;
  includedAccessories: string[];
  checks: { label: string; ready: boolean; href: string }[];
};
export async function getInspectionContext(
  bookingId: string,
  data: Awaited<ReturnType<typeof getSecurityDepositView>>,
): Promise<InspectionContext> {
  const { supabase } = await requireAdmin();
  const { data: b, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (error || !b) throw Error("Booking information unavailable.");
  const [customer, model, unit, verification, payments, extras] =
    await Promise.all([
      supabase
        .from("customers")
        .select("full_name")
        .eq("id", b.customer_id)
        .single(),
      supabase
        .from("motorcycle_models")
        .select("display_name")
        .eq("id", b.motorcycle_model_id ?? "")
        .maybeSingle(),
      b.motorcycle_unit_id
        ? supabase
            .from("motorcycle_units")
            .select("internal_unit_code,registration_plate,status,archived_at")
            .eq("id", b.motorcycle_unit_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("customer_verifications")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle(),
      supabase
        .from("payment_events")
        .select("event_type,amount_centavos")
        .eq("booking_id", bookingId),
      supabase
        .from("booking_extra_items")
        .select("name_snapshot,quantity")
        .eq("booking_id", bookingId),
    ]);
  if (
    [customer, model, unit, verification, payments, extras].some((r) => r.error)
  )
    throw Error("Handover checks could not be loaded.");
  let latestOdometer: number | null = null;
  if (b.motorcycle_unit_id) {
    const r = await supabase
      .from("rental_inspections")
      .select("odometer_km,bookings!inner(motorcycle_unit_id)")
      .eq("bookings.motorcycle_unit_id", b.motorcycle_unit_id)
      .order("occurred_at", { ascending: false })
      .limit(1);
    if (r.error) throw Error("Odometer reference unavailable.");
    latestOdometer = r.data?.[0]?.odometer_km ?? null;
  }
  const paid = (payments.data ?? []).reduce(
    (sum, e) =>
      sum +
      (e.event_type === "payment" ? e.amount_centavos : -e.amount_centavos),
    0,
  );
  const requirement = data.requirements[0],
    balance = requirement ? depositBalance(requirement, data.events) : null,
    v = verification.data;
  const link = `/dashboard/bookings/${bookingId}#rental-operations`;
  return {
    model: model.data?.display_name ?? "Motorcycle",
    customer: customer.data?.full_name ?? "Customer",
    reference: b.booking_reference,
    unit: unit.data?.internal_unit_code ?? "Not assigned",
    selectedColor: b.selected_color,
    plate: unit.data?.registration_plate ?? null,
    pickup: b.start_at,
    latestOdometer,
    includedAccessories: (extras.data ?? []).flatMap((item) => {
      const name = item.name_snapshot.trim().toLowerCase();
      if (name === "helmet" || name === "helmets")
        return ["Helmet 1", ...(item.quantity >= 2 ? ["Helmet 2"] : [])];
      if (name === "raincoat" || name === "raincoats")
        return ["Raincoat 1", ...(item.quantity >= 2 ? ["Raincoat 2"] : [])];
      if (name === "phone holder") return ["Phone holder"];
      if (name === "top box") return ["Top box"];
      return [];
    }),
    checks: [
      {
        label: "Booking confirmed and rental period valid",
        ready: b.status === "confirmed" && Date.now() < Date.parse(b.end_at),
        href: link,
      },
      { label: "Rental Paid", ready: paid >= b.total_centavos, href: link },
      {
        label: "Deposit Collected",
        ready:
          !!balance &&
          !balance.unresolved &&
          (requirement?.option === "cash"
            ? balance.held >= requirement.required_centavos
            : balance.custody > 0),
        href: link,
      },
      {
        label: "Identity Approved",
        ready:
          v?.overall_status === "approved" && v?.identity_status === "approved",
        href: v
          ? `/dashboard/verifications/${v.id}`
          : "/dashboard/verifications",
      },
      {
        label: "License Approved",
        ready:
          v?.license_status === "approved" &&
          v?.entitlement_status === "approved" &&
          ["approved", "not_applicable"].includes(
            v?.international_status ?? "",
          ) &&
          !!v?.license_expiration_date &&
          v.license_expiration_date >=
            new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
        href: v
          ? `/dashboard/verifications/${v.id}`
          : "/dashboard/verifications",
      },
      {
        label: "Motorcycle Assigned",
        ready:
          !!b.motorcycle_unit_id &&
          unit.data?.status === "available" &&
          !unit.data?.archived_at,
        href: link,
      },
    ],
  };
}
