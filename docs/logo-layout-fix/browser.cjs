/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path");
const {
  chromium,
} = require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/playwright");
const AxeBuilder =
  require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/@axe-core/playwright").default;
(async () => {
  const b = await chromium.launch({ headless: true }),
    results = [];
  try {
    for (const width of [360, 390, 768, 1024, 1440]) {
      const context = await b.newContext({ viewport: { width, height: 1000 } }),
        p = await context.newPage();
      await p.goto("http://127.0.0.1:3022/dashboard");
      await p
        .getByRole("heading", { name: /overview|operations|good/i })
        .first()
        .waitFor();
      const skip = p.getByRole("link", { name: "Skip to workspace" });
      await p.waitForTimeout(300);
      const hidden = await skip.evaluate(
        (el) => el.getBoundingClientRect().bottom <= 0,
      );
      if (!hidden) throw Error("Skip link permanently visible");
      await p.keyboard.press("Tab");
      if (
        !(await skip.evaluate(
          (el) =>
            el === document.activeElement &&
            el.getBoundingClientRect().top >= 0,
        ))
      )
        throw Error("Skip focus not visible");
      await p.keyboard.press("Enter");
      if (
        !(await p
          .locator("#admin-content")
          .evaluate((el) => el === document.activeElement))
      )
        throw Error("Skip does not focus workspace");
      if (width < 1024) {
        await p.getByRole("button", { name: "Open navigation" }).click();
        await p
          .getByRole("dialog", { name: "Administration navigation" })
          .waitFor();
      }
      const logo =
        width < 1024
          ? p.locator("dialog img.admin-brand-logo")
          : p.locator(".admin-sidebar img.admin-brand-logo");
      await logo.waitFor();
      await p.waitForFunction(() =>
        [...document.querySelectorAll(".admin-brand-logo")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      const size = await logo.evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
        objectFit: getComputedStyle(el).objectFit,
      }));
      if (size.width > 160 || size.height > 72 || size.objectFit !== "contain")
        throw Error("Logo out of bounds");
      if (width < 1024) {
        await p
          .getByRole("button", { name: "Close navigation", exact: true })
          .click();
      }
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) throw Error("Page overflow " + width);
      const axe = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      await p.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      if (
        !(await skip.evaluate((el) => el.getBoundingClientRect().bottom <= 0))
      )
        throw Error("Skip link visible without focus");
      await p.screenshot({
        path: path.join(__dirname, "dashboard-" + width + ".png"),
        fullPage: true,
      });
      let collapsedIcon = false;
      if (width >= 1024) {
        await p.getByRole("button", { name: "Collapse sidebar" }).click();
        collapsedIcon = await p
          .locator(".admin-sidebar .admin-brand-mark svg")
          .isVisible();
        if (
          !collapsedIcon ||
          (await p.locator(".admin-sidebar img.admin-brand-logo").count())
        )
          throw Error("Collapsed sidebar still renders full logo");
        await p.screenshot({
          path: path.join(__dirname, "collapsed-" + width + ".png"),
          fullPage: true,
        });
        await p.getByRole("button", { name: "Expand sidebar" }).click();
      }
      // Inline image bounds survive complete stylesheet loss; reload restores layout.
      await p.evaluate(() =>
        document
          .querySelectorAll('link[rel="stylesheet"],style')
          .forEach((el) => el.remove()),
      );
      const fallback = await p
        .locator(".admin-sidebar img.admin-brand-logo")
        .evaluate((el) => el.getBoundingClientRect().width);
      if (fallback > 160) throw Error("Unstyled logo escapes bounds");
      results.push({
        width,
        logo: size,
        overflow,
        skipHidden: true,
        skipFocusWorks: true,
        collapsedIcon: width >= 1024 ? collapsedIcon : "mobile dialog",
        unstyledLogoWidth: fallback,
        axeViolations: axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.length,
        })),
      });
      await context.close();
    }
    const p = await b.newPage();
    await p.goto("http://localhost:3001/dashboard");
    results.push({
      actualLocalhost3001: true,
      url: p.url(),
      authenticatedDashboardVerified: false,
      reason:
        "Signed-in browser unavailable to tool: Computer Use permissions not granted; isolated browser correctly redirects to sign-in",
    });
  } finally {
    await b.close();
    fs.writeFileSync(
      path.join(__dirname, "browser-results.json"),
      JSON.stringify(
        {
          mode: "Actual AdminShell/overview source with synthetic fixtures and live localhost admin styles; no Supabase access",
          results,
        },
        null,
        2,
      ),
    );
  }
  if (results.some((r) => r.axeViolations?.length))
    throw Error("Accessibility violation");
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
