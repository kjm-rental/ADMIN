/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const esbuild = require("/tmp/kjm-phase8-preview/node_modules/esbuild");
const {
  chromium,
} = require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/playwright");
const AxeBuilder =
  require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/@axe-core/playwright").default;
(async () => {
  const root = path.resolve(__dirname, "../.."),
    out = path.join(__dirname, "emails");
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(root, "src/lib/notifications/templates.ts")],
    outfile: "/tmp/kjm-phase10-templates.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
  });
  const { renderNotification } = require("/tmp/kjm-phase10-templates.cjs");
  const events = [
    "booking_requested",
    "booking_approved",
    "booking_rejected",
    "verification_action",
    "booking_cancelled",
    "pickup_reminder",
    "handover",
    "return_reminder",
    "returned",
    "cash_payment",
    "deposit_collected",
    "deposit_returned",
  ];
  const payload = {
    bookingId: "11111111-1111-4111-8111-111111111111",
    reference: "KJM-SAMPLE",
    motorcycle: "Synthetic motorcycle",
    pickupAt: "2026-10-12T01:00:00Z",
    returnAt: "2026-10-13T01:00:00Z",
    rentalCentavos: 51200,
    depositOption: "cash",
    depositCentavos: 12345,
    amountCentavos: 12345,
    status: "pending",
  };
  for (const event of events) {
    const r = renderNotification(event, payload, {
      mainBase: "http://localhost:3000",
      development: true,
    });
    fs.writeFileSync(path.join(out, event + ".html"), r.html);
    fs.writeFileSync(path.join(out, event + ".txt"), r.text);
  }
  const server = http.createServer((req, res) => {
    const event = req.url.slice(1).replace(".html", "");
    if (!events.includes(event)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(fs.readFileSync(path.join(out, event + ".html")));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true }),
    results = [];
  try {
    for (const width of [360, 390, 768, 1024, 1440])
      for (const event of events) {
        const context = await browser.newContext({
            viewport: { width, height: 1000 },
          }),
          page = await context.newPage();
        await page.goto(
          `http://127.0.0.1:${server.address().port}/${event}.html`,
        );
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        if (overflow) throw Error("Email overflow " + width + " " + event);
        const violations = (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations;
        results.push({
          width,
          event,
          overflow,
          axeViolations: violations.map((v) => v.id),
        });
        if (
          [390, 1440].includes(width) &&
          ["booking_requested", "cash_payment"].includes(event)
        )
          await page.screenshot({
            path: path.join(out, event + "-" + width + ".png"),
            fullPage: true,
          });
        await context.close();
      }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    fs.writeFileSync(
      path.join(__dirname, "email-browser-results.json"),
      JSON.stringify(
        {
          mode: "Synthetic HTML email rendering in Chromium; not real mailbox/client delivery",
          results,
        },
        null,
        2,
      ),
    );
  }
  if (results.some((r) => r.axeViolations.length))
    throw Error("Email accessibility violations");
  console.log(
    "Passed " + results.length + " email layout/accessibility checks",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
