import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { createServer } from "vite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(root, true, { info() {}, error() {} });
const sending = process.argv.includes("--send");
const recipient = process.env.RESEND_TEST_RECIPIENT || "delivered@resend.dev";
const vite = await createServer({
  root,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  resolve: {
    alias: { "server-only": path.join(root, "scripts/server-only-cli.mjs") },
  },
});
try {
  const { readNotificationConfig } = await vite.ssrLoadModule(
    "/src/lib/notifications/config.ts",
  );
  const { renderNotification } = await vite.ssrLoadModule(
    "/src/lib/notifications/templates.ts",
  );
  const { createResendTestTransport } = await vite.ssrLoadModule(
    "/src/lib/notifications/transports.ts",
  );
  const config = readNotificationConfig();
  const payload = {
    bookingId: "11111111-1111-4111-8111-111111111111",
    reference: "KJM-SYNTHETIC-TEST",
    motorcycle: "Synthetic motorcycle — preview only",
    pickupAt: "2030-01-01T01:00:00Z",
    returnAt: "2030-01-02T01:00:00Z",
    rentalCentavos: 10000,
    status: "pending",
  };
  const events = [
    "booking_requested",
    "booking_approved",
    "booking_cancelled",
    "pickup_reminder",
    "return_reminder",
  ];
  if (!sending) {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "kjm-resend-preview-"),
    );
    fs.chmodSync(directory, 0o700);
    for (const event of events) {
      const rendered = renderNotification(event, payload, config);
      fs.writeFileSync(path.join(directory, event + ".html"), rendered.html, {
        mode: 0o600,
      });
      fs.writeFileSync(path.join(directory, event + ".txt"), rendered.text, {
        mode: 0o600,
      });
    }
    console.log(
      JSON.stringify({
        mode: "preview",
        templates: events.length,
        directory,
        networkRequests: 0,
        apiKeyConfigured: Boolean(config.resendKey),
      }),
    );
  } else {
    // One synthetic message only, never a database/outbox lookup or customer record.
    const rendered = renderNotification("booking_approved", payload, config);
    const result = await createResendTestTransport(config)({
      channel: "resend",
      eventId: randomUUID(),
      recipient,
      isTest: true,
      ...rendered,
      subject: "[KJM SYNTHETIC TEST] " + rendered.subject,
    });
    console.log(
      JSON.stringify({ mode: "provider-test", outcome: result.outcome }),
    );
    if (result.outcome !== "sent") process.exitCode = 1;
  }
} catch {
  console.error(
    "Resend test could not complete. Check server-only configuration and test guards; no provider details are logged.",
  );
  process.exitCode = 1;
} finally {
  await vite.close();
}
