import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { TabBar } from "@/components/app/ui";
import "@/components/app/app.css";

/**
 * The Mini App: its own phone-app screens over the same data as the website. Telegram opens
 * https://cyberjudah.io/app (set in @BotFather). Client-rendered, since a Mini App always runs
 * script and the screens show their own loading states.
 */
export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "CyberJudah" }, { name: "robots", content: "noindex" }] }),
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Reading and note screens are pushed on top: no tab bar, Telegram's back button returns.
  const detail = /^\/app\/(read|note)\//.test(pathname);
  return (
    <div className="app" data-tabs={detail ? undefined : ""}>
      <Outlet />
      {detail ? null : <TabBar />}
    </div>
  );
}
