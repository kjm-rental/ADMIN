import { requireAdmin } from "@/lib/auth";
export async function getNotificationView() {
  const { supabase } = await requireAdmin();
  const settings = await supabase
    .from("notification_settings")
    .select("*")
    .maybeSingle();
  if (settings.error && ["42P01", "PGRST205"].includes(settings.error.code))
    return {
      available: false as const,
      settings: null,
      history: [],
      generationErrors: [],
      lastDelivery: [],
      lastFailure: [],
    };
  if (settings.error || !settings.data)
    throw Error("Notification settings could not be loaded.");
  const [
    history,
    generationErrors,
    telegramSuccess,
    resendSuccess,
    telegramFailure,
    resendFailure,
  ] = await Promise.all([
    supabase
      .from("notification_outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notification_generation_errors")
      .select("*")
      .is("recovered_at", null)
      .order("created_at", { ascending: false })
      .limit(25),
    ...(["telegram", "resend"] as const).map((channel) =>
      supabase
        .from("notification_outbox")
        .select("*")
        .eq("channel", channel)
        .eq("status", "sent")
        .order("delivered_at", { ascending: false })
        .limit(1),
    ),
    ...(["telegram", "resend"] as const).map((channel) =>
      supabase
        .from("notification_outbox")
        .select("*")
        .eq("channel", channel)
        .not("last_error", "is", null)
        .order("last_attempt_at", { ascending: false, nullsFirst: false })
        .limit(1),
    ),
  ]);
  if (
    [
      history,
      generationErrors,
      telegramSuccess,
      resendSuccess,
      telegramFailure,
      resendFailure,
    ].some((result) => result.error)
  )
    throw Error(
      "Notification history could not be loaded. This is a query error, not an empty queue.",
    );
  return {
    available: true as const,
    settings: settings.data,
    history: history.data ?? [],
    generationErrors: generationErrors.data ?? [],
    lastDelivery: [
      ...(telegramSuccess.data ?? []),
      ...(resendSuccess.data ?? []),
    ],
    lastFailure: [
      ...(telegramFailure.data ?? []),
      ...(resendFailure.data ?? []),
    ],
  };
}
