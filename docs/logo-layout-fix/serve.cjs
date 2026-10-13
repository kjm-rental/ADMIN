/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const runtime = "/tmp/kjm-logo-admin-preview";
const { render } = require(runtime + "/server.cjs");
(async () => {
  const origin = "http://localhost:3001";
  const signin = await (await fetch(origin + "/sign-in")).text();
  const urls = [...signin.matchAll(/href="([^"]+\.css(?:\?[^\"]*)?)"/g)].map(
    (m) => m[1],
  );
  const chunks = await Promise.all(
    urls.map(async (url) => {
      const r = await fetch(new URL(url, origin));
      if (!r.ok) throw Error("Admin stylesheet failed: " + r.status);
      return r.text();
    }),
  );
  const css = chunks.join("\n");
  if (
    !css.includes(".admin-shell") ||
    !css.includes(".admin-brand-logo") ||
    !css.includes(".admin-skip")
  )
    throw Error("Missing administration CSS");
  fs.writeFileSync(runtime + "/styles.css", css);
  http
    .createServer(async (req, res) => {
      try {
        if (["/styles.css", "/client.js"].includes(req.url)) {
          res.setHeader(
            "Content-Type",
            req.url.endsWith(".css") ? "text/css" : "application/javascript",
          );
          res.end(fs.readFileSync(runtime + req.url));
          return;
        }
        if (req.url === "/images/brand/kjm-logo.png") {
          res.setHeader("Content-Type", "image/png");
          res.end(
            fs.readFileSync(
              path.resolve(__dirname, "../../public/images/brand/kjm-logo.png"),
            ),
          );
          return;
        }
        const { html, inner } = await render(req.url);
        res.setHeader("Content-Type", "text/html");
        res.end(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KJM logo layout verification</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root">${html}</div><script>window.previewInner=${JSON.stringify(inner).replaceAll("<", "\\u003c")}</script><script src="/client.js"></script></body></html>`,
        );
      } catch {
        res.statusCode = 500;
        res.end("Preview unavailable");
      }
    })
    .listen(3022, "127.0.0.1", () =>
      console.log("Isolated sample dashboard: http://127.0.0.1:3022/dashboard"),
    );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
