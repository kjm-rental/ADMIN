/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser review tooling. */
const { chromium } = require(
  (process.env.KJM_BROWSER_TOOLS || "/tmp/kjm-phase7-browser.xAGrbn") +
    "/node_modules/playwright",
);
const AxeBuilder = require(
  (process.env.KJM_BROWSER_TOOLS || "/tmp/kjm-phase7-browser.xAGrbn") +
    "/node_modules/@axe-core/playwright",
).default;
const fs = require("fs");
const out = require("path").resolve(__dirname, "screenshots");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let report = { layouts: [], accessibility: [], interactions: [] };
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const routes = [
    "",
    "bookings",
    "bookings/booking-demo-0",
    "calendar",
    "verifications",
    "fleet",
    "fleet/model-demo",
    "fleet/new",
    "extras",
    "customers",
    "finance",
    "reports",
    "settings",
  ];
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(
        "http://127.0.0.1:3018/dashboard" + (route ? "/" + route : ""),
      );
      await page.waitForTimeout(180);
      const horizontal = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      report.layouts.push({ width, route: route || "overview", horizontal });
      if ([390, 1440].includes(width)) {
        await page.screenshot({
          path: `${out}/${route.replaceAll("/", "-") || "overview"}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      if ([390, 1440].includes(width)) {
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        report.accessibility.push({
          width,
          route: route || "overview",
          violations: results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3018/dashboard");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  report.interactions.push({
    name: "Mobile drawer opens, Escape closes, focus returns",
    pass: await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .evaluate((e) => e === document.activeElement),
  });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Bookings", exact: true })
    .click();
  report.interactions.push({
    name: "Mobile navigation to bookings",
    pass: page.url().includes("/bookings"),
  });
  await page
    .getByRole("textbox", { name: "Search bookings" })
    .fill("doesnotexist");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  report.interactions.push({
    name: "Booking search filters fixture records",
    pass: await page.getByText("No bookings match this view.").isVisible(),
  });
  for (const query of ["span", "<img src=x onerror=window.injected=true>"]) {
    await page.getByRole("textbox", { name: "Search bookings" }).fill(query);
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    report.interactions.push({
      name: "Plain-text search regression: " + query,
      pass:
        (await page.getByText("No bookings match this view.").isVisible()) &&
        (await page
          .getByRole("textbox", { name: "Search bookings" })
          .inputValue()) === query &&
        (await page.evaluate(() => window.injected === undefined)),
    });
  }
  await page.goto("http://127.0.0.1:3018/dashboard/extras");
  await page.locator("summary").click();
  report.interactions.push({
    name: "Extra editor expands",
    pass: await page
      .locator("details")
      .getByRole("button", { name: "Save changes" })
      .isVisible(),
  });
  await page.goto("http://127.0.0.1:3018/dashboard/fleet/model-demo");
  await page.getByRole("button", { name: "Increase total units" }).click();
  report.interactions.push({
    name: "Inventory quantity increment",
    pass: (await page.locator("#inventory-total").inputValue()) === "5",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:3018/dashboard");
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await page.waitForTimeout(220);
  report.interactions.push({
    name: "Desktop sidebar collapses",
    pass: await page
      .locator(".admin-sidebar")
      .evaluate((e) => e.getBoundingClientRect().width < 100),
  });
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  report.interactions.push({
    name: "Reduced motion",
    pass: await page
      .locator(".admin-workspace>div")
      .evaluate((e) => getComputedStyle(e).animationName === "none"),
  });
  await page.goto("http://127.0.0.1:3018/dashboard/preview-states");
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Try again" }).last().click();
  report.interactions.push({
    name: "Error retry control",
    pass: await page.evaluate(() => window.previewRetried === true),
  });
  report.interactions.push({
    name: "Loading status announced",
    pass: await page
      .getByRole("status", { name: "Loading admin workspace" })
      .isVisible(),
  });
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Preview irreversible action" })
    .click();
  report.interactions.push({
    name: "Confirmation cancellation prevents submission",
    pass: await page.evaluate(() => !window.previewSubmitCount),
  });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Preview irreversible action" })
    .click();
  report.interactions.push({
    name: "Confirmation acceptance allows disabled fixture submission",
    pass: await page.evaluate(() => window.previewSubmitCount === 1),
  });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("http://localhost:3003/sign-in");
    report.layouts.push({
      width,
      route: "live-sign-in",
      horizontal: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: `${out}/live-sign-in-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
  }
  const liveAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  report.accessibility.push({
    route: "live-sign-in",
    violations: liveAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.failureSummary),
    })),
  });
  for (const route of routes) {
    await page.goto(
      "http://localhost:3003/dashboard" + (route ? "/" + route : ""),
    );
    report.interactions.push({
      name: "Unauthenticated gate: " + (route || "overview"),
      pass: page.url().includes("/sign-in"),
    });
  }
  report.errors = errors;
  fs.writeFileSync(
    out + "/browser-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        overflow: report.layouts.filter((r) => r.horizontal),
        accessibility: report.accessibility.filter((r) => r.violations.length),
        interactions: report.interactions,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
