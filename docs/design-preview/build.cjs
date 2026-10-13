/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser review tooling. */
const fs = require("fs"),
  path = require("path"),
  esbuild = require(
    path.join(
      process.env.KJM_PREVIEW_TOOLS || "/tmp/kjm-phase8-preview",
      "node_modules/esbuild",
    ),
  );
const root = path.resolve(__dirname, "../.."),
  tmp = __dirname;
const output =
  process.env.KJM_PREVIEW_OUTPUT || "/tmp/kjm-phase8-preview-runtime";
fs.mkdirSync(output, { recursive: true });
const pages = [
  "",
  "bookings",
  "calendar",
  "verifications",
  "fleet",
  "extras",
  "customers",
  "finance",
  "reports",
  "settings",
  "bookings/[id]",
  "fleet/[id]",
  "fleet/new",
];
const mocks = {
  "next/link": `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
  "next/image": `import React from 'react';export default function Image({fill,unoptimized,priority,sizes,...props}){return <img {...props}/>}`,
  "next/navigation": `export const usePathname=()=>globalThis.previewPath||'/dashboard';export const redirect=()=>{throw Error('Redirect blocked in preview')};export const notFound=()=>{throw Error('Missing preview fixture')};`,
  "@/lib/auth": `import fixtures from '${tmp}/fixtures.cjs';export const getAdminSession=async()=>null;export async function requireAdmin(){return {user:{email:'preview@example.invalid'},supabase:{from(table){let rows=[...(fixtures[table]||[])],single=false;const q={select(){return q},order(){return q},limit(n){rows=rows.slice(0,n);return q},range(a,b){rows=rows.slice(a,b+1);return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},is(k,v){rows=rows.filter(r=>(r[k]??null)===v);return q},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return q},lt(){return q},gt(){return q},maybeSingle(){single=true;return q},single(){single=true;return q},then(resolve){return Promise.resolve({data:single?(rows[0]||null):rows,error:null}).then(resolve)}};return q},storage:{from(){return {getPublicUrl(){return {data:{publicUrl:''}}}}}}}}}`,
};
const plugin = {
  name: "isolated-preview",
  setup(build) {
    build.onResolve({ filter: /^(next\/|@\/)/ }, (args) => {
      if (mocks[args.path]) return { path: args.path, namespace: "mock" };
      if (args.path.startsWith("@/app/actions/"))
        return { path: args.path, namespace: "action" };
      if (args.path.startsWith("@/"))
        return {
          path:
            path.join(root, "src", args.path.slice(2)) +
            (/\.[jt]sx?$/.test(args.path)
              ? ""
              : fs.existsSync(
                    path.join(root, "src", args.path.slice(2)) + ".tsx",
                  )
                ? ".tsx"
                : ".ts"),
        };
    });
    build.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
      contents: mocks[args.path],
      loader: "jsx",
      resolveDir: root,
    }));
    build.onLoad({ filter: /.*/, namespace: "action" }, (args) => {
      const file = path.join(root, "src", args.path.slice(2) + ".ts"),
        s = fs.readFileSync(file, "utf8");
      const names = [
        ...s.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g),
      ].map((m) => m[1]);
      return {
        contents: names
          .map(
            (n) =>
              `export async function ${n}(){throw Error('All preview submissions disabled')}`,
          )
          .join("\n"),
        loader: "js",
      };
    });
  },
};
const nodeEntry = `import Loading from '${root}/src/app/dashboard/loading.tsx';import ErrorState from '${root}/src/app/dashboard/error.tsx';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {AdminShell} from '${root}/src/components/admin-shell.tsx';${pages.map((p, i) => `import Page${i} from '${root}/src/app/dashboard/${p ? p + "/" : ""}page.tsx';`).join("")}const pages={'/dashboard/preview-states':()=>React.createElement('div',null,React.createElement(Loading),React.createElement(ErrorState,{reset:()=>{}})),${pages.map((p, i) => `${JSON.stringify("/dashboard" + (p ? "/" + p : ""))}:Page${i}`).join(",")}};export async function render(url){const u=new URL(url,'http://localhost'),route=u.pathname,template=route.includes('/bookings/booking-')?'/dashboard/bookings/[id]':route.includes('/fleet/model-')?'/dashboard/fleet/[id]':route;globalThis.previewPath=route;const Page=pages[template];if(!Page)throw Error('No fixture route');const tree=await Page({searchParams:Promise.resolve(Object.fromEntries(u.searchParams)),params:Promise.resolve({id:route.split('/').pop()})});const inner=renderToStaticMarkup(tree);const child=React.createElement('div',{dangerouslySetInnerHTML:{__html:inner}});return {inner,html:renderToStaticMarkup(React.createElement(AdminShell,{email:'preview@example.invalid'},child))}}`;
const browserEntry = `import {ConfirmButton} from '${root}/src/components/confirm-button.tsx';import ErrorState from '${root}/src/app/dashboard/error.tsx';import React from 'react';import {hydrateRoot,createRoot} from 'react-dom/client';import {AdminShell} from '${root}/src/components/admin-shell.tsx';import {InventoryQuantityForm} from '${root}/src/components/inventory-quantity-form.tsx';globalThis.previewPath=location.pathname;createRoot(document.getElementById('root')).render(React.createElement(AdminShell,{email:'preview@example.invalid'},React.createElement('div',{dangerouslySetInnerHTML:{__html:window.previewInner}})));document.addEventListener('submit',e=>{if(e.target.method.toLowerCase()!=='get')e.preventDefault()},true);setTimeout(()=>{const f=document.querySelector('input[name="modelId"]')?.closest('form');if(f){const mount=document.createElement('div');f.replaceWith(mount);createRoot(mount).render(React.createElement(InventoryQuantityForm,{modelId:'model-demo',total:4}));}if(location.pathname.endsWith('/preview-states')){const el=document.createElement('section');document.querySelector('.admin-workspace').append(el);createRoot(el).render(React.createElement('div',null,React.createElement(ErrorState,{reset:()=>{window.previewRetried=true}}),React.createElement('form',{onSubmit:e=>{e.preventDefault();window.previewSubmitCount=(window.previewSubmitCount||0)+1}},React.createElement(ConfirmButton,{message:'Preview confirmation only. No data is changed.',className:'admin-button'},'Preview irreversible action'))));}},100);`;
(async () => {
  const common = {
    bundle: true,
    plugins: [plugin],
    nodePaths: [root + "/node_modules"],
    jsx: "automatic",
    logLevel: "warning",
  };
  await esbuild.build({
    ...common,
    stdin: { contents: nodeEntry, resolveDir: root, loader: "jsx" },
    outfile: output + "/server.cjs",
    platform: "node",
    format: "cjs",
  });
  await esbuild.build({
    ...common,
    stdin: { contents: browserEntry, resolveDir: root, loader: "jsx" },
    outfile: output + "/client.js",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
})();
