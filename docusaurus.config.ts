import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "CyberJudah",
  tagline: "KJV Study Bible with Apocrypha, study notes, class notes, encyclopedia, the law, precepts, and case studies",
  favicon: "img/favicon.ico",
  url: "https://devsecobie.github.io",
  baseUrl: "/cyberjudah/",
  organizationName: "DevSecObie",
  projectName: "cyberjudah",
  deploymentBranch: "gh-pages",
  trailingSlash: false,
  onBrokenLinks: "warn",
  onBrokenAnchors: "warn",
  markdown: { format: "detect", hooks: { onBrokenMarkdownLinks: "warn" } },
  future: { v4: true, faster: { swcJsLoader: true, swcJsMinimizer: true, swcHtmlMinimizer: true, lightningCssMinimizer: true, rspackBundler: true, rspackPersistentCache: false, mdxCrossCompilerCache: true, ssgWorkerThreads: false } },
  i18n: { defaultLocale: "en", locales: ["en"] },
  presets: [
    ["classic", {
      docs: {
        path: "docs",
        routeBasePath: "/",
        sidebarPath: "./sidebars.ts",
        showLastUpdateTime: false,
        numberPrefixParser: false,
        breadcrumbs: true,
      },
      blog: false,
      theme: { customCss: "./src/css/custom.css" },
    } satisfies Preset.Options],
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    docs: { sidebar: { hideable: true, autoCollapseCategories: true } },
    navbar: {
      title: "CyberJudah",
      items: [
        { type: "docSidebar", sidebarId: "bible", label: "Bible", position: "left" },
        { type: "docSidebar", sidebarId: "study", label: "Study", position: "left" },
        { type: "docSidebar", sidebarId: "classes", label: "Classes", position: "left" },
        { type: "docSidebar", sidebarId: "encyclopedia", label: "Encyclopedia", position: "left" },
        { type: "docSidebar", sidebarId: "law", label: "Law", position: "left" },
        { type: "docSidebar", sidebarId: "precepts", label: "Precepts", position: "left" },
        { type: "docSidebar", sidebarId: "cases", label: "Cases", position: "left" },
        { type: "docSidebar", sidebarId: "concordance", label: "Concordance", position: "left" },
        { to: "/search", label: "Search", position: "right" },
        { to: "/api", label: "API", position: "right" },
        { href: "https://github.com/DevSecObie/cyberjudah", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        { title: "Read", items: [{ label: "Bible", to: "/bible" }, { label: "Study Notes", to: "/study" }, { label: "Class Notes", to: "/classes" }, { label: "Encyclopedia", to: "/encyclopedia" }] },
        { title: "The Law", items: [{ label: "Handbook", to: "/law" }, { label: "Precepts", to: "/precepts" }, { label: "Case Studies", to: "/cases" }, { label: "Concordance", to: "/concordance" }] },
        { title: "Tools", items: [{ label: "Search", to: "/search" }, { label: "API", to: "/api" }, { label: "Downloads", to: "/downloads" }] },
      ],
      copyright: "The Bible text is the public-domain King James Version (1769) with Apocrypha.",
    },
    prism: { theme: undefined as never, darkTheme: undefined as never },
  } satisfies Preset.ThemeConfig,
};
export default config;
