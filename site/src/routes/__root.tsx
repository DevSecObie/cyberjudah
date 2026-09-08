import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, THEME_COLOR } from "../lib/brand";

function buildHead() {
  const title = SITE_NAME;
  const description = SITE_DESCRIPTION;
  const ogImage = `${SITE_URL}/og.jpg`;
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
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:image", content: ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: ogImage },
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

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
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
  head: () => buildHead(),
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
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
