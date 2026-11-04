import { notificationRetryEligible } from "./retry-policy";
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { approvedUrl, renderNotification, manilaTime, php } from "./templates";
import {
  eventCatalog,
  type NotificationPayload,
  type DeliveryMessage,
  type OutboxRow,
} from "./types";
import { readNotificationConfig, safeConfigurationStatus } from "./config";
import { createTransport, mockTransport, retryDelay } from "./transports";
import { authorizedScheduler } from "./scheduler-auth";
import { deliverClaimed, processNotifications } from "./worker";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
const payload: NotificationPayload = {
  bookingId: "11111111-1111-4111-8111-111111111111",
  reference: "KJM-SYNTHETIC",
  motorcycle: '<img src=x onerror="alert(1)">',
  pickupAt: "2026-10-11T16:01:00Z",
  returnAt: "2026-10-12T16:01:00Z",
  rentalCentavos: 51200,
  depositOption: "cash",
  depositCentavos: 12345,
  amountCentavos: 12345,
  status: "pending",
};
const message: DeliveryMessage = {
  channel: "resend",
  eventId: "event-123",
  recipient: "synthetic@example.invalid",
  subject: "Synthetic",
  html: "<p>Synthetic</p>",
  text: "Synthetic",
  telegramText: "<b>Synthetic</b>",
  isTest: false,
};
const liveConfig = () =>
  readNotificationConfig({
    NODE_ENV: "development",
    NOTIFICATIONS_MODE: "live",
    NOTIFICATIONS_EXTERNAL_APPROVED: "true",
    TELEGRAM_BOT_TOKEN: "synthetic-secret",
    TELEGRAM_OWNER_CHAT_ID: "123",
    RESEND_API_KEY: "synthetic-key",
    RESEND_FROM_EMAIL: "sender@example.invalid",
    RESEND_SENDER_VERIFIED: "true",
  });
