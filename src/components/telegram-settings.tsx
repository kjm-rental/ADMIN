import Link from "next/link";
import { Send, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  readNotificationConfig,
  validOwnerChatId,
} from "@/lib/notifications/config";
import { approvedUrl } from "@/lib/notifications/templates";
import { TelegramTestForm } from "./telegram-test-form";
export async function TelegramSettings() {
  const { supabase } = await requireAdmin();
  const config = readNotificationConfig();
  const settings = await supabase
    .from("notification_settings")
    .select("telegram_enabled,enabled_events")
    .maybeSingle();
  const configured = Boolean(
    config.telegramToken && validOwnerChatId(config.telegramChatId),
  );
  const missing: string[] = [];
  if (!config.telegramToken) missing.push("TELEGRAM_BOT_TOKEN");
  if (!validOwnerChatId(config.telegramChatId))
    missing.push("TELEGRAM_OWNER_CHAT_ID (positive private chat ID)");
  if (!approvedUrl(config.adminBase, "/dashboard/bookings"))
    missing.push("KJM_ADMIN_BASE_URL (HTTPS Admin origin)");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    missing.push("SUPABASE_SERVICE_ROLE_KEY for the existing worker");
  if (
    !process.env.NOTIFICATION_CRON_SECRET ||
    process.env.NOTIFICATION_CRON_SECRET.length < 32
  )
    missing.push("NOTIFICATION_CRON_SECRET (at least 32 characters)");
  if (config.mode !== "live")
    missing.push(
      "NOTIFICATIONS_MODE=live and NOTIFICATIONS_EXTERNAL_APPROVED=true",
    );
  if (settings.error || !settings.data)
    missing.push("Notification queue settings could not be checked");
  else {
    const preferences = settings.data;
    if (!preferences.telegram_enabled)
      missing.push("Enable Telegram in notification preferences");
    if (
      !["booking_requested", "booking_approved"].every((event) =>
        preferences.enabled_events.includes(event),
      )
    )
      missing.push("Enable new-booking and confirmation events");
    if (!preferences.enabled_events.includes("booking_cancelled"))
      missing.push("Enable cancellation events");
  }
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-sand text-ocean">
            <Send size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-deep-teal">
              Telegram Notifications
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              @KJMRentalBot · private owner chat only
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${configured ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
        >
          {configured ? "Credentials configured" : "Setup needed"}
        </span>
      </header>
      <div className="grid items-start gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {configured
              ? "Use Send Test Message to verify Telegram connectivity. Credentials are kept on the server."
              : "Add the bot token and owner's private chat ID to ADMIN's server environment, then restart."}
          </p>
          <TelegramTestForm configured={configured} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold">
            <ShieldCheck size={18} className="text-ocean" />
            Booking & cancellation delivery
          </h3>
          <p className="mt-2 text-sm font-bold text-deep-teal">
            {missing.length
              ? "Not ready for automatic delivery"
              : "Configured for scheduled delivery"}
          </p>
          {missing.length > 0 && (
            <>
              <p className="mt-2 text-xs text-slate-500">
                Missing configuration or settings:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs text-slate-500">
            The existing notification worker must be scheduled separately.
            Scheduler execution cannot be verified here. A successful test does
            not prove automatic delivery is enabled.
          </p>
          <Link
            href="/dashboard/settings/notifications"
            className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-ocean"
          >
            Notification preferences & delivery history →
          </Link>
        </div>
      </div>
    </section>
  );
}
