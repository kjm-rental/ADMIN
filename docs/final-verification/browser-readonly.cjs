/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser verification. */
const path = require("node:path"),
  fs = require("node:fs");
const modules =
  process.env.KJM_BROWSER_TOOLS || "/tmp/kjm-phase7-browser.xAGrbn";
const { chromium } = require(path.join(modules, "node_modules/playwright"));
const AxeBuilder = require(
  path.join(modules, "node_modules/@axe-core/playwright"),
).default;
const origin = process.env.KJM_ADMIN_ORIGIN || "http://localhost:3003";
const out = path.join(__dirname, "screenshots");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const layouts = [],
      accessibility = [],
      gates = [];
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/sign-in");
      await page.getByRole("heading", { name: "Welcome back" }).waitFor();
      layouts.push({
        width,
        view: "Real production-connected sign-in",
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      accessibility.push({
        width,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          targets: v.nodes.map((n) => n.target),
        })),
      });
      await page.screenshot({
        path: path.join(out, `sign-in-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    for (const route of [
      "",
      "/bookings",
      "/calendar",
      "/verifications",
      "/fleet",
      "/extras",
      "/customers",
      "/finance",
      "/reports",
      "/settings",
      "/fleet/new",
      "/bookings/00000000-0000-4000-8000-000000000001",
      "/fleet/00000000-0000-4000-8000-000000000001",
      "/documents/00000000-0000-4000-8000-000000000001",
    ]) {
      await page.goto(origin + "/dashboard" + route);
      gates.push({
        route: "/dashboard" + route,
        redirectToSignIn: new URL(page.url()).pathname === "/sign-in",
        adminNavigationHidden:
          (await page.locator(".admin-nav-link").count()) === 0,
      });
    }
    await page.locator('input[name="pin"]').focus();
    const focusVisible = await page
      .locator('input[name="pin"]')
      .evaluate((e) => getComputedStyle(e).outlineStyle !== "none");
    const report = {
      executedAt: new Date().toISOString(),
      origin,
      authenticated: false,
      productionRecordMutations: false,
      layouts,
      accessibility,
      gates,
      focusVisible,
      errors,
      notExecuted: [
        "Authenticated admin layouts and real record loading",
        "Production mutation actions",
        "Private document opening (access endpoint writes an audit record)",
      ],
    };
    fs.writeFileSync(
      path.join(__dirname, "browser-readonly.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        layouts: layouts.length,
        overflow: layouts.filter((x) => x.overflow),
        axeScans: accessibility.length,
        violations: accessibility.filter((x) => x.violations.length),
        gates: gates.length,
        failedGates: gates.filter(
          (x) => !x.redirectToSignIn || !x.adminNavigationHidden,
        ),
        focusVisible,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
