"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getFreshAdminSession } from "@/lib/auth";
import { businessTimestamp } from "@/lib/business-time";
const centavos = (value: unknown) => {
  const text = String(value ?? "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw Error("Enter a valid PHP amount with at most two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 2147483647)
    throw Error("Amount exceeds the supported centavo range.");
  return amount;
};
async function activeAdmin() {
  const session = await getFreshAdminSession();
  if (!session) throw Error("Active administrator authorization required.");
  return session;
}
function refresh(bookingId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposits");
  revalidatePath("/dashboard/finance");
  if (bookingId) revalidatePath(`/dashboard/bookings/${bookingId}`);
}
export async function saveSecurityDepositSettings(data: FormData) {
  const { supabase } = await activeAdmin();
  const text = (key: string) =>
    z
      .string()
      .trim()
      .max(4000)
      .parse(data.get(key) ?? "");
  const types = [
    ...new Set(
      text("acceptedDocumentTypes")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const amount = data.get("cashAmountPhp");
  const { error } = await supabase.rpc("admin_save_security_deposit_settings", {
    p_settings: {
      cash_enabled: data.get("cashEnabled") === "on",
      cash_amount_centavos: amount ? centavos(amount) : null,
      cash_policy_approved: data.get("cashPolicyApproved") === "on",
      id_enabled: data.get("idEnabled") === "on",
      id_legal_approved: data.get("idLegalApproved") === "on",
      id_legal_reference: text("legalReference"),
      accepted_document_types: types,
      collection_instructions: text("collectionInstructions"),
      return_instructions: text("returnInstructions"),
      dispute_instructions: text("disputeInstructions"),
      partial_cash_return_allowed: data.get("partialReturns") === "on",
    },
  });
  if (error) throw Error(error.message);
  revalidatePath("/dashboard/settings");
  refresh();
}
export async function recordSecurityDepositEvent(data: FormData) {
  const d = z
    .object({
      bookingId: z.uuid(),
      eventType: z.enum([
        "cash_collected",
        "cash_returned",
        "id_received",
        "id_returned",
        "case_opened",
        "case_resolved",
      ]),
      occurredAt: z.string(),
      notes: z.string().max(2000),
      idempotencyKey: z.uuid(),
      verified: z.literal("on"),
    })
    .parse(Object.fromEntries(data));
  const { supabase } = await activeAdmin();
  const amount = centavos(data.get("amountPhp") || "0");
  const { error } = await supabase.rpc("admin_record_security_deposit_event", {
    p_booking_id: d.bookingId,
    p_event_type: d.eventType,
    p_amount_centavos: amount,
    p_occurred_at: businessTimestamp(d.occurredAt),
    p_notes: d.notes,
    p_idempotency_key: d.idempotencyKey,
    p_verified: true,
  });
  if (error) throw Error(error.message);
  refresh(d.bookingId);
}
export async function recordRentalInspection(data: FormData) {
  const d = z
    .object({
      bookingId: z.uuid(),
      kind: z.enum(["handover", "return"]),
      occurredAt: z.string(),
      odometerKm: z.coerce.number().int().nonnegative().max(2147483647),
      fuelPercent: z.coerce.number().int().min(0).max(100),
      conditionNotes: z.string().trim().min(1).max(2000),
      accessoriesNotes: z.string().trim().min(1).max(2000),
      existingDamageNotes: z.string().max(2000),
      newDamageNotes: z.string().max(2000),
      accessoriesChecked: z.literal("on"),
      idempotencyKey: z.uuid(),
    })
    .parse(Object.fromEntries(data));
  const identity = data.get("identityChecked") === "on";
  if (d.kind === "handover" && !identity)
    throw Error("Confirm customer identity and driving eligibility.");
  const { supabase } = await activeAdmin();
  const { error } = await supabase.rpc("admin_record_rental_inspection", {
    p_booking_id: d.bookingId,
    p_kind: d.kind,
    p_idempotency_key: d.idempotencyKey,
    p_details: {
      occurred_at: businessTimestamp(d.occurredAt),
      odometer_km: d.odometerKm,
      fuel_percent: d.fuelPercent,
      condition_notes: d.conditionNotes,
      accessories_notes: d.accessoriesNotes,
      existing_damage_notes: d.existingDamageNotes,
      new_damage_notes: d.newDamageNotes,
      identity_checked: identity,
      accessories_checked: true,
    },
  });
  if (error) throw Error(error.message);
  refresh(d.bookingId);
}
