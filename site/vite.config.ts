import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultServerConditions, defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// TanStack Start, built for a Cloudflare Worker: the SSR bundle is emitted at
// dist/server/server.js (export default { fetch }) with every dependency bundled in
// (a Worker has no node_modules), and dist/client holds the hashed static assets.
export default defineConfig(({ command }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  ssr: {
    ...(command === "build"
      ? { target: "webworker" as const, resolve: { conditions: ["workerd", "worker", "browser", ...defaultServerConditions.filter((c) => c !== "node")] } }
      : {}),
    noExternal: command === "build" ? true : undefined,
    external: ["cloudflare:workers"],
  },
  build: { rollupOptions: { external: [/^cloudflare:/] } },
  plugins: [tanstackStart({ server: { entry: "server" } }), react(), tailwindcss()],
}));
