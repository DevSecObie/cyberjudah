/**
 * Telegram Mini App support. Inside Telegram the root shell loads telegram.org's
 * telegram-web-app.js (see TELEGRAM_BOOT) and marks <html class="tg">; everywhere else none of
 * this runs and the site is unchanged. The types cover only what the site uses.
 * https://core.telegram.org/bots/webapps
 */
import { useEffect, useRef } from "react";

import { SITE_NAME, SITE_URL, TELEGRAM_BUTTON, TELEGRAM_BUTTON_QUIET } from "@/lib/brand";
import { appLink, sitePathOf } from "@/lib/telegram-links.mjs";

/**
 * The Mini App's direct link from @BotFather (/newapp), e.g. https://t.me/CyberJudahBot/read.
 * Shared pages open inside Telegram through it; without it they share the plain site URL.
 */
export const TELEGRAM_APP_URL: string = (import.meta.env.VITE_TELEGRAM_APP_URL as string | undefined) || "";

type Cb = () => void;
type BottomButton = {
  setParams(p: { text?: string; color?: string; text_color?: string; has_shine_effect?: boolean; position?: "left" | "right" | "top" | "bottom"; is_active?: boolean; is_visible?: boolean }): BottomButton;
  onClick(cb: Cb): BottomButton;
  offClick(cb: Cb): BottomButton;
  show(): BottomButton;
  hide(): BottomButton;
};
type PopupButton = { id?: string; type?: "default" | "ok" | "close" | "cancel" | "destructive"; text?: string };

export type WebApp = {
  initData: string;
  initDataUnsafe: { start_param?: string; user?: { id: number; first_name?: string } };
  version: string;
  platform: string;
  isVersionAtLeast(v: string): boolean;
  ready(): void;
  expand(): void;
  setHeaderColor(c: string): void;
  setBackgroundColor(c: string): void;
  setBottomBarColor(c: string): void;
  disableVerticalSwipes(): void;
  openLink(url: string, opts?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  showPopup(p: { title?: string; message: string; buttons?: PopupButton[] }, cb?: (id: string) => void): void;
  addToHomeScreen(): void;
  checkHomeScreenStatus(cb: (status: "unsupported" | "unknown" | "added" | "missed") => void): void;
  downloadFile(p: { url: string; file_name: string }, cb?: (accepted: boolean) => void): void;
  onEvent(e: string, cb: Cb): void;
  offEvent(e: string, cb: Cb): void;
  BackButton: { onClick(cb: Cb): void; offClick(cb: Cb): void; show(): void; hide(): void };
  SettingsButton: { onClick(cb: Cb): void; offClick(cb: Cb): void; show(): void; hide(): void };
  MainButton: BottomButton;
  SecondaryButton?: BottomButton;
  HapticFeedback: { impactOccurred(s: "light" | "medium" | "heavy" | "rigid" | "soft"): void; notificationOccurred(t: "error" | "success" | "warning"): void; selectionChanged(): void };
  CloudStorage: { getItem(k: string, cb: (err: string | null, v?: string) => void): void; setItem(k: string, v: string, cb?: (err: string | null, ok?: boolean) => void): void };
};

declare global {
  interface Window { Telegram?: { WebApp?: WebApp } }
}

export const TELEGRAM_SDK = "https://telegram.org/js/telegram-web-app.js";

/**
 * Runs in <head> before hydration. Telegram opens the app with tgWebApp* in the hash (and the
 * start param in the query), the SDK keeps them in sessionStorage across reloads, and the
 * mobile clients inject TelegramWebviewProxy. Only then is the SDK fetched, in order, so it
 * reads the launch hash before the router touches the URL.
 */
export const TELEGRAM_BOOT = `(function(){try{var l=location;if(/tgWebApp/.test(l.hash+l.search)||sessionStorage.getItem("__telegram__initParams")||window.TelegramWebviewProxy){var d=document.documentElement;d.classList.add("tg");var s=document.createElement("script");s.id="tg-sdk";s.src=${JSON.stringify(TELEGRAM_SDK)};s.async=false;document.head.appendChild(s)}}catch(e){}})()`;

let ready: Promise<WebApp | null> | undefined;

/** The WebApp object once the SDK has loaded inside Telegram, or null on the open web. */
export function telegram(): Promise<WebApp | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return (ready ??= new Promise((resolve) => {
    const done = () => {
      const app = window.Telegram?.WebApp;
      resolve(app && app.platform !== "unknown" ? app : null);
    };
    if (!document.documentElement.classList.contains("tg")) return resolve(null);
    if (window.Telegram?.WebApp) return done();
    const el = document.getElementById("tg-sdk");
    if (!el) return resolve(null);
    el.addEventListener("load", done, { once: true });
    el.addEventListener("error", () => resolve(null), { once: true });
  }));
}

