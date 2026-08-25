import React, { type ReactNode } from "react";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import DocItemContent from "@theme/DocItem/Content";
import StockLayout from "@theme-original/DocItem/Layout";
import BibleAppShell from "../../../components/BibleAppShell";
import type { Props } from "@theme/DocItem/Layout";

export default function DocItemLayout({ children }: Props): ReactNode {
  const { metadata } = useDoc();
  const chapterMatch = metadata.id.match(/^bible\/([^/]+)\/(\d+)$/);
  const bookMatch = metadata.id.match(/^bible\/([^/]+)\/index$/);
  const isBible = metadata.id === "bible/index" || chapterMatch || bookMatch;

  if (isBible) {
    return (
      <BibleAppShell bookSlug={chapterMatch?.[1] ?? bookMatch?.[1]} chapter={chapterMatch ? Number(chapterMatch[2]) : undefined}>
        <DocItemContent>{children}</DocItemContent>
      </BibleAppShell>
    );
  }

  // Keep the stock documentation layout for every non-chapter page.
  return <StockLayout>{children}</StockLayout>;
}
