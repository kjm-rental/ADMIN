# Local offline design review

This harness renders the actual admin page components with explicitly labeled, synthetic fixtures. It does not authenticate, connect to Supabase, load private documents, or submit mutations. It lives outside `src/app`; no public preview route or authorization bypass is added to KJM ADMIN.

Server components render with isolated substitutes for `requireAdmin`, Next navigation/images/links, and server actions. The browser runs the actual AdminShell, InventoryQuantityForm, ConfirmButton, and error retry components. Other page forms are visual previews, with submission disabled. GET search/navigation runs against the fixtures. This is a component preview, not a production authenticated end-to-end test.

Tool dependencies are installed in temporary folders; the application package files remain unchanged.

```sh
npm install --prefix /tmp/kjm-phase8-preview esbuild --no-audit --no-fund
npm install --prefix /tmp/kjm-phase8-browser-tools playwright @axe-core/playwright --no-audit --no-fund
node /tmp/kjm-phase8-browser-tools/node_modules/playwright/cli.js install chromium --only-shell
```

From KJM ADMIN, build and run the real production application on port 3003 in one terminal:

```sh
npm run build
npm run start -- --port 3003
```

Build and start the separate preview in another terminal:

```sh
KJM_PREVIEW_TOOLS=/tmp/kjm-phase8-preview node docs/design-preview/build.cjs
node docs/design-preview/serve.cjs
```

Open http://127.0.0.1:3018/dashboard. The preview uses the production application's compiled stylesheet. Its sample values are not business records. All submissions remain disabled.

Run the browser checks in another terminal:

```sh
KJM_BROWSER_TOOLS=/tmp/kjm-phase8-browser-tools node docs/design-preview/browser-check.cjs
```

Results and screenshots are written to `docs/screenshots/phase8`. The harness tests real production sign-in and unauthenticated redirects on port 3003, plus offline component layouts/interactions on port 3018. It never enters a PIN or exercises production write actions. Generated bundles are stored in `/tmp/kjm-phase8-preview-runtime`.
