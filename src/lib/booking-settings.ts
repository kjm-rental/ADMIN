import { z } from "zod";

export const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
function closesAfterOpening(open: string, close: string) {
  return close === "00:00" ? open !== "00:00" : open < close;
}
const daySchedule = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z
    .object({
      enabled: z.literal(true),
      pickupOpen: time,
      pickupClose: time,
      returnOpen: time,
      returnClose: time,
    })
    .superRefine((value, context) => {
      if (!closesAfterOpening(value.pickupOpen, value.pickupClose))
        context.addIssue({
          code: "custom",
          message: "Pickup closing time must be later than opening time.",
        });
      if (!closesAfterOpening(value.returnOpen, value.returnClose))
        context.addIssue({
          code: "custom",
          message: "Return closing time must be later than opening time.",
        });
    }),
]);
export const operatingHoursSchema = z.object(
  Object.fromEntries(weekdays.map((day) => [day, daySchedule])) as Record<
    (typeof weekdays)[number],
    typeof daySchedule
  >,
);
export type OperatingHours = z.infer<typeof operatingHoursSchema>;

export function parseOperatingHours(formData: FormData): OperatingHours {
  return operatingHoursSchema.parse(
    Object.fromEntries(
      weekdays.map((day) => {
        const enabled = formData.get(`${day}Enabled`) === "on";
        return [
          day,
          enabled
            ? {
                enabled,
                pickupOpen: formData.get(`${day}PickupOpen`),
                pickupClose: formData.get(`${day}PickupClose`),
                returnOpen: formData.get(`${day}ReturnOpen`),
                returnClose: formData.get(`${day}ReturnClose`),
              }
            : { enabled },
        ];
      }),
    ),
  );
}

export function readOperatingHours(value: unknown): OperatingHours | null {
  const parsed = operatingHoursSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getMissingBookingPolicies(settings: Record<string, unknown>) {
  const missing: string[] = [];
  const hours = readOperatingHours(settings.operating_hours);
  if (!hours || !weekdays.some((day) => hours[day].enabled))
    missing.push("at least one operating day");
  if (!settings.partial_day_policy) missing.push("rental-day calculation");
  if (!settings.partial_day_pricing_policy)
    missing.push("partial-day pricing policy");
  if (!settings.pending_expiration_minutes)
    missing.push("pending-request expiration");
  if (
    !Array.isArray(settings.accepted_philippine_id_types) ||
    settings.accepted_philippine_id_types.length === 0
  )
    missing.push("accepted identification documents");
  if (
    typeof settings.philippine_license_policy !== "string" ||
    !settings.philippine_license_policy.trim()
  )
    missing.push("Philippine licence policy");
  if (
    typeof settings.international_license_policy !== "string" ||
    !settings.international_license_policy.trim()
  )
    missing.push("international licence policy");
  if (!settings.international_policy_source_url)
    missing.push("international policy source");
  if (!settings.international_policy_verified_at)
    missing.push("international policy review date");
  if (
    typeof settings.privacy_notice !== "string" ||
    !settings.privacy_notice.trim()
  )
    missing.push("privacy notice");
  if (
    typeof settings.retention_policy !== "string" ||
    !settings.retention_policy.trim()
  )
    missing.push("document-retention policy");
  return missing;
}
