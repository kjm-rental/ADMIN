/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS verification harness. */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const testRoot =
  process.env.KJM_TEST_WORKDIR || "/tmp/kjm-phase6-supabase.bwb60x";
const passwordFile =
  process.env.KJM_TEST_PASSWORD_FILE || "/tmp/kjm-phase6-test-db-password";
const pgRoot =
  process.env.KJM_TEST_PG_ROOT || "/tmp/kjm-phase6-node/node_modules";
const approved = "uuxjymzrtncrnnkvdpjy";
const metadata = path.join(testRoot, "supabase/.temp");
const ref = fs.readFileSync(path.join(metadata, "project-ref"), "utf8").trim();
const url = new URL(
  fs.readFileSync(path.join(metadata, "pooler-url"), "utf8").trim(),
);
if (
  ref !== approved ||
  !decodeURIComponent(url.username).includes(approved) ||
  url.toString().includes("slevojynuumrvgiznmxk")
)
  throw new Error(
    "Approved disposable target required; production is forbidden.",
  );
url.password = fs.readFileSync(passwordFile, "utf8").trim();
const suite = process.argv[2];
if (!["phase6", "quantity", "booking", "security"].includes(suite))
  throw new Error("Choose phase6, quantity, or booking.");
const { Client } = require(path.join(pgRoot, "pg"));
(async () => {
  const c = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await c.connect();
    const { rows } = await c.query(
      "select version from supabase_migrations.schema_migrations order by version",
    );
    if (rows.length < 19 || !rows.some((r) => r.version === "202610100019"))
      throw new Error("Migrations 001–019 must already be applied.");
  } finally {
    await c.end();
  }
  const filename =
    suite === "phase6" ? "phase6-integration.cjs" : "quantity-integration.cjs";
  const script =
    suite === "security"
      ? path.join(__dirname, "security-timestamps.cjs")
      : suite === "booking"
        ? path.join(__dirname, "../final-verification/booking-lifecycle.cjs")
        : path.resolve(__dirname, "../../../KJM MAIN/supabase/tests", filename);
  const child = spawn(process.execPath, [script], {
    env: {
      ...process.env,
      TEST_DATABASE_URL: url.toString(),
      NODE_PATH: pgRoot,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    errors = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (errors += b));
  child.on("close", (code) => {
    const sanitize = (value) =>
      value
        .replaceAll(url.toString(), "[REDACTED CONNECTION]")
        .replaceAll(url.password, "[REDACTED PASSWORD]");
    const report = {
      project: approved,
      suite,
      exitCode: code,
      executedAt: new Date().toISOString(),
      productionMutations: false,
      output: sanitize(output),
      errors: sanitize(errors),
    };
    fs.writeFileSync(
      path.join(__dirname, `disposable-${suite}.json`),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        project: approved,
        suite,
        exitCode: code,
        output: report.output,
        errors: report.errors,
      }),
    );
    process.exitCode = code || 0;
  });
})().catch((e) => {
  console.error("Disposable test preflight failed:", e.code || e.name);
  process.exitCode = 1;
});