const mockConfig = readNotificationConfig({
  NODE_ENV: "development",
  NOTIFICATIONS_MODE: "mock",
});
const row = {
  id: "notice",
  lease_token: "lease",
  template_version: 1,
  event_type: "cash_payment",
  channel: "resend",
  is_test: true,
  attempt_count: 1,
  payload,
} as OutboxRow;
function database(
  prepare: unknown = { recipient: "synthetic@example.invalid" },
) {
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === "notification_delivery_context"
        ? { recipient: "synthetic@example.invalid" }
        : name === "notification_prepare"
          ? prepare
          : null,
    error: null,
  }));
  return { rpc, db: { rpc } as unknown as SupabaseClient<Database> };
}
describe("KJM notification templates", () => {
  for (const event of Object.keys(
    eventCatalog,
  ) as (keyof typeof eventCatalog)[])
    it(`${event}: escaped accessible HTML, plain text and staff link`, () => {
      const r = renderNotification(event, payload, {
        mainBase: "https://kjm.example",
        adminBase: "https://admin.kjm.example",
      });
      expect(r.html).toContain('lang="en"');
      expect(r.html).toContain('role="presentation"');
      expect(r.html).not.toContain("<img src=x");
      expect(r.html).toContain("&lt;img");
      expect(r.text).toContain("KJM-SYNTHETIC");
      expect(r.telegramText).toContain(
        "https://admin.kjm.example/dashboard/bookings/",
      );
    });
  it("pending request is not confirmed; approval is not a receipt", () => {
    expect(renderNotification("booking_requested", payload).text).toContain(
      "not yet confirmed",
    );
    expect(renderNotification("booking_approved", payload).text).toContain(
      "does not mean payment has been received",
    );
  });
  it("Manila timestamps cross UTC midnight correctly and centavos remain precise", () => {
    expect(manilaTime("2026-10-11T15:59:00Z")).toContain("11");
    expect(manilaTime("2026-10-11T16:01:00Z")).toContain("12");
    expect(php(12345)).toContain("123.45");
  });
  it("custody selection omits document type/numbers and cash amount", () => {
    const r = renderNotification("booking_requested", {
      ...payload,
      depositOption: "eligible_id",
    });
    expect(r.text).toContain("Approved document custody arrangement");
    expect(r.text).not.toContain("123.45");
    expect(r.text).not.toContain("passport");
  });
  it("rejects unsafe URLs and never invents upload routes", () => {
    for (const base of [
      "javascript:alert(1)",
      "https://user:secret@kjm.example",
      "http://kjm.example",
      "https://kjm.example/private?token=x",
    ])
      expect(approvedUrl(base, "/contact")).toBeUndefined();
    expect(approvedUrl("http://localhost:3000", "/contact", true)).toBe(
      "http://localhost:3000/contact",
    );
    expect(
      renderNotification("verification_action", payload).html,
    ).not.toContain("href=");
  });
  it("does not invent location or claim full financial settlement", () => {
    expect(renderNotification("pickup_reminder", payload).text).not.toContain(
      "Configured pickup location",
    );
    expect(renderNotification("returned", payload).text).toContain(
      "does not confirm",
    );
    expect(renderNotification("deposit_returned", payload).text).toContain(
      "not any remaining balance",
    );
  });
});
describe("server-side provider and activation controls", () => {
  it("defaults disabled; production mock mode and unapproved live mode are blocked", () => {
    expect(
      readNotificationConfig({
        NODE_ENV: "production",
        NOTIFICATIONS_MODE: "mock",
      }).mode,
    ).toBe("disabled");
    expect(readNotificationConfig({ NOTIFICATIONS_MODE: "live" }).mode).toBe(
      "disabled",
    );
  });
  it("mock success/failure deterministic and only synthetic", async () => {
    expect(await mockTransport()({ ...message, isTest: true })).toMatchObject({
      outcome: "sent",
      providerReference: "mock:event-123",
      simulated: true,
    });
    expect(await mockTransport()(message)).toMatchObject({
      outcome: "provider_rejected",
    });
    expect(
      await mockTransport("transient")({ ...message, isTest: true }),
    ).toMatchObject({ outcome: "transient" });
  });
  it("missing configuration makes no network call", async () => {
    const f = vi.fn();
    expect(
      await createTransport(readNotificationConfig({}), f)(message),
    ).toMatchObject({ outcome: "configuration" });
    expect(f).not.toHaveBeenCalled();
  });
  it("synthetic rows and invalid recipients never reach real providers", async () => {
    const f = vi.fn();
    expect(
      await createTransport(liveConfig(), f)({ ...message, isTest: true }),
    ).toMatchObject({ outcome: "provider_rejected" });
    expect(
      await createTransport(
        liveConfig(),
        f,
      )({ ...message, recipient: "victim@example.invalid\nBcc:other" }),
    ).toMatchObject({ outcome: "invalid_recipient" });
    expect(f).not.toHaveBeenCalled();
  });
  it("Resend uses stable idempotency and HTML/text parts", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "provider-123" }), { status: 200 }),
      );
    expect(await createTransport(liveConfig(), f)(message)).toMatchObject({
      outcome: "sent",
      providerReference: "provider-123",
    });
    expect(f.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    expect(f.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      "kjm-v1/event-123",
    );
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({
      html: message.html,
      text: message.text,
      to: [message.recipient],
    });
  });
  it("Telegram uses fixed owner private chat and unparsed plain text", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, result: { message_id: 123 } }),
          { status: 200 },
        ),
      );
    expect(
      await createTransport(
        liveConfig(),
        f,
      )({ ...message, channel: "telegram", recipient: "attacker" }),
    ).toMatchObject({ outcome: "sent" });
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.chat_id).toBe("123");
    expect(body.parse_mode).toBeUndefined();
  });
  it("ambiguous Telegram timeout is held; Resend timeout retries with same key", async () => {
    const f = vi.fn().mockRejectedValue(Error("secret-private-url"));
    expect(
      await createTransport(
        liveConfig(),
        f,
      )({ ...message, channel: "telegram" }),
    ).toEqual({ outcome: "delivery_ambiguous" });
    expect(await createTransport(liveConfig(), f)(message)).toEqual({
      outcome: "transient",
    });
  });
  it("rate limits and permanent rejections are safely classified", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ parameters: { retry_after: 120 } }), {
          status: 429,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "private details" }), {
          status: 422,
        }),
      );
    expect(await createTransport(liveConfig(), f)(message)).toMatchObject({
      outcome: "rate_limited",
      retrySeconds: 120,
    });
    expect(await createTransport(liveConfig(), f)(message)).toEqual({
      outcome: "provider_rejected",
    });
    expect(retryDelay(3, 900)).toBe(900);
    expect(retryDelay(6)).toBe(1920);
  });
  it("safe configuration never returns tokens/chat IDs", () => {
    const r = JSON.stringify(safeConfigurationStatus(liveConfig()));
    for (const secret of ["synthetic-secret", "synthetic-key", "-123"])
      expect(r).not.toContain(secret);
  });
  it("scheduler needs an exact long bearer secret", () => {
    const secret = "x".repeat(32);
    expect(authorizedScheduler(`Bearer ${secret}`, secret)).toBe(true);
    for (const h of [null, "Bearer wrong", `Basic ${secret}`])
      expect(authorizedScheduler(h, secret)).toBe(false);
    expect(authorizedScheduler("Bearer short", "short")).toBe(false);
  });
});
describe("durable worker orchestration with mocked database", () => {
  it("disabled mode touches neither database nor providers", async () => {
    const { db, rpc } = database();
    const transport = vi.fn();
    expect(
      await processNotifications(readNotificationConfig({}), db, transport),
    ).toMatchObject({ processed: 0, mode: "disabled" });
    expect(rpc).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
  it("recipient and fingerprint are prepared before send; result recorded after", async () => {
    const { db, rpc } = database();
    const t = vi
      .fn()
      .mockResolvedValue({ outcome: "sent", providerReference: "mock:notice" });
    expect(await deliverClaimed(db, row, mockConfig, t)).toBe("sent");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      "notification_delivery_context",
      "notification_prepare",
      "notification_finish",
    ]);
    expect(t).toHaveBeenCalledTimes(1);
  });
  it("stale preparation cancels without external request", async () => {
    const { db, rpc } = database(null);
    const t = vi.fn();
    expect(await deliverClaimed(db, row, mockConfig, t)).toBe("cancelled");
    expect(t).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain(
      "notification_finish",
    );
  });
  it("changed recipient prevents external delivery", async () => {
    const { db } = database({ recipient: "changed@example.invalid" });
    const t = vi.fn();
    expect(await deliverClaimed(db, row, mockConfig, t)).toBe(
      "request_changed",
    );
    expect(t).not.toHaveBeenCalled();
  });
  it("provider failure records result without changing booking state", async () => {
    const { db, rpc } = database();
    expect(
      await deliverClaimed(
        db,
        row,
        mockConfig,
        vi.fn().mockResolvedValue({ outcome: "transient" }),
      ),
    ).toBe("transient");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      "notification_delivery_context",
      "notification_prepare",
      "notification_finish",
    ]);
  });
  it("unsupported template is held without send", async () => {
    const { db } = database();
    const t = vi.fn();
    expect(
      await deliverClaimed(db, { ...row, template_version: 2 }, mockConfig, t),
    ).toBe("unsupported_template");
    expect(t).not.toHaveBeenCalled();
  });
});

describe("manual retry eligibility", () => {
  it("permits eligible failures but prevents exhausted, ambiguous, stale and concurrent retries", () => {
    const now = Date.now(),
      r = {
        ...row,
        status: "failed_permanently",
        last_error: "transient",
        manual_retry_count: 0,
        attempt_count: 2,
        first_attempt_at: new Date(now - 1000).toISOString(),
      } as OutboxRow;
    expect(notificationRetryEligible(r, now)).toBe(true);
    for (const patch of [
      { attempt_count: 6 },
      { manual_retry_count: 3 },
      { status: "pending" },
      { status: "processing" },
      { status: "sent" },
      { last_error: "delivery_ambiguous" },
      { last_error: "lease_expired" },
      { channel: "telegram" },
      { first_attempt_at: new Date(now - 24 * 3600000).toISOString() },
    ])
      expect(
        notificationRetryEligible({ ...r, ...patch } as OutboxRow, now),
      ).toBe(false);
  });
  it("does not interpret inherited object keys as template names", () => {
    expect(() => renderNotification("toString" as never, payload)).toThrow(
      "Unsupported",
    );
  });
});
