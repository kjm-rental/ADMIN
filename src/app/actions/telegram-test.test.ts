import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: mocks.session }));
import { sendTelegramTestMessage } from "./telegram-test";
import { createTelegramOwnerTestTransport } from "@/lib/notifications/transports";
import { readNotificationConfig } from "@/lib/notifications/config";
const fetchMock = vi.fn();
const initial = { success: false, message: "" };
const form = (text: string) => {
  const data = new FormData();
  data.set("message", text);
  data.set("chat_id", "attacker");
  return data;
};
beforeEach(() => {
  mocks.session.mockReset().mockResolvedValue({ admin: { is_active: true } });
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:synthetic-token");
  vi.stubEnv("TELEGRAM_OWNER_CHAT_ID", "123");
  vi.stubEnv("NOTIFICATIONS_MODE", "disabled");
  vi.stubEnv("NOTIFICATIONS_EXTERNAL_APPROVED", "false");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("requires fresh authorization before any message is sent", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await sendTelegramTestMessage(initial, form("Hello"))).success).toBe(
    false,
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
it("sends the custom plain-text test only to the configured owner without enabling automation", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, result: { message_id: 1 } })),
  );
  const state = await sendTelegramTestMessage(
    initial,
    form("Hello <b>owner</b>"),
  );
  expect(state.success).toBe(true);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.chat_id).toBe("123");
  expect(body.text).toContain("Hello <b>owner</b>");
  expect(body.text).toContain("not a booking notification");
  expect(body.parse_mode).toBeUndefined();
  expect(body.protect_content).toBe(true);
  expect(process.env.NOTIFICATIONS_MODE).toBe("disabled");
});
it("rejects invalid messages and missing owner configuration without network calls", async () => {
  for (const value of ["", " ", "x".repeat(1001)])
    expect((await sendTelegramTestMessage(initial, form(value))).success).toBe(
      false,
    );
  vi.stubEnv("TELEGRAM_OWNER_CHAT_ID", "-123");
  const result = await sendTelegramTestMessage(initial, form("Hello"));
  expect(result.message).toContain("TELEGRAM_OWNER_CHAT_ID");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("reports ambiguous failures without leaking provider URLs or retrying automatically", async () => {
  fetchMock.mockRejectedValue(new Error("sensitive provider URL"));
  const result = await sendTelegramTestMessage(initial, form("Hello"));
  expect(result.success).toBe(false);
  expect(result.message).toContain("may already have arrived");
  expect(result.message).not.toContain("sensitive");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("provides a clear rate-limit error", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ok: false, error_code: 429 }), {
      status: 429,
    }),
  );
  expect(
    (await sendTelegramTestMessage(initial, form("Hello"))).message,
  ).toContain("limiting messages");
});
it("the manual test adapter rejects production event payloads", async () => {
  const send = createTelegramOwnerTestTransport(readNotificationConfig());
  expect(
    (
      await send({
        channel: "telegram",
        isTest: false,
        eventId: "real-event",
        recipient: "owner",
        subject: "",
        html: "",
        text: "",
        telegramText: "Real booking",
      })
    ).outcome,
  ).toBe("provider_rejected");
  expect(fetchMock).not.toHaveBeenCalled();
});
