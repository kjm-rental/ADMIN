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
const root = path.resolve(__dirname, "../.."),
  out = __dirname;
(async () => {
  const plugin = {
    name: "synthetic-only",
    setup(b) {
      b.onResolve({ filter: /^(next\/|@\/)/ }, (a) => {
        if (a.path.startsWith("next/"))
          return { path: a.path, namespace: "mock" };
        if (a.path.startsWith("@/app/actions/"))
          return { path: a.path, namespace: "mock" };
        const p = path.join(root, "src", a.path.slice(2));
        return { path: fs.existsSync(p + ".tsx") ? p + ".tsx" : p + ".ts" };
      });
      b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => {
        if (a.path === "next/link")
          return {
            contents:
              "import React from 'react';export default function Link(p){return <a {...p}/>}",
            loader: "jsx",
            resolveDir: root,
          };
        if (a.path === "next/navigation")
          return {
            contents:
              "export const usePathname=()=>'/dashboard/settings/notifications';export const unstable_rethrow=()=>{};",
            loader: "js",
          };
        const source = fs.readFileSync(
          path.join(root, "src", a.path.slice(2) + ".ts"),
          "utf8",
        );
        const names = [
          ...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g),
        ].map((m) => m[1]);
        return {
          contents: a.path.endsWith("/feedback")
            ? "export async function submitAdminAction(action,prev,data){try{await action(data);return {saved:true,error:''}}catch(e){return {saved:false,error:e.message}}}"
            : names
                .map(
                  (n) =>
                    `export async function ${n}(){window.actionCalls++;await new Promise(resolve=>window.finishAction=resolve);if(window.failActions)throw Error('Synthetic delivery failure; no provider contacted')}`,
                )
                .join("\n"),
          loader: "js",
        };
      });
    },
  };
  const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {NotificationManagement} from '${root}/src/components/notification-management.tsx';import {AdminShell} from '${root}/src/components/admin-shell.tsx';
