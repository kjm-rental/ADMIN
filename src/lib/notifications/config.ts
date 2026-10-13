import "server-only";
export type NotificationConfig = ReturnType<typeof readNotificationConfig>;
export function readNotificationConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const production = env.NODE_ENV === "production";
  const externalApproved = env.NOTIFICATIONS_EXTERNAL_APPROVED === "true";
  return {
    mode:
      env.NOTIFICATIONS_MODE === "mock" && !production
        ? ("mock" as const)
        : env.NOTIFICATIONS_MODE === "live" && externalApproved
          ? ("live" as const)
          : ("disabled" as const),
    externalApproved,
    telegramToken: env.TELEGRAM_BOT_TOKEN || "",
    telegramChatId: env.TELEGRAM_OPERATIONS_CHAT_ID || "",
    telegramVerified: env.TELEGRAM_OPERATIONS_VERIFIED === "true",
    resendKey: env.RESEND_API_KEY || "",
    resendTestEnabled: !production && env.RESEND_TEST_ENABLED === "true",
    resendFrom: env.RESEND_FROM_EMAIL || "",
    senderVerified: env.RESEND_SENDER_VERIFIED === "true",
    mainBase: env.KJM_MAIN_BASE_URL,
    adminBase: env.KJM_ADMIN_BASE_URL,
    pickupLocation: env.KJM_PICKUP_LOCATION,
    development: !production,
  };
}
export function safeConfigurationStatus(config = readNotificationConfig()) {
  return {
    mode: config.mode,
    externalApproved: config.externalApproved,
    telegramConfigured: Boolean(
      config.telegramToken && /^-\d+$/.test(config.telegramChatId),
    ),
    telegramVerified: config.telegramVerified,
    resendConfigured: Boolean(config.resendKey && config.resendFrom),
    senderVerification: config.senderVerified
      ? "Management attestation configured; not independently verified here"
      : "Not verified",
  };
}
