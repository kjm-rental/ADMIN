"use server";
import { revalidatePath } from "next/cache";
import { getFreshAdminSession } from "@/lib/auth";
import { gatewayFeeInput } from "@/lib/gateway-fees";
export async function saveGatewayFee(data: FormData) {
  const session = await getFreshAdminSession();
  if (!session) throw new Error("Administrator access required.");
  const parsed = gatewayFeeInput.safeParse(Object.fromEntries(data));
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? "Review the gateway fee fields.",
    );
  const v = parsed.data;
  const { error } = await session.supabase.rpc(
    "admin_save_payment_gateway_fee",
    {
      p_provider: v.provider,
      p_payment_method: v.paymentMethod,
      p_percentage_basis_points: v.percentage,
      p_flat_fee_centavos: v.flatFeePhp,
      p_notes: v.notes,
    },
  );
  if (error)
    throw new Error(
      "Gateway fee settings could not be saved. Check database setup and try again.",
    );
  revalidatePath("/dashboard/settings");
}
