import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
vi.mock("server-only", () => ({}));
import { readNotificationConfig, validOwnerChatId } from "./config";
import { createTransport } from "./transports";
import { renderTelegramOwnerNotification } from "./telegram-owner";
import { processNotifications } from "./worker";
import type { OutboxRow } from "./types";
const config = readNotificationConfig({
  NOTIFICATIONS_MODE: "live",
  NOTIFICATIONS_EXTERNAL_APPROVED: "true",
  TELEGRAM_BOT_TOKEN: "synthetic-token",
  TELEGRAM_OWNER_CHAT_ID: "123",
  KJM_ADMIN_BASE_URL: "https://admin.example",
});
const row = {
  id: "event-1",
  booking_id: "11111111-1111-4111-8111-111111111111",
  event_type: "booking_requested",
  channel: "telegram",
  created_at: "2026-10-13T02:00:00Z",
  payload: {
    reference: "KJM-SAMPLE",
    motorcycle: "Honda Click",
    pickupAt: "2026-10-13T02:00:00Z",
    returnAt: "2026-10-15T02:00:00Z",
    rentalCentavos: 100000,
    status: "pending",
  },
} as OutboxRow;
function database(status = "pending", verification = "under_review") {
  const tables: Record<string, unknown[]> = {
    bookings: [
      {
        customer_id: "customer-1",
        status,
        total_centavos: 100000,
        pricing_units: 2,
        status_reason: "private identity information stays in Admin",
      },
    ],
    customers: [
      {
        full_name: "Sample Customer",
        phone: "sample phone",
        auth_user_id: "customer-user",
      },
    ],
    customer_verifications: [{ overall_status: verification }],
    payment_events: [],
    booking_status_history: [
      { changed_by: "customer-user", created_at: row.created_at },
    ],
  };
  const from = vi.fn((table: string) => {
    let single = false;
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      single: () => {
        single = true;
        return q;
      },
      maybeSingle: () => {
        single = true;
        return q;
      },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: single ? tables[table]?.[0] : (tables[table] ?? []),
          error: null,
        }).then(resolve),
    };
    return q;
  });
  return { from, db: { from } as unknown as SupabaseClient<Database> };
}
it("renders stored pending, unpaid and verification states without private document lookups", async () => {
  const { db, from } = database();
  const rendered = await renderTelegramOwnerNotification(db, row, config);
  expect(rendered.telegramText).toContain("NEW BOOKING RECEIVED");
  expect(rendered.telegramText).toContain("Booking Status: pending");
  expect(rendered.telegramText).toContain("Payment Status: Unpaid");
  expect(rendered.telegramText).toContain("under review");
  expect(rendered.telegramText).toContain("10:00");
  expect(rendered.telegramText).toContain("₱1,000.00");
  expect(rendered.telegramAdminUrl).toContain(
    `/dashboard/bookings/${row.booking_id}`,
  );
  expect(from).not.toHaveBeenCalledWith("verification_documents");
});
it("reports cancellation only after cancellation is stored; free-text reasons stay in Admin", async () => {
  const cancelled = { ...row, event_type: "booking_cancelled" } as OutboxRow;
  await expect(
    renderTelegramOwnerNotification(database().db, cancelled, config),
  ).rejects.toThrow("Cancellation is not recorded");
  const result = await renderTelegramOwnerNotification(
    database("cancelled").db,
    cancelled,
    config,
  );
  expect(result.telegramText).toContain("BOOKING CANCELLED");
  expect(result.telegramText).toContain("Cancelled By: Customer");
  expect(result.telegramText).not.toContain("private identity information");
});
it("never accepts a group or malformed owner ID", () => {
  for (const id of ["", "-123", "0", "123.4", "9007199254740993"])
    expect(validOwnerChatId(id)).toBe(false);
  expect(validOwnerChatId("123")).toBe(true);
});
it("fixes delivery to the configured owner and includes the approved inline Admin button", async () => {
  const f = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } })),
    );
  const message = {
    eventId: row.id,
    channel: "telegram" as const,
    recipient: "attacker",
    subject: "",
    html: "",
    text: "",
    telegramText: "Sample only",
    telegramAdminUrl: `https://admin.example/dashboard/bookings/${row.booking_id}`,
    isTest: false,
  };
  expect((await createTransport(config, f)(message)).outcome).toBe("sent");
  const payload = JSON.parse(f.mock.calls[0][1].body);
  expect(payload.chat_id).toBe("123");
  expect(payload.reply_markup.inline_keyboard[0][0]).toMatchObject({
    text: "View Booking in Admin",
    url: message.telegramAdminUrl,
  });
  expect(payload.protect_content).toBe(true);
});
it.each([
  { telegramChatId: "" },
  { adminBase: "http://localhost:3001", development: false },
])(
  "reports invalid owner configuration instead of a false successful run: %j",
  async (invalid) => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    await expect(
      processNotifications({ ...config, ...invalid }, {
        rpc,
      } as unknown as SupabaseClient<Database>),
    ).rejects.toThrow("Owner notification configuration unavailable");
    expect(rpc).not.toHaveBeenCalled();
  },
);

it("can process only Telegram without competing for MAIN email leases", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
  await processNotifications(
    config,
    { rpc } as unknown as SupabaseClient<Database>,
    vi.fn(),
    ["telegram"],
  );
  expect(rpc).toHaveBeenCalledWith("notification_claim", {
    p_channel: "telegram",
    p_mock: false,
  });
  expect(rpc).not.toHaveBeenCalledWith("notification_claim", {
    p_channel: "resend",
    p_mock: false,
  });
});
