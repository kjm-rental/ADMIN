import "server-only";
import type { DeliveryMessage, DeliveryResult } from "./types";
import { validOwnerChatId, type NotificationConfig } from "./config";
import { approvedUrl } from "./templates";
export type Transport = (message: DeliveryMessage) => Promise<DeliveryResult>;
export const validEmail = (value: string) =>
  value.length <= 254 &&
  /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value) &&
  !/[\r\n]/.test(value);
export function mockTransport(
  outcome: DeliveryResult["outcome"] = "sent",
): Transport {
  return async (message) =>
    message.isTest
      ? {
          outcome,
          providerReference:
            outcome === "sent" ? `mock:${message.eventId}` : undefined,
          simulated: true,
          retrySeconds: 60,
        }
      : { outcome: "provider_rejected", simulated: true };
}
export function retryDelay(attempt: number, providerSeconds?: number) {
  return Math.min(
    7200,
    Math.max(60 * 2 ** Math.max(0, attempt - 1), providerSeconds || 0),
  );
}
export function createTransport(
  config: NotificationConfig,
  fetcher: typeof fetch = fetch,
): Transport {
  if (config.mode === "mock") return mockTransport();
  return async (message) => {
    if (config.mode !== "live" || !config.externalApproved)
      return { outcome: "configuration" };
    if (message.isTest) return { outcome: "provider_rejected" }; // Synthetic records never go to real providers.
    const telegram = message.channel === "telegram";
    if (
      telegram &&
      (!config.telegramVerified ||
        !config.telegramToken ||
        !validOwnerChatId(config.telegramChatId))
    )
      return { outcome: "configuration" };
    if (
      !telegram &&
      (!config.senderVerified ||
        !config.resendKey ||
        !validEmail(config.resendFrom))
    )
      return { outcome: "configuration" };
    if (!telegram && !validEmail(message.recipient))
      return { outcome: "invalid_recipient" };
    return sendProvider(config, message, telegram, fetcher);
  };
}

// Separate opt-in test adapter: never used by the outbox/customer worker.
export function createResendTestTransport(
  config: NotificationConfig,
  fetcher: typeof fetch = fetch,
): Transport {
  return async (message) => {
    if (
      !config.development ||
      !config.resendTestEnabled ||
      config.mode !== "disabled" ||
      config.externalApproved ||
      !config.resendKey
    )
      return { outcome: "configuration" };
    if (!message.isTest || message.channel !== "resend")
      return { outcome: "provider_rejected" };
    // Official simulator inboxes only; personal/customer recipients are excluded.
    if (
      !validEmail(message.recipient) ||
      !/^(?:(?:delivered|bounced|complained)(?:\+[a-zA-Z0-9._-]+)?|suppressed)@resend\.dev$/.test(
        message.recipient,
      )
    )
      return { outcome: "invalid_recipient" };
    return sendProvider(
      { ...config, resendFrom: "onboarding@resend.dev" },
      message,
      false,
      fetcher,
    );
  };
}

async function sendProvider(
  config: NotificationConfig,
  message: DeliveryMessage,
  telegram: boolean,
  fetcher: typeof fetch,
): Promise<DeliveryResult> {
  try {
    const response = await fetcher(
      telegram
        ? `https://api.telegram.org/bot${config.telegramToken}/sendMessage`
        : "https://api.resend.com/emails",
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
        headers: telegram
          ? { "Content-Type": "application/json" }
          : {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.resendKey}`,
              "Idempotency-Key": `kjm-v1/${message.eventId}`,
            },
        body: JSON.stringify(
          telegram
            ? {
                chat_id: config.telegramChatId,
                text: message.telegramText,
                link_preview_options: { is_disabled: true },
                protect_content: true,
                ...(message.telegramAdminUrl &&
                approvedUrl(
                  config.adminBase,
                  new URL(message.telegramAdminUrl).pathname,
                ) === message.telegramAdminUrl
                  ? {
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "View Booking in Admin",
                              url: message.telegramAdminUrl,
                            },
                          ],
                        ],
                      },
                    }
                  : {}),
              }
            : {
                from: config.resendFrom,
                to: [message.recipient],
                subject: message.subject,
                html: message.html,
                text: message.text,
              },
        ),
      },
    );
    // Never persist provider descriptions, URLs, headers or exception strings.
    const data: {
      ok?: boolean;
      result?: { message_id?: number };
      id?: string;
      parameters?: { retry_after?: number };
      error_code?: number;
    } = await response.json().catch(() => ({}));
    const code =
      telegram && data.ok === false
        ? data.error_code || response.status
        : response.status;
    if (code === 429)
      return {
        outcome: "rate_limited",
        retrySeconds:
          Number(
            data.parameters?.retry_after || response.headers.get("retry-after"),
          ) || 60,
      };
    if (code >= 500)
      return { outcome: telegram ? "delivery_ambiguous" : "transient" };
    if (telegram && response.ok && data.ok === undefined)
      return { outcome: "delivery_ambiguous" };
    if (!response.ok || (telegram && data.ok !== true))
      return { outcome: "provider_rejected" };
    const providerReference = telegram
      ? data.result?.message_id?.toString()
      : data.id;
    if (!providerReference)
      return { outcome: telegram ? "delivery_ambiguous" : "transient" };
    return { outcome: "sent", providerReference };
  } catch {
    return { outcome: telegram ? "delivery_ambiguous" : "transient" };
  }
}

/** Explicit admin-triggered connectivity test, separate from automatic delivery. */
export function createTelegramOwnerTestTransport(
  config: NotificationConfig,
  fetcher: typeof fetch = fetch,
): Transport {
  return async (message) => {
    if (message.channel !== "telegram" || !message.isTest)
      return { outcome: "provider_rejected" };
    if (!config.telegramToken || !validOwnerChatId(config.telegramChatId))
      return { outcome: "configuration" };
    return sendProvider(config, message, true, fetcher);
  };
}
