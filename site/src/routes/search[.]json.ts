import { createFileRoute } from "@tanstack/react-router";
import { runSearch } from "../lib/search";

/**
 * The library search as plain JSON, for the CyberJudah phone app: GET /search.json?q=…&only=…&limit=…
 * It searches only what the site already publishes, so it is open to any origin and needs no login.
 */
export const Route = createFileRoute("/search.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").slice(0, 200);
        const only = url.searchParams.get("only") || undefined;
        const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit"))) || 8, 1), 50);
        const result = await runSearch(q, only, limit);
        // The loose pass can add hits of a kind the strict pass already filled; keep at most `limit` of each.
        const perKind: Record<string, number> = {};
        if (result.ok) result.hits = result.hits.filter((h) => (perKind[h.kind] = (perKind[h.kind] ?? 0) + 1) <= limit);
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 503,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": result.ok ? "public, max-age=300" : "no-store",
          },
        });
      },
    },
  },
});
