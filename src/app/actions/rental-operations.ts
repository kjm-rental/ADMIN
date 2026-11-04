"use server";
import { AdminActionError } from "@/lib/admin-action-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getFreshAdminSession } from "@/lib/auth";
export async function confirmRentalOperation(form: FormData) {
  const session = await getFreshAdminSession();
  if (!session)
    throw new AdminActionError(
      "Please sign in again as an active administrator.",
    );
  const d = z
    .object({
      bookingId: z.uuid(),
      idempotencyKey: z.uuid(),
      operation: z.enum([
        "rental_payment",
        "deposit_collection",
        "deposit_refund",
      ]),
      expectedCentavos: z.coerce.number().int().positive().max(2147483647),
      confirmed: z.literal("yes"),
    })
    .parse(Object.fromEntries(form));
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { code?: string; message?: string } | null }>;
  const { error } = await rpc("admin_confirm_rental_cash_operation", {
    p_booking_id: d.bookingId,
    p_operation: d.operation,
    p_expected_centavos: d.expectedCentavos,
    p_idempotency_key: d.idempotencyKey,
    p_confirmed: true,
  });
  if (error) {
    // Never log SQL text, customer details, credentials or provider payloads.
    console.error("Rental cash operation failed", {
      operation: d.operation,
      code: error.code ?? "transport_error",
    });
    if (error.code === "PGRST202" || error.code === "42883")
      throw new AdminActionError(
        "Cash recording is temporarily unavailable. No transaction was recorded. Please contact your administrator before retrying.",
      );
    // A timeout can occur after commit. Reconcile the immutable event using the
    // same booking and idempotency key before deciding whether receipt failed.
    const table =
      d.operation === "rental_payment"
        ? "payment_events"
        : "security_deposit_events";
    const expectedType =
      d.operation === "rental_payment"
        ? "payment"
        : d.operation === "deposit_collection"
          ? "cash_collected"
          : "cash_returned";
    const { data: saved, error: lookupError } = await session.supabase
      .from(table)
      .select("booking_id,event_type,amount_centavos")
      .eq("booking_id", d.bookingId)
      .eq("idempotency_key", d.idempotencyKey)
      .maybeSingle();
    if (lookupError)
      throw new AdminActionError(
        "Payment status could not be confirmed. Refresh the booking before retrying.",
      );
    if (
      !saved ||
      saved.event_type !== expectedType ||
      saved.amount_centavos !== d.expectedCentavos
    ) {
      const message = error.message ?? "";
      if (
        /Balance changed|Deposit balance changed|already collected/i.test(
          message,
        )
      )
        throw new AdminActionError(
          "The balance has changed or this transaction has already been recorded. Refresh the booking before retrying.",
        );
      if (error.code === "P0001")
        throw new AdminActionError(
          "Unable to save this transaction. Refresh the booking and check its balance, status and required inspection before trying again.",
        );
      throw new AdminActionError(
        "Payment status could not be confirmed. Refresh the booking before retrying.",
      );
    }
    // Matching saved event proves the original operation committed successfully.
  }
  for (const path of [
    `/dashboard/bookings/${d.bookingId}`,
    "/dashboard/finance",
    "/dashboard/deposits",
    "/dashboard",
  ])
    revalidatePath(path);
}
