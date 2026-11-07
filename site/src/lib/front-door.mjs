/** The CyberJudah web app: the iPhone app's own web version. */
export const WEB_APP_ORIGIN = "https://web.cyberjudah.io";

const BOOK = /^[a-z0-9-]+$/;
const NUMBER = /^[1-9]\d{0,2}$/;

/**
 * The front door (server.ts, when APP_FRONT_DOOR is on): the address in the web app that shows
 * this site page, or null to keep the page here. Only pages whose app screen is known go: the
 * home page, and a Bible chapter or verse (the app opens the site's old /bible/<book>/<chapter>
 * links in the KJV). Everything else stays on the site until it has a matching app screen.
 */
export function frontDoorUrl(pathname) {
  const parts = String(pathname).split("/").filter(Boolean);
  if (parts.length === 0) return `${WEB_APP_ORIGIN}/home`;
  if (parts[0] === "bible" && (parts.length === 3 || parts.length === 4) && BOOK.test(parts[1]) && parts.slice(2).every((p) => NUMBER.test(p)))
    return `${WEB_APP_ORIGIN}/${parts.join("/")}`;
  return null;
}
