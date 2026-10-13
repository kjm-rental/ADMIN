/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS action review diagnostic. */
const fs = require("node:fs"),
  path = require("node:path");
const esbuild = require("/tmp/kjm-phase8-preview/node_modules/esbuild");
const root = path.resolve(__dirname, "../..");
const mocks = {
  "@/lib/auth": `export async function requireAdmin(){globalThis.diagnostic.requireAdminCalls++;return {supabase:{rpc:async(name,args)=>{globalThis.diagnostic.rpc={name,args};return {error:null}}}}}`,
  "@/lib/supabase/server": `export async function createClient(){return {auth:{signInWithPassword:async()=>({error:null}),updateUser:async()=>{globalThis.diagnostic.passwordUpdates++;return {error:null}}}}}`,
  "@/lib/pin": `export const derivePinCredential=()=> 'synthetic credential only';`,
  "next/cache": `export const revalidatePath=()=>{};`,
  "next/navigation": `export const redirect=(url)=>{throw Error('DIAGNOSTIC_REDIRECT:'+url)};`,
};
const plugin = {
  name: "controlled-boundary",
  setup(build) {
    build.onResolve({ filter: /^(next\/|@\/)/ }, (a) =>
      mocks[a.path]
        ? { path: a.path, namespace: "mock" }
        : a.path.startsWith("@/")
          ? { path: path.join(root, "src", a.path.slice(2) + ".ts") }
          : undefined,
    );
    build.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
      contents: mocks[a.path],
      loader: "js",
    }));
  },
};
(async () => {
  process.env.TZ = "UTC";
  process.env.ADMIN_LOGIN_EMAIL = "synthetic@example.invalid";
  globalThis.diagnostic = { requireAdminCalls: 0, passwordUpdates: 0 };
  const entry = `import * as bookings from '${root}/src/app/actions/bookings.ts';import {changePin} from '${root}/src/app/actions/auth.ts';export {bookings,changePin};`;
  const output = await esbuild.build({
    stdin: { contents: entry, resolveDir: root },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    nodePaths: [root + "/node_modules"],
    plugins: [plugin],
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", output.outputFiles[0].text)(
    require,
    mod,
    mod.exports,
  );
  const id = "00000000-0000-4000-8000-000000000001";
  const f = new FormData();
  for (const [k, v] of Object.entries({
    bookingId: id,
    amountPhp: "1.00",
    method: "cash",
    paidAt: "2031-06-01T12:00",
    idempotencyKey: id,
  }))
    f.set(k, v);
  await mod.exports.bookings.recordOfflinePayment(f).catch(() => {});
  const actual = globalThis.diagnostic.rpc.args.p_paid_at;
  globalThis.diagnostic.requireAdminCalls = 0;
  const pin = new FormData();
  for (const [k, v] of Object.entries({
    currentPin: "1234",
    newPin: "5678",
    confirmPin: "5678",
  }))
    pin.set(k, v);
  await mod.exports.changePin(pin).catch(() => {});
  const reports = [
    {
      name: "Payment datetime-local interpreted in Manila independently of server timezone",
      expected: "2031-06-01T04:00:00.000Z",
      actual,
      status: actual === "2031-06-01T04:00:00.000Z" ? "PASS" : "FAIL",
      boundary:
        "Controlled requireAdmin/RPC stub. No database or authentication requests.",
    },
    {
      name: "PIN change invokes the active-administrator authorization boundary",
      expectedAuthorizationCalls: 1,
      actualAuthorizationCalls: globalThis.diagnostic.requireAdminCalls,
      passwordUpdatesInControlledStub: globalThis.diagnostic.passwordUpdates,
      status: globalThis.diagnostic.requireAdminCalls ? "PASS" : "FAIL",
      boundary:
        "Successful credential verification simulated; this is not a production exploit test.",
    },
  ];
  fs.writeFileSync(
    path.join(__dirname, "action-diagnostics.json"),
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
