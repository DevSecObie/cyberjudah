import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders } from "./lib/security-headers.server";

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
    try {
      const handler = await getServerEntry();
      return applySecurityHeaders(await handler.fetch(request, env, ctx));
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }));
    }
  },
};
