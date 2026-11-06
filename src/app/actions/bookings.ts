"use server";
import { businessTimestamp } from "@/lib/business-time";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, getFreshAdminSession } from "@/lib/auth";

export async function recordOfflinePayment(formData: FormData) {
  const d = z
    .object({
      bookingId: z.uuid(),
      amountPhp: z.coerce.number().positive().multipleOf(0.01),
      method: z.literal("cash"),
      transactionReference: z.string().trim().max(200).optional(),
      paidAt: z.string().min(1),
      notes: z.string().trim().max(2000).optional(),
      idempotencyKey: z.uuid(),
    })
    .parse(Object.fromEntries(formData));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_record_offline_payment", {
    p_booking_id: d.bookingId,
    p_amount_centavos: Math.round(d.amountPhp * 100),
    p_method: d.method,
    p_transaction_reference: d.transactionReference || null,
    p_paid_at: businessTimestamp(d.paidAt),
    p_notes: d.notes || null,
    p_idempotency_key: d.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/bookings/${d.bookingId}`);
  redirect(`/dashboard/bookings/${d.bookingId}?payment=1`);
}

export async function recordPaymentAdjustment(formData: FormData) {
  const d = z
    .object({
      bookingId: z.uuid(),
      originalPaymentEventId: z.uuid(),
      operation: z.enum(["refund", "reversal"]),
      amountPhp: z.coerce.number().positive().multipleOf(0.01),
      method: z.enum(["cash", "bank_transfer", "other_offline"]),
      transactionReference: z.string().trim().min(1).max(200),
      occurredAt: z.string().min(1),
      reason: z.string().trim().min(5).max(2000),
      idempotencyKey: z.uuid(),
    })
    .parse(Object.fromEntries(formData));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_record_payment_adjustment", {
    p_original_payment_event_id: d.originalPaymentEventId,
    p_operation: d.operation,
    p_amount_centavos: Math.round(d.amountPhp * 100),
    p_method: d.method,
    p_transaction_reference: d.transactionReference,
    p_occurred_at: businessTimestamp(d.occurredAt),
    p_reason: d.reason,
    p_idempotency_key: d.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/bookings/${d.bookingId}`);
  redirect(`/dashboard/bookings/${d.bookingId}?payment=1`);
}

export async function reviewVerification(formData: FormData) {
  const d = z
    .object({
      verificationId: z.uuid(),
      bookingId: z.uuid(),
      reviewType: z.enum([
        "identity",
        "license",
        "entitlement",
        "international",
      ]),
      result: z.enum([
        "under_review",
        "approved",
        "rejected",
        "resubmission_required",
      ]),
      reason: z.string().trim().max(2000).optional(),
    })
    .parse(Object.fromEntries(formData));
  if (["rejected", "resubmission_required"].includes(d.result) && !d.reason)
    throw new Error("A review reason is required.");
  const session = await getFreshAdminSession();
  if (!session) throw new Error("Active administrator access required.");
  const { supabase } = session;
  const expected = {
    identity: 4,
    license: 5,
    entitlement: 2,
    international: 4,
  }[d.reviewType];
  if (
    d.result === "approved" &&
    !Array.from({ length: expected }, (_, i) => String(i)).every((value) =>
      formData.getAll("reviewEvidence").includes(value),
    )
  )
    throw new Error(
      "Confirm every authenticity, ownership and license review requirement before approval.",
    );
  const { error } = await supabase.rpc("admin_review_verification", {
    p_verification_id: d.verificationId,
    p_review_type: d.reviewType,
    p_result: d.result,
    p_reason:
      d.result === "approved"
        ? `${
            {
              identity:
                "Authorized reviewer confirmed document authenticity, identity ownership, name consistency and document validity.",
              license:
                "Authorized reviewer checked the original license, customer ownership, required sides, validity and motorcycle rental requirements.",
              entitlement:
                "Authorized reviewer confirmed readable categories and legal eligibility for this customer to ride the booked motorcycle.",
              international:
                "Authorized reviewer confirmed required international documents, matching identity, validity and applicable international riding eligibility.",
            }[d.reviewType]
          }${d.reason ? ` Customer feedback: ${d.reason}` : ""}`.slice(0, 2000)
        : d.reason || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/bookings/${d.bookingId}`);
  revalidatePath(`/dashboard/verifications/${d.verificationId}`);
  revalidatePath("/dashboard/verifications");
  redirect(`/dashboard/verifications/${d.verificationId}?reviewed=1`);
}
export async function confirmBooking(formData: FormData) {
  const d = z
    .object({ bookingId: z.uuid(), unitId: z.uuid() })
    .parse(Object.fromEntries(formData));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_confirm_booking", {
    p_booking_id: d.bookingId,
    p_unit_id: d.unitId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/bookings/${d.bookingId}?updated=1`);
}
export async function transitionBooking(formData: FormData) {
  const d = z
    .object({
      bookingId: z.uuid(),
      status: z.enum(["rejected", "cancelled", "active", "completed"]),
      reason: z.string().trim().max(2000).optional(),
    })
    .parse(Object.fromEntries(formData));
  const { supabase } = await requireAdmin();
  if (["rejected", "cancelled"].includes(d.status) && !d.reason)
    throw new Error("A rejection or cancellation reason is required.");
  const { error } = await supabase.rpc("admin_transition_booking_with_reason", {
    p_booking_id: d.bookingId,
    p_new_status: d.status,
    p_reason: d.reason || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/bookings/${d.bookingId}?updated=1`);
}

export async function rescheduleBooking(formData: FormData) {
  const d = z
    .object({
      bookingId: z.uuid(),
      startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      endAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      unitId: z.union([z.literal(""), z.uuid()]).optional(),
    })
    .parse(Object.fromEntries(formData));
  const startAt = businessTimestamp(d.startAt);
  const endAt = businessTimestamp(d.endAt);
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reschedule_booking", {
    p_booking_id: d.bookingId,
    p_start_at: startAt,
    p_end_at: endAt,
    p_unit_id: d.unitId || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/bookings/${d.bookingId}?updated=1`);
}

export async function recordPickupInstructions(formData: FormData) {
  const d = z
    .object({
      bookingId: z.uuid(),
      location: z.string().trim().min(1).max(1000),
      instructions: z.string().trim().min(1).max(2000),
    })
    .parse(Object.fromEntries(formData));
  const { supabase } = await requireAdmin();
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: unknown }>;
  const { error } = await rpc("admin_record_pickup_instructions", {
    p_booking: d.bookingId,
    p_location: d.location,
    p_instructions: d.instructions,
  });
  if (error)
    throw new Error(
      "Pickup instructions could not be recorded. Check notification migration 031 and your reviewer access.",
    );
  revalidatePath(`/dashboard/bookings/${d.bookingId}`);
}
