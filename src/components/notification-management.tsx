import { notificationRetryEligible } from "@/lib/notifications/retry-policy";
import {
  Bell,
  Mail,
  Send,
  ShieldCheck,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import {
  saveNotificationPreferences,
  retryCustomerNotification,
  runMockNotificationTest,
  repairNotificationGeneration,
} from "@/app/actions/notifications";
import {
  eventCatalog,
  type NotificationSettings,
  type OutboxRow,
  type GenerationError,
} from "@/lib/notifications/types";
import { manilaTime } from "@/lib/notifications/templates";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-deep-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-ocean focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean disabled:cursor-not-allowed disabled:opacity-50";
const errors: Record<string, string> = {
  transient: "Temporary provider failure",
  rate_limited: "Provider rate limit; retry scheduled",
  invalid_recipient: "Verified customer email unavailable or invalid",
  provider_rejected: "Provider rejected delivery",
  delivery_ambiguous: "Delivery may have been accepted; manual review required",
  idempotency_window_expired: "Provider retry window expired",
  request_changed: "Request changed; delivery held for review",
  lease_expired: "Worker lease expired; delivery may have occurred",
  stale_event: "Booking event is no longer eligible",
  disabled: "Channel disabled",
  configuration: "Provider configuration unavailable",
  unsupported_template: "Unsupported template version",
};
export type NotificationManagementProps = {
  available: boolean;
  settings: NotificationSettings | null;
  history: OutboxRow[];
  generationErrors: GenerationError[];
  lastDelivery: OutboxRow[];
  lastFailure: OutboxRow[];
  configuration: {
    mode: string;
    externalApproved: boolean;
    telegramConfigured: boolean;
    telegramVerified: boolean;
    resendConfigured: boolean;
    senderVerification: string;
  };
};
export function NotificationManagement({
  available,
  settings,
  history,
  generationErrors,
  lastDelivery,
  lastFailure,
  configuration,
}: NotificationManagementProps) {
  return (
    <div className="min-w-0 space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/dashboard/settings"
            className="text-sm font-bold text-ocean hover:underline"
          >
            Settings / Notifications
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-deep-teal">
            Keep every ride connected.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Operational alerts for your team. Thoughtful updates for your
            riders. One secure, auditable delivery workspace.
          </p>
        </div>
        <span className="rounded-full border border-ocean/20 bg-ocean/5 px-4 py-2 text-xs font-bold text-deep-teal">
          {configuration.mode === "mock"
            ? "Development · simulated only"
            : configuration.mode === "live"
              ? "Approved server mode"
              : "External delivery disabled"}
        </span>
      </div>
      <section className="rounded-3xl bg-deep-teal p-6 text-white sm:p-8">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-1 size-6 shrink-0 text-coral" />
          <div>
            <h2 className="text-lg font-bold">Prepared with privacy in mind</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
              Identity documents, PINs and private storage links stay out of
              notifications. Cash rental payments and refundable deposits remain
              separate. Delivery requires credentials, verified configuration
              and management approval.
            </p>
          </div>
        </div>
      </section>
      {!available && (
        <p
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"
        >
          Notification management awaits migration 022. Production migrations
          020–022 require separate approval. No notification delivery has been
          activated.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {(["telegram", "resend"] as const).map((channel) => {
          const telegram = channel === "telegram",
            configured = telegram
              ? configuration.telegramConfigured
              : configuration.resendConfigured,
            enabled = telegram
              ? settings?.telegram_enabled
              : settings?.resend_enabled;
          const success = lastDelivery.find((r) => r.channel === channel),
            failure = lastFailure.find((r) => r.channel === channel);
          const Icon = telegram ? Send : Mail;
          return (
            <section
              key={channel}
              className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-ocean/10 text-ocean">
                  <Icon className="size-5" />
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                >
                  {enabled ? "Channel enabled" : "Channel disabled"}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-extrabold text-deep-teal">
                {telegram ? "Telegram operations" : "Resend customer emails"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {telegram
                  ? "Compact alerts to your approved private operations group."
                  : "Branded, transactional updates to verified customer email addresses."}
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">
                    Server configuration
                  </dt>
                  <dd className="mt-1 font-bold text-deep-teal">
                    {configured
                      ? "Credentials present; live test still required"
                      : "Not configured"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    {telegram
                      ? "Private group approval"
                      : "Sender verification"}
                  </dt>
                  <dd className="mt-1 text-slate-700">
                    {telegram
                      ? configuration.telegramVerified
                        ? "Management attestation configured; live verification required"
                        : "Awaiting verification"
                      : configuration.senderVerification}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    Last successful delivery
                  </dt>
                  <dd className="mt-1 text-slate-700">
                    {success
                      ? `${manilaTime(success.delivered_at!)}${success.simulated ? " · simulated" : ""}`
                      : "No successful delivery recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    Last delivery error
                  </dt>
                  <dd className="mt-1 text-slate-700">
                    {failure
                      ? (errors[failure.last_error ?? ""] ??
                        "Delivery requires review")
                      : "No delivery error recorded"}
                  </dd>
                </div>
              </dl>
              <ActionForm action={runMockNotificationTest} className="mt-6">
                <input type="hidden" name="channel" value={channel} />
                <ConfirmButton
                  disabled={!available || configuration.mode !== "mock"}
                  className={button}
                  message="Run a simulated test? No Telegram message or email will be sent."
                >
                  Run simulated test
                </ConfirmButton>
              </ActionForm>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Tests simulate delivery and are audited. Live delivery remains
                subject to separate activation approval.
              </p>
            </section>
          );
        })}
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Bell className="size-5 text-ocean" />
          <h2 className="text-xl font-extrabold text-deep-teal">
            Event preferences & reminders
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Choose which transactional events can be delivered. Channels still
          require approved server activation. Reminder timings are provisional
          until explicitly approved below.
        </p>
        <ActionForm
          action={saveNotificationPreferences}
          className="mt-6 space-y-6"
        >
          <fieldset disabled={!available} className="min-w-0 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(eventCatalog).map(([key, event]) => (
                <label
                  key={key}
                  className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-deep-teal"
                >
                  <input
                    type="checkbox"
                    name="events"
                    value={key}
                    defaultChecked={
                      settings?.enabled_events.includes(key) ?? true
                    }
                    className="size-4 shrink-0 accent-teal-700"
                  />
                  {event.title}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                [
                  "pickupHours",
                  "Pickup reminder (hours before)",
                  settings?.pickup_hours ?? 24,
                  1,
                  168,
                ],
                [
                  "returnHours",
                  "Return reminder (hours before)",
                  settings?.return_hours ?? 24,
                  1,
                  168,
                ],
                [
                  "morningHour",
                  "Morning pickup alerts (Manila hour)",
                  settings?.morning_hour ?? 8,
                  0,
                  23,
                ],
              ].map(([name, label, value, min, max]) => (
                <label
                  key={String(name)}
                  className="text-sm font-bold text-deep-teal"
                >
                  {label}
                  <input
                    required
                    type="number"
                    name={String(name)}
                    defaultValue={Number(value)}
                    min={Number(min)}
                    max={Number(max)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 focus:outline-ocean"
                  />
                </label>
              ))}
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <input
                type="checkbox"
                name="remindersApproved"
                defaultChecked={settings?.reminders_approved}
                className="mt-1 size-4 shrink-0"
              />
              Management approves these reminder timings. Eligible approved
              pickups, active returns and staff overdue alerts may be scheduled.
              This does not activate external sending.
            </label>
            <button disabled={!available} className={button}>
              Save notification preferences
            </button>
          </fieldset>
        </ActionForm>
      </section>
      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 p-6">
          <Activity className="size-5 text-ocean" />
          <div>
            <h2 className="text-xl font-extrabold text-deep-teal">
              Delivery history
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Latest 100 notifications · Philippine time · safe error codes only
            </p>
          </div>
        </div>
        {history.length === 0 ? (
          <div className="border-t border-slate-100 p-8 text-center">
            <Mail className="mx-auto size-8 text-ocean/50" />
            <p className="mt-3 font-bold text-deep-teal">
              No notifications yet
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Authoritative booking and financial events will appear here after
              migration approval.
            </p>
          </div>
        ) : (
          <div
            className="max-w-full overflow-x-auto"
            tabIndex={0}
            aria-label="Notification delivery history; scroll horizontally for all columns"
          >
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Event / booking",
                    "Channel",
                    "Status",
                    "Attempts",
                    "Timestamp",
                    "Review",
                  ].map((label) => (
                    <th key={label} className="px-5 py-3 font-bold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 align-top last:border-0"
                  >
                    <td className="max-w-56 px-5 py-4">
                      <p className="font-bold text-deep-teal">
                        {eventCatalog[row.event_type]?.title ?? "Unknown event"}
                      </p>
                      <Link
                        href={`/dashboard/bookings/${row.booking_id}`}
                        className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-ocean hover:underline"
                      >
                        {row.booking_reference}
                        <ArrowUpRight className="size-3" />
                      </Link>
                    </td>
                    <td className="px-5 py-4 capitalize">{row.channel}</td>
                    <td className="max-w-64 px-5 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${row.status === "sent" ? "bg-emerald-50 text-emerald-800" : row.status === "failed_permanently" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-700"}`}
                      >
                        {row.simulated && row.status === "sent"
                          ? "Simulated"
                          : row.status.replaceAll("_", " ")}
                      </span>
                      {row.last_error && (
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {errors[row.last_error] ?? "Review required"}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      {row.attempt_count} / 6
                    </td>
                    <td className="px-5 py-4 text-xs leading-5 text-slate-500">
                      {manilaTime(row.last_attempt_at ?? row.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      {notificationRetryEligible(row) ? (
                        <ActionForm action={retryCustomerNotification}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmButton
                            className={button}
                            message="Retry this customer notification using its original event ID? Booking state will not change."
                          >
                            Retry email
                          </ConfirmButton>
                        </ActionForm>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {row.status === "failed_permanently"
                            ? "Manual review"
                            : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {generationErrors.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-extrabold text-amber-900">
            Notification generation needs review
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            Booking and financial records were preserved. Recover eligible
            notifications without changing those records.
          </p>
          <div className="mt-4 space-y-4">
            {generationErrors.map((error) => (
              <div
                key={error.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p className="text-sm">
                  {error.source} · {manilaTime(error.created_at)} · SQLSTATE{" "}
                  {error.sql_state}
                </p>
                <ActionForm action={repairNotificationGeneration}>
                  <input type="hidden" name="id" value={error.id} />
                  <ConfirmButton
                    className={button}
                    message="Recover the authoritative notification event? No booking or payment state will change."
                  >
                    Recover event
                  </ConfirmButton>
                </ActionForm>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
