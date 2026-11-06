import "server-only";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { readNotificationConfig, type NotificationConfig } from "./config";
import { renderTelegramOwnerNotification } from "./telegram-owner";
import { approvedUrl } from "./templates";
import { validOwnerChatId } from "./config";
import { renderNotification } from "./templates";
import { createTransport, retryDelay, type Transport } from "./transports";
import {
  eventCatalog,
  type DeliveryMessage,
  type DeliveryResult,
  type OutboxRow,
} from "./types";
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function createNotificationServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error("Notification worker database configuration unavailable");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function deliverClaimed(
  db: SupabaseClient<Database>,
  row: OutboxRow,
  config: NotificationConfig,
  transport: Transport,
) {
  if (!row.lease_token) throw Error("Notification lease unavailable");
  const lease = row.lease_token;
  let result: DeliveryResult;
  if (
    row.template_version !== 1 ||
    !Object.hasOwn(eventCatalog, row.event_type)
  )
    result = { outcome: "unsupported_template" };
  else {
    const { data: context, error } = await db.rpc(
      "notification_delivery_context",
      { p_id: row.id, p_lease: lease },
    );
    if (error) throw Error("Notification recipient lookup failed");
    const recipient = record(context).recipient;
    let rendered:
      | (ReturnType<typeof renderNotification> & { telegramAdminUrl?: string })
      | undefined;
    try {
      rendered = renderNotification(row.event_type, row.payload, config);
      if (
        row.channel === "telegram" &&
        !row.is_test &&
        config.mode === "live" &&
        [
          "booking_requested",
          "booking_approved",
          "booking_cancelled",
          "verification_review",
          "verification_action",
        ].includes(row.event_type)
      ) {
        rendered = {
          ...rendered,
          ...(await renderTelegramOwnerNotification(db, row, config)),
        };
      }
    } catch {
      result = { outcome: "unsupported_template" };
    }
    if (rendered) {
      const message: DeliveryMessage = {
        channel: row.channel,
        eventId: row.id,
        recipient:
          row.channel === "telegram"
            ? "operations"
            : typeof recipient === "string"
              ? recipient
              : "",
        isTest: row.is_test,
        ...rendered,
      };
      // Include recipient/sender/chat in the persisted fingerprint: retries cannot silently change targets.
      const hash = createHash("sha256")
        .update(
          JSON.stringify({
            message,
            providerAccountFingerprint: createHash("sha256")
              .update(
                row.channel === "resend"
                  ? config.resendKey
                  : config.telegramToken,
              )
              .digest("hex"),
            from: row.channel === "resend" ? config.resendFrom : undefined,
            chat:
              row.channel === "telegram" ? config.telegramChatId : undefined,
          }),
        )
        .digest("hex");
      const prepared = await db.rpc("notification_prepare", {
        p_id: row.id,
        p_lease: lease,
        p_hash: hash,
      });
      if (prepared.error) throw Error("Notification preparation failed");
      if (!prepared.data) return "cancelled";
      if (
        row.channel === "resend" &&
        record(prepared.data).recipient !== message.recipient
      )
        result = { outcome: "request_changed" };
      else result = await transport(message);
    }
  }
  const finalResult = result!;
  const finished = await db.rpc("notification_finish", {
    p_id: row.id,
    p_lease: lease,
    p_result: finalResult.outcome,
    p_provider_reference: finalResult.providerReference,
    p_retry_seconds: retryDelay(row.attempt_count, finalResult.retrySeconds),
  });
  if (finished.error)
    throw Error(
      "Notification result could not be persisted; lease requires review",
    );
  return finalResult.outcome;
}
export async function processNotifications(
  config = readNotificationConfig(),
  db?: SupabaseClient<Database>,
  transport?: Transport,
  channels: readonly ("telegram" | "resend")[] = ["telegram", "resend"],
) {
  if (config.mode === "disabled")
    return { mode: "disabled", processed: 0, sent: 0, failed: 0 };
  if (
    channels.includes("telegram") &&
    config.mode === "live" &&
    (!validOwnerChatId(config.telegramChatId) ||
      !config.telegramToken ||
      !approvedUrl(config.adminBase, "/dashboard/bookings", config.development))
  )
    throw Error("Owner notification configuration unavailable");
  const database = db ?? createNotificationServiceClient(),
    adapter = transport ?? createTransport(config);
  const scheduled = await database.rpc("notification_schedule_reminders", {});
  if (scheduled.error) throw Error("Notification scheduling failed");
  const totals = { mode: config.mode, processed: 0, sent: 0, failed: 0 };
  // One leased row at a time; serial providers avoid bursts and keep leases within 90s.
  // Invocation is bounded to two deliveries; external scheduler chooses the approved cadence.
  for (const channel of channels) {
    const claimed = await database.rpc("notification_claim", {
      p_channel: channel,
      p_mock: config.mode === "mock",
    });
    if (claimed.error) throw Error("Notification claim failed");
    for (const row of claimed.data ?? []) {
      totals.processed++;
      const outcome = await deliverClaimed(database, row, config, adapter);
      if (outcome === "sent") totals.sent++;
      else totals.failed++;
    }
  }
  return totals;
}
