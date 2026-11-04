import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
export default defineConfig({
  root,
  envDir: false,
  optimizeDeps: { entries: ["docs/settings-workspace/preview/index.html"] },
  server: { host: "127.0.0.1", port: 4178, strictPort: true },
  resolve: { alias: { "@": path.join(root, "src") } },
  plugins: [
    {
      name: "isolated-settings-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id === "next/link") return "\0fixture-link";
        if (/\/app\/actions\/gateway-fees(?:\.ts)?$/.test(id))
          return "\0fixture-gateway-action";
        if (/\/app\/actions\/feedback(?:\.ts)?$/.test(id))
          return "\0fixture-feedback";
        if (id.includes("/supabase/") || id === "@/lib/auth")
          throw new Error(
            "Database/auth imports are forbidden in this isolated preview.",
          );
      },
      load(id) {
        if (id === "\0fixture-link")
          return 'import React from "react";export default function Link({href,children,...props}){return React.createElement("a",{...props,href},children)}';
        if (id === "\0fixture-gateway-action")
          return 'export async function saveGatewayFee(){throw new Error("Preview only. No settings were saved.")}';
        if (id === "\0fixture-feedback")
          return 'export async function submitAdminAction(action,previous,data){try{await action(data);return {error:"",saved:false}}catch{return {error:"Local preview only. No settings were saved.",saved:false}}}';
      },
    },
  ],
});