const now=new Date().toISOString(),id='11111111-1111-4111-8111-111111111111',base={id,booking_id:id,booking_reference:'KJM-SYNTHETIC',event_type:'cash_payment',channel:'resend',attempt_count:2,manual_retry_count:0,created_at:now,last_attempt_at:now,first_attempt_at:now,delivered_at:null,last_error:'transient',simulated:false};const props={available:!location.search.includes('missing'),settings:{telegram_enabled:false,resend_enabled:false,enabled_events:['booking_requested','cash_payment','deposit_collected'],reminders_approved:false,pickup_hours:24,return_hours:24,morning_hour:8},history:location.search.includes('empty')?[]:[{...base,status:'retry_scheduled'},{...base,id:'sent',event_type:'deposit_collected',channel:'telegram',status:'sent',simulated:true,last_error:null,delivered_at:now},{...base,id:'ambiguous',event_type:'overdue',channel:'telegram',status:'failed_permanently',last_error:'delivery_ambiguous'}],generationErrors:[],lastDelivery:[{...base,channel:'telegram',simulated:true,delivered_at:now}],lastFailure:[base],configuration:{mode:'mock',externalApproved:false,telegramConfigured:false,telegramVerified:false,resendConfigured:false,senderVerification:'Not verified'}};window.actionCalls=0;createRoot(document.getElementById('root')).render(<AdminShell email='preview@example.invalid'><p className='mb-6 rounded-xl bg-amber-50 p-3 text-xs text-amber-900'>OFFLINE SYNTHETIC PREVIEW · No administrator session · No Supabase or provider connection</p><NotificationManagement {...props}/></AdminShell>);`;
  const bundle = await esbuild.build({
    stdin: {
      contents: entry,
      resolveDir: root,
      loader: "jsx",
      resolveDir: root,
    },
    bundle: true,
    write: false,
    plugins: [plugin],
    platform: "browser",
    jsx: "automatic",
    nodePaths: [root + "/node_modules"],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const css = fs
    .readdirSync(root + "/.next/static/chunks")
    .filter((f) => f.endsWith(".css"))
    .map((f) => fs.readFileSync(root + "/.next/static/chunks/" + f, "utf8"))
    .join("\n");
  const server = http.createServer((req, res) => {
    res.setHeader(
      "Content-Type",
      req.url === "/bundle.js" ? "application/javascript" : "text/html",
    );
    res.end(
      req.url === "/bundle.js"
        ? bundle.outputFiles[0].text
        : `<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>KJM notification mock preview</title><style>${css}</style></head><body><div id='root'></div><script src='/bundle.js'></script></body></html>`,
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true }),
    results = [],
    errors = [];
  try {
    for (const width of [360, 390, 768, 1024, 1440]) {
      const context = await browser.newContext({
          viewport: { width, height: 1000 },
        }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      const origin = `http://127.0.0.1:${server.address().port}`;
      await page.goto(origin);
      await page
        .getByRole("heading", { name: "Keep every ride connected." })
        .waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) throw Error("Page overflow at " + width);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      results.push({
        width,
        scenario: "history",
        overflow,
        axeViolations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
        })),
      });
      await page.screenshot({
        path: path.join(out, "notifications-" + width + ".png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Save notification preferences" })
        .focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () =>
          window.actionCalls === 1 &&
          document.querySelector('form[aria-busy="true"]'),
      );
      const pendingDisabled = await page
        .getByRole("button", { name: "Save notification preferences" })
        .isDisabled();
      if (!pendingDisabled) throw Error("Pending preferences not disabled");
      await page.evaluate(() =>
        document.querySelector('form[aria-busy="true"]').requestSubmit(),
      );
      if ((await page.evaluate(() => window.actionCalls)) !== 1)
        throw Error("Duplicate action");
      await page.evaluate(() => window.finishAction());
      await page
        .getByRole("status")
        .filter({ hasText: "Change saved successfully." })
        .waitFor();
      let rejected = false;
      page.once("dialog", async (d) => {
        rejected = true;
        await d.dismiss();
      });
      await page.getByRole("button", { name: "Retry email" }).click();
      if (!rejected || (await page.evaluate(() => window.actionCalls)) !== 1)
        throw Error("Confirmation cancel failed");
      page.once("dialog", (d) => d.accept());
      await page.evaluate(() => (window.failActions = true));
      await page.getByRole("button", { name: "Retry email" }).click();
      await page.waitForFunction(() => window.actionCalls === 2);
      await page.evaluate(() => window.finishAction());
      await page
        .getByRole("alert")
        .filter({ hasText: "Synthetic delivery failure" })
        .waitFor();
      results.push({
        width,
        scenario: "keyboard-and-controls",
        pendingDisabled,
        duplicateSubmissionsPrevented: true,
        retryConfirmation: true,
        clearError: true,
      });
      for (const query of ["?empty", "?missing"]) {
        await page.goto(origin + query);
        await page
          .getByRole("heading", { name: "Keep every ride connected." })
          .waitFor();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        if (overflow) throw Error("State overflow");
        results.push({ width, scenario: query, overflow });
      }
      await context.close();
    }
    const p = await browser.newPage();
    const r = await p.goto(
      "http://localhost:3001/dashboard/settings/notifications",
    );
    results.push({
      scenario: "real-unauthenticated-route",
      status: r.status(),
      signInProtected: p.url().includes("/sign-in"),
    });
    if (!p.url().includes("/sign-in"))
      throw Error("Protected route did not require authentication");
    if (errors.length) throw Error("Browser errors: " + errors.join(", "));
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    fs.writeFileSync(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          mode: "Isolated synthetic component preview; no authenticated administrator or real providers",
          results,
          errors,
        },
        null,
        2,
      ),
    );
  }
  if (results.some((r) => r.axeViolations?.length))
    throw Error("Accessibility violations found");
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
