"use server";
import { z } from "zod";
import { getFreshAdminSession } from "@/lib/auth";
import { readNotificationConfig } from "@/lib/notifications/config";
import { createTelegramOwnerTestTransport } from "@/lib/notifications/transports";
export type TelegramTestState = { success: boolean; message: string };
export async function sendTelegramTestMessage(
  _previous: TelegramTestState,
  data: FormData,
): Promise<TelegramTestState> {
  // Always re-check authorization before configuration access or provider calls.
  const session = await getFreshAdminSession();
  if (!session)
    return {
      success: false,
      message: "Only active administrators can send Telegram tests.",
    };
  const text = z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .safeParse(data.get("message"));
  if (!text.success)
    return {
      success: false,
      message: "Enter a message between 1 and 1,000 characters.",
    };
  const config = readNotificationConfig();
  const result = await createTelegramOwnerTestTransport(config)({
    eventId: "admin-owner-connectivity-test",
    channel: "telegram",
    recipient: "configured-owner",
    isTest: true,
    subject: "",
    html: "",
    text: "",
    telegramText: `KJM Telegram connection test — not a booking notification\n\n${text.data}`,
  });
  const errors: Record<string, string> = {
    configuration:
      "Set TELEGRAM_BOT_TOKEN and a valid TELEGRAM_OWNER_CHAT_ID in the ADMIN server environment, then restart the server.",
    rate_limited:
      "Telegram is limiting messages. Wait before sending another test.",
    provider_rejected:
      "Telegram rejected the test. Check the token and owner chat ID, and ask the owner to start @KJMRentalBot.",
    delivery_ambiguous:
      "Delivery could not be confirmed. Check the owner's Telegram chat before retrying; the message may already have arrived.",
  };
  return result.outcome === "sent"
    ? {
        success: true,
        message:
          "Telegram accepted your test message for the configured owner's private chat.",
      }
    : {
        success: false,
        message:
          errors[result.outcome] ??
          "The test could not be sent. Check the server configuration.",
      };
}
