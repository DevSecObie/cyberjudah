import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Search params travel as plain strings. The router's default serialiser JSON-encodes any
 * value that happens to parse as JSON, so a quoted phrase search became
 * `?q=%22%5C%22seventh+day%5C%22%22`. Every route validates its own params, so plain
 * strings are enough; empty values are dropped so `/dictionary` stays `/dictionary`.
 */
function parseSearch(searchStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(searchStr)) out[k] = v;
  return out;
}

function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (k === "page" && v === 1) continue;
    params.set(k, typeof v === "string" ? v : String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    parseSearch,
    stringifySearch,
  });

  return router;
};
