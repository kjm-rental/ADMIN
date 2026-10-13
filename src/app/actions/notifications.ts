"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getFreshAdminSession } from "@/lib/auth";
import { eventCatalog } from "@/lib/notifications/types";
import { mockTransport } from "@/lib/notifications/transports";
import { readNotificationConfig } from "@/lib/notifications/config";
const refresh = () => revalidatePath("/dashboard/settings/notifications");
async function admin() {
  const session = await getFreshAdminSession();
  if (!session) throw Error("Active administrator authorization required.");
  return session;
}
export async function saveNotificationPreferences(data: FormData) {
  const { supabase } = await admin();
  const events = data.getAll("events").map((value) =>
    z
      .string()
      .refine((s) => Object.hasOwn(eventCatalog, s))
      .parse(value),
  );
  const hours = (name: string) =>
    z.coerce.number().int().min(1).max(168).parse(data.get(name));
  const { error } = await supabase.rpc("admin_save_notification_settings", {
    p_settings: {
      enabled_events: [...new Set(events)],
      reminders_approved: data.get("remindersApproved") === "on",
      pickup_hours: hours("pickupHours"),
      return_hours: hours("returnHours"),
      morning_hour: z.coerce
        .number()
        .int()
        .min(0)
        .max(23)
        .parse(data.get("morningHour")),
    },
  });
  if (error)
    throw Error(
      "Notification preferences could not be saved. Check migration availability and authorization.",
    );
  refresh();
}
export async function retryCustomerNotification(data: FormData) {
  const { supabase } = await admin();
  const id = z.uuid().parse(data.get("id"));
  const { error } = await supabase.rpc("admin_retry_notification", {
    p_id: id,
  });
  if (error)
    throw Error(
      "This notification cannot be retried. It may already be pending, ambiguous, exhausted, or outside the provider idempotency window.",
    );
  refresh();
}
export async function repairNotificationGeneration(data: FormData) {
  const { supabase } = await admin();
  const id = z.uuid().parse(data.get("id"));
  const { error } = await supabase.rpc("admin_repair_notification_generation", {
    p_id: id,
  });
  if (error)
    throw Error("The notification generation failure could not be recovered.");
  refresh();
}
export async function runMockNotificationTest(data: FormData) {
  const { supabase } = await admin();
  const channel = z.enum(["telegram", "resend"]).parse(data.get("channel"));
  const config = readNotificationConfig();
  if (config.mode !== "mock" || !config.development)
    throw Error(
      "Simulated tests require explicitly configured development mock mode. No real delivery was attempted.",
    );
  const { error } = await supabase.rpc("admin_audit_notification_mock_test", {
    p_channel: channel,
  });
  if (error) throw Error("Simulated test audit could not be recorded.");
  const result = await mockTransport()({
    channel,
    eventId: "admin-mock-test",
    recipient: "synthetic@example.invalid",
    subject: "KJM simulated notification",
    html: "<p>Simulated notification</p>",
    text: "Simulated notification",
    telegramText: "Simulated notification",
    isTest: true,
  });
  if (result.outcome !== "sent")
    throw Error("Simulated transport test failed.");
  refresh();
}
