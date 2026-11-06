import { authorizedScheduler } from "@/lib/notifications/scheduler-auth";
import { readNotificationConfig } from "@/lib/notifications/config";
import { processNotifications } from "@/lib/notifications/worker";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (
    !authorizedScheduler(
      request.headers.get("authorization"),
      process.env.NOTIFICATION_CRON_SECRET,
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // MAIN owns the branded Resend worker. This endpoint must never claim its email rows.
    if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "true")
      return Response.json({ status: "telegram_activation_required" });
    return Response.json(
      await processNotifications(
        readNotificationConfig(),
        undefined,
        undefined,
        ["telegram"],
      ),
    );
  } catch {
    return Response.json(
      {
        error:
          "Notification worker unavailable; review server configuration and queue leases.",
      },
      { status: 503 },
    );
  }
}
