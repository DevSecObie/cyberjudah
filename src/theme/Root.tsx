import React, { type ReactNode, useEffect } from "react";
import { useLocation } from "@docusaurus/router";
import { createRoot, type Root as ReactRoot } from "react-dom/client";
import StickyVideo from "../components/StickyVideo";

export default function Root({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    const mounted: ReactRoot[] = [];
    const timer = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".class-video-mount[data-video-id]").forEach((node) => {
        const videoId = node.dataset.videoId;
        if (!videoId) return;
        const root = createRoot(node);
        root.render(<StickyVideo videoId={videoId} />);
        mounted.push(root);
      });
    }, 0);
    return () => { window.clearTimeout(timer); mounted.forEach((root) => root.unmount()); };
  }, [location.pathname]);
  return <>{children}</>;
}
