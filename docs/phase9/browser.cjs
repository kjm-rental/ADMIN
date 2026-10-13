/* eslint-disable @typescript-eslint/no-require-imports -- Offline browser inspection, no authenticated data. */
const {
  chromium,
} = require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/playwright");
const Axe =
  require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/@axe-core/playwright").default;
const fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const out = path.join(__dirname, "screenshots");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const report = {
    scope:
      "Offline fixtures only; submissions disabled; not authenticated Supabase",
    layouts: [],
    accessibility: [],
    errors: [],
  };
  page.on("pageerror", (e) => report.errors.push(e.message));
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "",
      "bookings",
      "bookings/booking-demo-1",
      "bookings/booking-demo-2",
      "calendar",
      "verifications",
      "fleet",
      "extras",
      "customers",
      "finance",
      "reports",
      "settings",
      "deposits",
    ]) {
      const r = await page.goto(
        "http://127.0.0.1:3019/dashboard" + (route ? "/" + route : ""),
      );
      await page.waitForTimeout(150);
      report.layouts.push({
        width,
        route: route || "overview",
        http: r.status(),
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
      if ([390, 1440].includes(width)) {
        if (
          [
            "settings",
            "deposits",
            "bookings/booking-demo-1",
            "bookings/booking-demo-2",
            "",
          ].includes(route)
        )
          await page.screenshot({
            path: path.join(
              out,
              (route.replaceAll("/", "-") || "overview") + "-" + width + ".png",
            ),
            fullPage: true,
          });
        const axe = await new Axe({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        report.accessibility.push({
          width,
          route,
          violations: axe.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        });
      }
    }
  }
  await browser.close();
  fs.writeFileSync(
    path.join(__dirname, "browser-results.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        layouts: report.layouts.length,
        failures: report.layouts.filter((r) => r.http !== 200 || r.overflow),
        accessibilityFailures: report.accessibility.filter(
          (r) => r.violations.length,
        ),
        errors: report.errors,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
