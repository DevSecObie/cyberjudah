import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders } from "./lib/security-headers.server";
import { frontDoorPath, launchPath } from "./lib/telegram-links.mjs";

type ServerEntry = { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response };
let serverEntryPromise: Promise<ServerEntry> | undefined;
async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => (m.default ?? m) as ServerEntry);
  return serverEntryPromise;
}

const CANONICAL_HOST = "cyberjudah.io";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    // One address: www and trailing slashes redirect to the canonical form.
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
      return Response.redirect(url.toString(), 301);
    }
    // A Telegram launch (t.me/<bot>/<app>?startapp=john_3_16) arrives with the start param in
    // the query; send it straight to the app screen it names. The target carries no fragment of
    // its own, so the browser keeps Telegram's #tgWebAppData across the redirect.
    const start = url.searchParams.get("tgWebAppStartParam");
    if (start && (url.pathname === "/" || url.pathname === "/app")) {
      const target = launchPath(start);
      if (target !== url.pathname) return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
    }
    // The front door: with APP_FRONT_DOOR on, a page the app shows opens in the app (/app on
    // the Telegram Worker); pages it has no screen for stay here. A 302, so turning it off
    // (or rolling back this Worker) leaves no redirect cached in browsers or search engines.
    if ((env as { APP_FRONT_DOOR?: string } | undefined)?.APP_FRONT_DOOR === "on" && (request.method === "GET" || request.method === "HEAD")) {
      const target = frontDoorPath(url.pathname + url.search);
      if (target) return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
    }
    try {
      const handler = await getServerEntry();
      return applySecurityHeaders(await handler.fetch(request, env, ctx));
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }));
    }
  },
};
