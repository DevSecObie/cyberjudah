import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { THEME_COLOR } from "@/lib/brand";
import { haptic, sharePage, telegram, type WebApp } from "@/lib/telegram";
import { startParamToPath } from "@/lib/telegram-links.mjs";

const OPEN_LAYER = '[role="dialog"][data-state="open"], #cj-nav-links[data-open]';

/**
 * Makes the site behave like a native Mini App when Telegram opens it, and renders nothing:
 * the app fills the screen in the site's own colours, Telegram's back button walks the
 * router's history (and closes a sheet or menu first), the ··· menu's Settings offers share
 * and home-screen actions, a start param opens the page it names, other sites open in
 * Telegram's browser, files download through Telegram, and moving between pages ticks the
 * haptics.
 */
export function TelegramBridge() {
  const router = useRouter();
  useEffect(() => {
    let cleanup = () => {};
    let alive = true;
    void telegram().then((app) => {
      if (!app || !alive) return;
      cleanup = connect(app, router);
    });
    return () => { alive = false; cleanup(); };
  }, [router]);
  return null;
}

function connect(app: WebApp, router: ReturnType<typeof useRouter>): () => void {
  const root = document.documentElement;
  root.dataset.tgPlatform = app.platform;
  app.ready();
  app.expand();
  if (app.isVersionAtLeast("6.1")) {
    app.setHeaderColor(THEME_COLOR);
    app.setBackgroundColor(THEME_COLOR);
  }
  if (app.isVersionAtLeast("7.10")) app.setBottomBarColor(THEME_COLOR);
  // Reading scrolls a long way; a downward swipe should scroll, not close the app.
  if (app.isVersionAtLeast("7.7")) app.disableVerticalSwipes();

  // The Worker redirects a launch with ?tgWebAppStartParam to its page (without the verse
  // anchor, which would overwrite Telegram's launch fragment); this lands on the verse, and
  // covers clients that pass the start param only in the launch data. Once per session.
  const start = app.initDataUnsafe.start_param;
  try {
    if (start && !sessionStorage.getItem("cj-tg-start")) {
      sessionStorage.setItem("cj-tg-start", "1");
      const href = startParamToPath(start);
      const loc = router.state.location;
      const here = loc.pathname + (loc.searchStr ?? "");
      if (href !== "/" && (loc.pathname === "/" || (href.startsWith(`${here}#`) && !/^v\d/.test(loc.hash)))) void router.navigate({ href, replace: true });
    }
  } catch { /* storage unavailable */ }

  // Back button: close whatever is open on top, else go back in the app's own history.
  const layerOpen = () => document.querySelector(OPEN_LAYER) !== null;
  const syncBack = () => {
    if (!app.isVersionAtLeast("6.1")) return;
    if (layerOpen() || router.history.canGoBack()) app.BackButton.show();
    else app.BackButton.hide();
  };
  const onBack = () => {
    haptic("select");
    const layer = document.querySelector<HTMLElement>(OPEN_LAYER);
    if (layer?.id === "cj-nav-links") document.querySelector<HTMLButtonElement>(".cj-nav__toggle")?.click();
    else if (layer) layer.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    else router.history.back();
  };
  if (app.isVersionAtLeast("6.1")) app.BackButton.onClick(onBack);
  const layers = new MutationObserver(syncBack);
  layers.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-state", "data-open"], childList: true });

  let path = router.state.location.pathname;
  const unsubscribe = router.subscribe("onResolved", () => {
    syncBack();
    const next = router.state.location.pathname;
    if (next !== path) haptic("select");
    path = next;
  });
  syncBack();

  // Settings in the ··· menu: share this page, pin the app, or leave for the browser.
  const onSettings = () => {
    const canPin = app.isVersionAtLeast("8.0");
    const ask = (pin: boolean) => app.showPopup({
      title: "CyberJudah",
      message: "Share this page into a chat, or keep the library one tap away.",
      buttons: [
        { id: "share", type: "default", text: "Share this page" },
        pin ? { id: "pin", type: "default", text: "Add to Home Screen" } : { id: "web", type: "default", text: "Open in browser" },
        { type: "close" },
      ],
    }, (id) => {
      if (id === "share") sharePage(new URLSearchParams(window.location.search).get("v") ?? undefined);
      if (id === "pin") app.addToHomeScreen();
      if (id === "web") app.openLink(window.location.href);
    });
    if (canPin) app.checkHomeScreenStatus((s) => ask(s === "missed" || s === "unknown"));
    else ask(false);
  };
  if (app.isVersionAtLeast("7.0")) {
    app.SettingsButton.onClick(onSettings);
    app.SettingsButton.show();
  }

  // Links: other sites open in Telegram's in-app browser, t.me links inside Telegram, and
  // downloads through Telegram's file sheet, instead of navigating the app away.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    let url: URL;
    try { url = new URL(a.href, window.location.href); } catch { return; }
    if (url.protocol !== "https:" && url.protocol !== "http:") return;
    const file = /\.(zip|gz|sqlite|pdf|epub|mp3|json)$/i.exec(url.pathname);
    if (url.origin === window.location.origin && !file) return;
    e.preventDefault();
    if (url.hostname === "t.me") app.openTelegramLink(url.href);
    else if (file && app.isVersionAtLeast("8.0") && !/\.json$/i.test(url.pathname)) app.downloadFile({ url: url.href, file_name: url.pathname.split("/").pop() || "download" });
    else app.openLink(url.href);
  };
  document.addEventListener("click", onClick);

  return () => {
    unsubscribe();
    layers.disconnect();
    document.removeEventListener("click", onClick);
    if (app.isVersionAtLeast("6.1")) { app.BackButton.offClick(onBack); app.BackButton.hide(); }
    if (app.isVersionAtLeast("7.0")) { app.SettingsButton.offClick(onSettings); app.SettingsButton.hide(); }
  };
}