/** The loaded WebApp, synchronously, for event handlers. */
export function tg(): WebApp | null {
  const app = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  return app && app.platform !== "unknown" ? app : null;
}

export function haptic(kind: "select" | "tap" | "success" = "tap") {
  const app = tg();
  if (!app?.isVersionAtLeast("6.1")) return;
  if (kind === "select") app.HapticFeedback.selectionChanged();
  else if (kind === "success") app.HapticFeedback.notificationOccurred("success");
  else app.HapticFeedback.impactOccurred("light");
}

/** Open Telegram's chat picker with a link that opens this page (and these verses) in the app. */
export function sharePage(verses?: string, text?: string) {
  const app = tg();
  if (!app) return;
  const link = appLink(TELEGRAM_APP_URL, SITE_URL, sitePathOf(window.location.pathname), verses);
  const title = text ?? document.title.replace(/\s*·\s*CyberJudah$/, "");
  const caption = title && title !== SITE_NAME ? `${title} · ${SITE_NAME}` : SITE_NAME;
  app.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(caption)}`);
}

/**
 * A preference that follows the reader: localStorage everywhere, and Telegram's CloudStorage
 * inside the Mini App so it is the same on their phone and their desktop.
 */
export const prefs = {
  get(key: string, cb: (v: string | null) => void) {
    let local: string | null = null;
    try { local = window.localStorage.getItem(`cj-${key}`); } catch { /* storage unavailable */ }
    cb(local);
    void telegram().then((app) => {
      if (!app?.isVersionAtLeast("6.9")) return;
      app.CloudStorage.getItem(key, (err, v) => { if (!err && v && v !== local) cb(v); });
    });
  },
  set(key: string, value: string) {
    try { window.localStorage.setItem(`cj-${key}`, value); } catch { /* ignore */ }
    const app = tg();
    if (app?.isVersionAtLeast("6.9")) app.CloudStorage.setItem(key, value);
  },
};

export type BottomAction = { text: string; onClick: () => void; quiet?: boolean };

/**
 * Put a page's main action on Telegram's native bottom bar: `main` is the full-width button,
 * `secondary` sits beside it. Pass null to leave a slot empty. Does nothing off Telegram.
 */
export function useTelegramButtons(main: BottomAction | null, secondary: BottomAction | null = null) {
  const handlers = useRef({ main, secondary });
  handlers.current = { main, secondary };
  const mainText = main?.text ?? "";
  const secondText = secondary?.text ?? "";
  const mainQuiet = Boolean(main?.quiet);
  useEffect(() => {
    let off = () => {};
    let alive = true;
    void telegram().then((app) => {
      if (!app || !alive) return;
      const clickMain = () => { haptic(); handlers.current.main?.onClick(); };
      const clickSecond = () => { haptic(); handlers.current.secondary?.onClick(); };
      const second = app.isVersionAtLeast("7.10") ? app.SecondaryButton : undefined;
      if (mainText) app.MainButton.setParams({ text: mainText, ...(mainQuiet ? TELEGRAM_BUTTON_QUIET : TELEGRAM_BUTTON), is_active: true, is_visible: true }).onClick(clickMain);
      else app.MainButton.hide();
      if (second && secondText) second.setParams({ text: secondText, ...TELEGRAM_BUTTON_QUIET, position: "left", is_active: true, is_visible: true }).onClick(clickSecond);
      else second?.hide();
      off = () => {
        app.MainButton.offClick(clickMain).hide();
        second?.offClick(clickSecond).hide();
      };
    });
    return () => { alive = false; off(); };
  }, [mainText, secondText, mainQuiet]);
}
