import { requireAdmin } from "@/lib/auth";
export async function getGatewayFees() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("payment_gateway_fee_settings")
    .select("*")
    .order("provider")
    .order("payment_method");
  if (error && ["42P01", "PGRST205"].includes(error.code))
    return { available: false as const, fees: [] };
  if (error) throw new Error("Gateway fee settings could not be loaded.");
  return { available: true as const, fees: data ?? [] };
}
