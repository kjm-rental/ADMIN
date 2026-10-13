/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser regression tooling. */
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const root = path.resolve(__dirname, "../.."),
  out = __dirname;
const esbuild = require("/tmp/kjm-phase8-preview/node_modules/esbuild");
const {
  chromium,
} = require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/playwright");
const AxeBuilder =
  require("/tmp/kjm-phase7-browser.xAGrbn/node_modules/@axe-core/playwright").default;
(async () => {
  const bundle = await esbuild.build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ActionForm} from '${root}/src/components/action-form.tsx';import {SubmitButton} from '${root}/src/components/submit-button.tsx';import {ConfirmButton} from '${root}/src/components/confirm-button.tsx';import {InventoryQuantityForm} from '${root}/src/components/inventory-quantity-form.tsx';window.calls=0;window.inventoryCalls=0;window.submittedValues=[];async function synthetic(data){window.calls++;window.submittedValues.push(data.get('result'));await new Promise((resolve,reject)=>{window.complete=()=>window.fail?reject(Error('Synthetic failure')):resolve()})}createRoot(document.getElementById('root')).render(<main style={{padding:24,maxWidth:600,margin:'auto'}}><h1 className="text-2xl font-extrabold">Isolated submission regression</h1><p>Synthetic actions only. No Supabase connection or administrator session.</p><ActionForm action={synthetic} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><label className="block text-sm font-bold">Review note<input className="mt-2 block min-h-11 w-full rounded-xl border border-slate-200 px-3" name="note" defaultValue="Synthetic" /></label><SubmitButton name="result" value="approved">Approve synthetic record</SubmitButton><ConfirmButton className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700" message="Synthetic confirmation only" name="result" value="rejected">Reject synthetic record</ConfirmButton></ActionForm><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="text-xl font-bold">Synthetic quantity</h2><InventoryQuantityForm modelId="synthetic-model" total={4}/></section></main>);`,
      resolveDir: root,
      loader: "jsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    nodePaths: [path.join(root, "node_modules")],
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-next",
        setup(build) {
          build.onResolve({ filter: /^@\// }, (args) =>
            args.path === "@/app/actions/fleet"
              ? { path: "inventory", namespace: "mock" }
              : {
                  path:
                    path.join(root, "src", args.path.slice(2)) +
                    (args.path.includes("/components/") ? ".tsx" : ".ts"),
                },
          );
          build.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "mock",
          }));
          build.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
            contents:
              args.path === "inventory"
                ? `export async function saveInventoryQuantity(previous,data){window.inventoryCalls++;window.inventoryData={total:data.get("total"),expected:data.get("expectedTotal")};await new Promise(resolve=>window.finishInventory=resolve);return {saved:true,error:""}}`
                : `export function unstable_rethrow(error){if(error?.digest?.startsWith('NEXT_REDIRECT'))throw error}`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const cssFiles = fs
    .readdirSync(path.join(root, ".next/static/chunks"))
    .filter((f) => f.endsWith(".css"));
  const css = cssFiles
    .map((f) =>
      fs.readFileSync(path.join(root, ".next/static/chunks", f), "utf8"),
    )
    .join("\n");
  const server = http.createServer((req, res) => {
    res.setHeader(
      "Content-Type",
      req.url === "/bundle.js" ? "application/javascript" : "text/html",
    );
    res.end(
      req.url === "/bundle.js"
        ? bundle.outputFiles[0].text
        : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated controls</title><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true }),
    results = [];
  try {
    for (const width of [360, 390, 768, 1024, 1440]) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
        }),
        page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page
        .getByRole("button", { name: "Approve synthetic record" })
        .waitFor();
      await page
        .getByRole("button", { name: "Approve synthetic record" })
        .focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => window.calls === 1 && document.querySelector("fieldset").disabled,
      );
      if (!(await page.locator("fieldset").evaluate((el) => el.disabled)))
        throw Error("Pending fieldset not disabled");
      if (
        !(await page
          .getByRole("button", { name: "Saving…", exact: true })
          .isDisabled())
      )
        throw Error("Pending submitter not disabled");
      if (
        !(await page
          .getByRole("button", { name: "Reject synthetic record" })
          .isDisabled())
      )
        throw Error("Pending confirm button not disabled");
      await page.evaluate(() => {
        const form = document.querySelector("form");
        form.requestSubmit();
        form.requestSubmit();
      });
      if ((await page.evaluate(() => window.calls)) !== 1)
        throw Error("Duplicate submission");
      await page.screenshot({
        path: path.join(out, `controls-pending-${width}.png`),
        fullPage: true,
      });
      await page.evaluate(() => window.complete());
      await page
        .getByRole("status")
        .filter({ hasText: "Change saved successfully." })
        .waitFor();
      if ((await page.evaluate(() => window.submittedValues[0])) !== "approved")
        throw Error("Named submitter lost");
      page.on("dialog", (dialog) => dialog.accept());
      await page.evaluate(() => (window.fail = true));
      await page
        .getByRole("button", { name: "Reject synthetic record" })
        .click();
      await page.waitForFunction(() => window.calls === 2);
      await page.evaluate(() => window.complete());
      await page.getByRole("alert").waitFor();
      if ((await page.evaluate(() => window.submittedValues[1])) !== "rejected")
        throw Error("Confirm submitter lost");
      if (await page.locator("fieldset").evaluate((el) => el.disabled))
        throw Error("Controls not restored");
      await page.screenshot({
        path: path.join(out, `controls-error-${width}.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Increase total units" }).click();
      await page
        .getByRole("button", { name: "Save quantity", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          window.inventoryCalls === 1 &&
          document.querySelector("#inventory-total").disabled,
      );
      await page.evaluate(() => {
        const form = document.querySelector("#inventory-total").closest("form");
        form.requestSubmit();
        form.requestSubmit();
      });
      if ((await page.evaluate(() => window.inventoryCalls)) !== 1)
        throw Error("Duplicate inventory submission");
      if (
        (await page.evaluate(() => window.inventoryData.total)) !== "5" ||
        (await page.evaluate(() => window.inventoryData.expected)) !== "4"
      )
        throw Error("Quantity concurrency parameters changed");
      await page.evaluate(() => window.finishInventory());
      await page
        .getByRole("status")
        .filter({ hasText: "Inventory quantity saved." })
        .waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      results.push({
        width,
        pendingDisabled: true,
        duplicatesPrevented: true,
        inventoryPendingAndDuplicates: true,
        keyboardSubmit: true,
        namedSubmittersPreserved: true,
        successFeedback: true,
        failureFeedback: true,
        overflow,
        axeViolations: axe.violations.map((v) => v.id),
      });
      if (overflow || axe.violations.length)
        throw Error("Layout/accessibility failure");
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  fs.writeFileSync(
    path.join(out, "browser-controls.json"),
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        authenticated: false,
        data: "synthetic only",
        productionMutations: false,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
