/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser review tooling. */
const http = require("http"),
  fs = require("fs");
const runtime =
  process.env.KJM_PREVIEW_OUTPUT || "/tmp/kjm-phase8-preview-runtime";
const { render } = require(runtime + "/server.cjs");
(async () => {
  const origin = process.env.KJM_ADMIN_ORIGIN || "http://localhost:3003";
  const signin = await (await fetch(origin + "/sign-in")).text();
  const urls = [...signin.matchAll(/href="([^"]+\.css(?:\?[^\"]*)?)"/g)].map(
    (m) => m[1],
  );
  fs.writeFileSync(
    runtime + "/styles.css",
    (
      await Promise.all(
        urls.map((u) => fetch(origin + u).then((r) => r.text())),
      )
    ).join("\n"),
  );
  http
    .createServer(async (req, res) => {
      try {
        if (req.url === "/styles.css" || req.url === "/client.js") {
          res.setHeader(
            "Content-Type",
            req.url.endsWith(".css") ? "text/css" : "application/javascript",
          );
          res.end(fs.readFileSync(runtime + req.url));
          return;
        }
        const { html, inner } = await render(req.url);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KJM offline design preview</title><link rel="stylesheet" href="/styles.css"><style>.preview-banner{background:#fff4dc;color:#624808;padding:10px 18px;font:12px Arial;position:relative;z-index:45}.admin-sidebar{top:34px}.admin-mobile-dialog{top:0}</style></head><body><div class="preview-banner">OFFLINE DESIGN FIXTURE · Sample data only · All submissions disabled</div><div id="root">${html}</div><script>window.previewInner=${JSON.stringify(inner).replaceAll("<", "\\u003c")}</script><script src="/client.js"></script></body></html>`,
        );
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
        console.error(e);
      }
    })
    .listen(3018, "127.0.0.1", () =>
      console.log("Offline component preview: http://127.0.0.1:3018/dashboard"),
    );
})();
