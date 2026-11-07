import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkedQueries } from "@/lib/query-results";
import { contractTerms, ContractUnavailable } from "@/lib/contracts/terms";
export async function loadRentalContract(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw Error("Contract records could not be loaded.");
  if (!booking) return null;
  const [
    customer,
    model,
    unit,
    extras,
    services,
    deposit,
    payments,
    acceptance,
    signature,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("full_name,email,phone,country_of_residence")
      .eq("id", booking.customer_id)
      .single(),
    booking.motorcycle_model_id
      ? supabase
          .from("motorcycle_models")
          .select("display_name")
          .eq("id", booking.motorcycle_model_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    booking.motorcycle_unit_id
      ? supabase
          .from("motorcycle_units")
          .select("registration_plate,color,internal_unit_code")
          .eq("id", booking.motorcycle_unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("booking_extra_items")
      .select("name_snapshot,quantity,line_total_centavos")
      .eq("booking_id", id)
      .order("created_at"),
    supabase
      .from("booking_services")
      .select("*")
      .eq("booking_id", id)
      .maybeSingle(),
    supabase
      .from("booking_deposits")
      .select("*")
      .eq("booking_id", id)
      .maybeSingle(),
    supabase
      .from("payment_events")
      .select("event_type,amount_centavos")
      .eq("booking_id", id),
    supabase
      .from("booking_terms_acceptances")
      .select("terms_version,source_sha256,accepted_at")
      .eq("booking_id", id)
      .maybeSingle(),
    supabase
      .from("booking_electronic_signatures")
      .select("signature_name,signature_strokes,terms_version,signed_at,method")
      .eq("booking_id", id)
      .maybeSingle(),
  ]).then(checkedQueries);
  if (!customer.data)
    throw new ContractUnavailable("The renter details are unavailable.");
  const versionQuery = supabase.from("rental_terms_versions").select("*");
  const version = acceptance.data
    ? await versionQuery.eq("version", acceptance.data.terms_version).single()
    : await versionQuery.eq("is_current", true).single();
  if (version.error || !version.data)
    throw new ContractUnavailable("The original rental terms are unavailable.");
  const terms = contractTerms(
    version.data.version,
    version.data.source_sha256,
    acceptance.data?.source_sha256,
  );
  return {
    booking,
    customer: customer.data,
    model: model.data,
    unit: unit.data,
    extras: extras.data ?? [],
    services: services.data,
    deposit: deposit.data,
    payments: payments.data ?? [],
    acceptance: acceptance.data,
    signature: signature.data,
    terms,
  };
}
export type RentalContractData = NonNullable<
  Awaited<ReturnType<typeof loadRentalContract>>
>;
