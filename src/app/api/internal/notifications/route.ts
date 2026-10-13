import { authorizedScheduler } from "@/lib/notifications/scheduler-auth";
import { processNotifications } from "@/lib/notifications/worker";
export async function POST(request: Request) {
  if (
    !authorizedScheduler(
      request.headers.get("authorization"),
      process.env.NOTIFICATION_CRON_SECRET,
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await processNotifications());
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
