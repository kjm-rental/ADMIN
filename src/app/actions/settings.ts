"use server";
import { businessTimestamp } from "@/lib/business-time";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getMissingBookingPolicies,
  parseOperatingHours,
} from "@/lib/booking-settings";
import { requireAdmin } from "@/lib/auth";
import type { Json } from "@/types/database";

const policySchema = z.object({
  dayCalculation: z.enum(["started_24_hours", "calendar_day"]).optional(),
  partialDayPricing: z
    .enum(["charge_full_day", "prorated", "not_allowed"])
    .optional(),
  pendingExpirationMinutes: z.coerce.number().int().positive().optional(),
  pendingHoldMinutes: z.coerce.number().int().positive().optional(),
  acceptedIds: z.string().max(4000),
  philippineLicensePolicy: z.string().trim().max(10000),
  internationalLicensePolicy: z.string().trim().max(10000),
  internationalSource: z.union([z.literal(""), z.url()]),
  internationalVerified: z.string(),
  privacyNotice: z.string().trim().max(10000),
  retentionPolicy: z.string().trim().max(10000),
});

export async function saveBookingSettings(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  let hours;
  try {
    hours = parseOperatingHours(formData);
  } catch {
    redirect("/dashboard/settings?bookingError=hours");
  }
  const raw = Object.fromEntries(formData);
  const parsed = policySchema.safeParse({
    ...raw,
    dayCalculation: raw.dayCalculation || undefined,
    partialDayPricing: raw.partialDayPricing || undefined,
    pendingExpirationMinutes: raw.pendingExpirationMinutes || undefined,
    pendingHoldMinutes: raw.pendingHoldMinutes || undefined,
  });
  if (!parsed.success) redirect("/dashboard/settings?bookingError=invalid");
  const d = parsed.data;
  const acceptedIds = [
    ...new Set(
      d.acceptedIds
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const candidate = {
    operating_hours: hours as Json,
    partial_day_policy: d.dayCalculation ?? null,
    partial_day_pricing_policy: d.partialDayPricing ?? null,
    pending_expiration_minutes: d.pendingExpirationMinutes ?? null,
    pending_hold_minutes: d.pendingHoldMinutes ?? null,
    accepted_philippine_id_types: acceptedIds,
    philippine_license_policy: d.philippineLicensePolicy || null,
    international_license_policy: d.internationalLicensePolicy || null,
    international_manual_review_required: true,
    international_policy_source_url: d.internationalSource || null,
    international_policy_verified_at: d.internationalVerified || null,
    privacy_notice: d.privacyNotice || null,
    retention_policy: d.retentionPolicy || null,
  };
  const missing = getMissingBookingPolicies(candidate);
  const requestedEnable = formData.get("publicBookingEnabled") === "on";
  const approved = formData.get("policyApproval") === "on";
  const { data: technicalChecks, error: readinessError } = await supabase
    .from("booking_readiness_checks")
    .select("passed");
  if (readinessError) redirect("/dashboard/settings?bookingError=database");
  const technicalReady = Boolean(
    technicalChecks?.length && technicalChecks.every((check) => check.passed),
  );
  if (requestedEnable && (missing.length || !approved || !technicalReady))
    redirect("/dashboard/settings?bookingError=incomplete");
  const { error } = await supabase
    .from("booking_settings")
    .update({
      ...candidate,
      public_booking_enabled:
        requestedEnable && approved && !missing.length && technicalReady,
      policies_approved_at:
        approved && !missing.length ? new Date().toISOString() : null,
      policies_approved_by: approved && !missing.length ? user.id : null,
    })
    .eq("id", true);
  if (error) redirect("/dashboard/settings?bookingError=database");
  revalidatePath("/dashboard/settings");
  redirect(`/dashboard/settings?policy=1&ready=${missing.length ? "0" : "1"}`);
}

export async function setBookingTesterAuthorization(formData: FormData) {
  const parsed = z
    .object({
      authUserId: z.uuid(),
      expiresAt: z.union([
        z.literal(""),
        z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      ]),
      authorized: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    (parsed.data.authorized === "true" && !parsed.data.expiresAt)
  )
    redirect("/dashboard/settings?bookingError=tester");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_booking_tester", {
    p_auth_user_id: parsed.data.authUserId,
    p_expires_at: parsed.data.expiresAt
      ? businessTimestamp(parsed.data.expiresAt)
      : null,
    p_authorized: parsed.data.authorized === "true",
  });
  if (error) redirect("/dashboard/settings?bookingError=tester");
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?tester=1");
}
