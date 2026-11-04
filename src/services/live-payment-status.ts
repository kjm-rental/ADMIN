import { cache } from "react";
import { requireAdmin } from "@/lib/auth";
export type LiveCheckoutStatus = {
  id: string;
  status: string;
  amount_centavos: number;
  checkout_session_id: string | null;
  checkout_deadline: string;
  provider_status?: string | null;
  provider_checked_at?: string | null;
};
export const getLivePaymentContext = cache(async (bookingId: string) => {
  const { supabase } = await requireAdmin();
  const db = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          key: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error: { code?: string } | null;
          }>;
        };
      };
    };
  };
  const result = await db
    .from("paymongo_live_checkouts")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (result.error) {
    if (["42P01", "PGRST205"].includes(result.error.code ?? "")) return null;
    throw Error("Online payment status could not be loaded.");
  }
  if (!result.data) return null;
  const checkout = result.data as unknown as LiveCheckoutStatus;
  const receipt = await db
    .from("paymongo_live_receipts")
    .select("payment_id,verified_at")
    .eq("checkout_id", checkout.id)
    .maybeSingle();
  if (receipt.error)
    throw Error("Verified payment receipt could not be loaded.");
  return {
    checkout,
    reference: receipt.data?.payment_id as string | undefined,
  };
});
export function livePaymentLabel(checkout: LiveCheckoutStatus) {
  if (checkout.status === "paid") return "Paid — verified";
  if (checkout.status === "review_required")
    return "Payment received — owner review required";
  const known = checkout.provider_checked_at ? checkout.provider_status : null;
  if (known === "failed_unpaid")
    return "Failed — no successful payment verified";
  if (known === "cancelled_unpaid")
    return "Cancelled — no successful payment verified";
  if (known === "expired_unpaid")
    return "Expired — no successful payment verified";
  if (Date.parse(checkout.checkout_deadline) <= Date.now())
    return "Checkout window elapsed — reconciliation required";
  return checkout.status === "prepared"
    ? "Payment not started"
    : "Payment pending";
}
