"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFreshAdminSession } from "@/lib/auth";
import { AdminActionError } from "@/lib/admin-action-error";
import { compactInspectionValues } from "@/lib/inspection-form";
import { businessTimestamp } from "@/lib/business-time";
export async function recordCompactInspection(form: FormData) {
  const session = await getFreshAdminSession();
  if (!session)
    throw new AdminActionError(
      "Please sign in again as an active administrator.",
    );
  let d;
  try {
    d = compactInspectionValues(form);
  } catch {
    throw new AdminActionError(
      "Check the odometer, fuel, condition and required confirmations before saving.",
    );
  }
  const conditionNotes =
    (d.condition === "good"
      ? "Good condition — checked by administrator."
      : "Damage or safety concern: " + d.damage) +
    (d.notes ? "\n" + d.notes : "");
  const accessoriesNotes =
    [
      ...d.accessories,
      ...(d.extraAccessories ? [d.extraAccessories] : []),
    ].join(", ") ||
    "No accessories handed over or returned — explicitly checked.";
  // Reuse the recorded instant on retries so the immutable RPC fingerprint is stable.
  const { data: prior, error: lookupError } = await session.supabase
    .from("rental_inspections")
    .select("*")
    .eq("idempotency_key", d.idempotencyKey)
    .maybeSingle();
  if (lookupError)
    throw new AdminActionError(
      "Inspection status could not be confirmed. Refresh the booking before retrying.",
    );
  const occurredAt = d.occurredAt
    ? businessTimestamp(d.occurredAt)
    : (prior?.occurred_at ?? new Date().toISOString());
  const details = {
    occurred_at: occurredAt,
    odometer_km: d.odometerKm,
    fuel_percent: d.fuelPercent,
    condition_notes: conditionNotes,
    accessories_notes: accessoriesNotes,
    existing_damage_notes:
      d.kind === "handover" && d.condition === "damage" ? d.damage : "",
    new_damage_notes:
      d.kind === "return" && d.condition === "damage" ? d.damage : "",
    identity_checked: d.kind === "handover",
    accessories_checked: true,
  };
  const { error } = await session.supabase.rpc(
    "admin_record_rental_inspection",
    {
      p_booking_id: d.bookingId,
      p_kind: d.kind,
      p_idempotency_key: d.idempotencyKey,
      p_details: details,
    },
  );
  if (error) {
    console.error("Inspection recording failed", {
      code: error.code,
      kind: d.kind,
    });
    throw new AdminActionError(
      "Inspection could not be saved. Refresh the booking and check the required payment, deposit and document approvals before retrying.",
    );
  }
  revalidatePath(`/dashboard/bookings/${d.bookingId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/bookings/${d.bookingId}?inspection=${d.kind}`);
}
