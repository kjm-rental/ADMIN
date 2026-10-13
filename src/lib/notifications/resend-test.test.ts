import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readNotificationConfig, safeConfigurationStatus } from "./config";
import { createResendTestTransport, createTransport } from "./transports";
import type { DeliveryMessage } from "./types";
const config = (env: Record<string, string | undefined> = {}) =>
  readNotificationConfig({
    NODE_ENV: "development",
    NOTIFICATIONS_MODE: "disabled",
    NOTIFICATIONS_EXTERNAL_APPROVED: "false",
    RESEND_TEST_ENABLED: "true",
    RESEND_API_KEY: "synthetic-test-secret",
    ...env,
  });
const message: DeliveryMessage = {
  channel: "resend",
  eventId: "synthetic-test-123",
  recipient: "delivered@resend.dev",
  isTest: true,
  subject: "Synthetic",
  html: "<p>Synthetic only</p>",
  text: "Synthetic only",
  telegramText: "Synthetic only",
};
const fetcher = () =>
  vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "test-id" }), { status: 200 }),
    );
describe("Resend development test safeguards", () => {
  it.each([
    { RESEND_TEST_ENABLED: "false" },
    { NODE_ENV: "production" },
    { RESEND_API_KEY: "" },
    { NOTIFICATIONS_EXTERNAL_APPROVED: "true" },
    { NOTIFICATIONS_MODE: "mock" },
    { NOTIFICATIONS_MODE: "live", NOTIFICATIONS_EXTERNAL_APPROVED: "true" },
  ])("blocks incomplete or unsafe configuration %j", async (env) => {
    const f = fetcher();
    expect(
      (await createResendTestTransport(config(env), f)(message)).outcome,
    ).toBe("configuration");
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    "customer@example.invalid",
    "onboarding@resend.dev",
    "delivered@resend.dev.evil.invalid",
    "delivered@resend.dev\n",
    "delivered@resend.dev\r\nBcc:customer@example.invalid",
    "suppressed+label@resend.dev",
  ])("rejects unsafe or non-approved recipient %s", async (recipient) => {
    const f = fetcher();
    expect(
      (await createResendTestTransport(config(), f)({ ...message, recipient }))
        .outcome,
    ).toBe("invalid_recipient");
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    "delivered@resend.dev",
    "delivered+kjm_approval@resend.dev",
    "bounced@resend.dev",
    "complained@resend.dev",
    "suppressed@resend.dev",
  ])("uses existing request handling for test sink %s", async (recipient) => {
    const f = fetcher();
    expect(
      (await createResendTestTransport(config(), f)({ ...message, recipient }))
        .outcome,
    ).toBe("sent");
    const [url, request] = f.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(request.body)).toMatchObject({
      from: "onboarding@resend.dev",
      to: [recipient],
      html: message.html,
      text: message.text,
    });
    expect(request.headers["Idempotency-Key"]).toBe(
      "kjm-v1/synthetic-test-123",
    );
  });
  it("blocks real data and Telegram", async () => {
    const f = fetcher(),
      send = createResendTestTransport(config(), f);
    expect((await send({ ...message, isTest: false })).outcome).toBe(
      "provider_rejected",
    );
    expect((await send({ ...message, channel: "telegram" })).outcome).toBe(
      "provider_rejected",
    );
    expect(f).not.toHaveBeenCalled();
  });
  it("keeps customer worker disabled and omits secrets from status", async () => {
    const settings = config(),
      f = fetcher();
    expect(settings.mode).toBe("disabled");
    expect((await createTransport(settings, f)(message)).outcome).toBe(
      "configuration",
    );
    expect(f).not.toHaveBeenCalled();
    expect(JSON.stringify(safeConfigurationStatus(settings))).not.toContain(
      settings.resendKey,
    );
  });
  it("keeps the future sender environment-configurable", () => {
    expect(
      config({ RESEND_FROM_EMAIL: "ride@future.example.invalid" }).resendFrom,
    ).toBe("ride@future.example.invalid");
  });
  it("sanitizes rejected provider descriptions", async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "sensitive description" }), {
        status: 403,
      }),
    );
    expect(await createResendTestTransport(config(), f)(message)).toEqual({
      outcome: "provider_rejected",
    });
  });
});
