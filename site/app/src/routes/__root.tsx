import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportHiggsfieldError } from "../lib/higgsfield-error-reporting";
import appMetaJson from "../app-meta.json";
import { THEME_COLOR } from "../lib/brand";

declare const __HF_DESIGN_INSPECTOR__: boolean;

const DEFAULT_TITLE = "CyberJudah";
const DEFAULT_DESCRIPTION = "KJV study Bible with the Apocrypha: every verse, the classes, the law, the precepts and the cases, on the same page.";

type AppMeta = {
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  favicon_url?: string | null;
  og_video_url?: string | null;
  marketplace_cover_url?: string | null;
};
const appMeta = appMetaJson as AppMeta;

const APP_HOST_ZONES = ["higgsfield.app", "higgsfield-dev.app"];
function toOwnAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const u = new URL(value);
    const isAppHost = APP_HOST_ZONES.some((zone) => u.hostname === zone || u.hostname.endsWith(`.${zone}`));
    return isAppHost ? u.pathname + u.search : value;
  } catch {
    return value;
  }
}

function buildHead(meta: AppMeta) {
  const title = meta.og_title ?? DEFAULT_TITLE;
  const description = meta.og_description ?? DEFAULT_DESCRIPTION;
  const ogImage = toOwnAssetUrl(meta.og_image_url);
  const ogVideo = toOwnAssetUrl(meta.og_video_url);
  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { name: "theme-color", content: THEME_COLOR },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "CyberJudah" },
      { name: "twitter:card", content: ogImage ? "summary_large_image" : "summary" },
      ...(ogImage ? [{ property: "og:image", content: ogImage }, { name: "twitter:image", content: ogImage }] : []),
      ...(ogVideo ? [{ property: "og:video", content: ogVideo }] : []),
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  };
}

function NotFoundComponent() {
  return (
    <div className="cj-shell">
      <main className="cj-wrap cj-page">
        <p className="cj-kicker">404</p>
        <h1 className="cj-h1">This page is not in the library.</h1>
        <p className="cj-lede">The link may be old, or the chapter may be written differently here.</p>
        <Link to="/" className="read-link"><span>Back to the front door</span><span aria-hidden="true">{"\u2192"}</span></Link>
      </main>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportHiggsfieldError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="cj-shell">
      <main className="cj-wrap cj-page">
        <h1 className="cj-h1">This page did not load.</h1>
        <p className="cj-lede">The library could not be reached for a moment. Try again, or head back to the front door.</p>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <button type="button" className="lamp-btn" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
          <a href="/" className="read-link"><span>Front door</span><span aria-hidden="true">→</span></a>
        </div>
      </main>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => buildHead(appMeta),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="default-dark" style={{ colorScheme: "dark" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    if (!__HF_DESIGN_INSPECTOR__) return;
    void import("../module/design-inspector/runtime")
      .then(({ installHiggsfieldDesignInspector }) => { installHiggsfieldDesignInspector(); })
      .catch((error) => {
        reportHiggsfieldError(error instanceof Error ? error : new Error("Failed to load design inspector"), { boundary: "higgsfield_design_inspector_import" });
      });
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
