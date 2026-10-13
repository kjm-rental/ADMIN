/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS read-only security check. */
const fs = require("node:fs"),
  path = require("node:path");
process.loadEnvFile(path.resolve(__dirname, "../../.env.local"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (new URL(url).hostname !== "slevojynuumrvgiznmxk.supabase.co")
  throw Error("Expected production project URL required.");
(async () => {
  const controlResponse = await fetch(
    `${url}/rest/v1/motorcycle_models?select=id&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  const controlBody = await controlResponse.json();
  const control = {
    publicCatalogStatus: controlResponse.status,
    validPublicRead: controlResponse.ok && Array.isArray(controlBody),
    visiblePublishedRows: Array.isArray(controlBody)
      ? controlBody.length
      : null,
  };
  const results = [];
  for (const table of [
    "admin_users",
    "bookings",
    "customers",
    "customer_verifications",
    "verification_documents",
    "payment_events",
    "payment_intents",
    "payment_attempts",
    "audit_logs",
  ]) {
    const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    const rows = Array.isArray(body) ? body.length : null;
    results.push({
      table,
      httpStatus: response.status,
      visibleRows: rows,
      privateReadDenied:
        response.status === 401 ||
        response.status === 403 ||
        (response.ok && rows === 0),
    });
  }
  const report = {
    project: "slevojynuumrvgiznmxk",
    mode: "Unauthenticated read-only API requests; no private row contents retained",
    executedAt: new Date().toISOString(),
    control,
    results,
  };
  fs.writeFileSync(
    path.join(__dirname, "production-anon-readonly.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error("Production anonymous read-only check failed:", e.name);
  process.exitCode = 1;
});
