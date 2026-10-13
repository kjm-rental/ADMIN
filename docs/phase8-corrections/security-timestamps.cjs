/* eslint-disable @typescript-eslint/no-require-imports -- Disposable-only database regression. */
const { Client } = require("pg"),
  { randomUUID } = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path");
if (
  !process.env.TEST_DATABASE_URL?.includes("uuxjymzrtncrnnkvdpjy") ||
  process.env.TEST_DATABASE_URL.includes("slevojynuumrvgiznmxk")
)
  throw Error("Disposable target required");
const esbuild = require("/tmp/kjm-phase8-preview/node_modules/esbuild");
const compiled = esbuild.transformSync(
  fs.readFileSync(
    path.resolve(__dirname, "../../src/lib/business-time.ts"),
    "utf8",
  ),
  { loader: "ts", format: "cjs" },
).code;
const moduleObject = { exports: {} };
new Function("module", "exports", compiled)(moduleObject, moduleObject.exports);
const { businessTimestamp } = moduleObject.exports;
const c = new Client({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
const results = [];
function ok(name, condition) {
  results.push({ name, status: condition ? "PASS" : "FAIL" });
  if (!condition) throw Error(name);
}
(async () => {
  try {
    await c.connect();
    await c.query("begin");
    await c.query("set local statement_timeout='12s'");
    const admin = randomUUID(),
      guest = randomUUID();
    for (const id of [admin, guest])
      await c.query(
        "insert into auth.users(id,email,aud,role,is_anonymous) values($1,$2,'authenticated','authenticated',false)",
        [id, id + "@example.invalid"],
      );
    await c.query(
      "insert into public.admin_users(auth_user_id,role,is_active) values($1,'administrator',true)",
      [admin],
    );
    const claim = async (id) =>
      c.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: id, role: "authenticated", is_anonymous: false }),
      ]);
    await claim(admin);
    await c.query("set local role authenticated");
    let rows = (
      await c.query(
        "select id from public.admin_users where auth_user_id=$1 and is_active=true",
        [admin],
      )
    ).rows;
    ok(
      "Active administrator fresh lookup succeeds under RLS",
      rows.length === 1,
    );
    await c.query("reset role");
    await c.query(
      "update public.admin_users set is_active=false where auth_user_id=$1",
      [admin],
    );
    await c.query("set local role authenticated");
    rows = (
      await c.query(
        "select id from public.admin_users where auth_user_id=$1 and is_active=true",
        [admin],
      )
    ).rows;
    ok(
      "Suspended administrator fresh lookup denies even with existing JWT",
      rows.length === 0,
    );
    await claim(guest);
    rows = (
      await c.query(
        "select id from public.admin_users where auth_user_id=$1 and is_active=true",
        [guest],
      )
    ).rows;
    ok("Non-administrator lookup denies under RLS", rows.length === 0);
    for (const [input, expected] of [
      ["2031-06-01T00:01", "2031-06-01 00:01"],
      ["2031-06-01T23:59", "2031-06-01 23:59"],
      ["2031-05-31T16:01:00Z", "2031-06-01 00:01"],
    ]) {
      const timestamp = businessTimestamp(input);
      const result = (
        await c.query(
          "select to_char($1::timestamptz at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI') as local",
          [timestamp],
        )
      ).rows[0];
      ok(
        `Application conversion survives PostgreSQL timestamptz roundtrip: ${input}`,
        result.local === expected,
      );
    }
    await c.query("rollback");
    console.log(
      JSON.stringify({
        checks: results,
        fixtures: "rolled back",
        productionMutations: false,
      }),
    );
  } catch (error) {
    await c.query("rollback").catch(() => {});
    console.error(error.code || error.name);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
