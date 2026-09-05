import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const REPO = "https://github.com/DevSecObie/cyberjudah/edit/main";
// Only the notes are committed; the scripture, law, precept and case pages are generated on
// every build and have no file to edit. Returning undefined for those omits the link rather
// than pointing at a path that does not exist in the repo.
const EDITABLE = /^(study\/[a-z0-9-]+\/\d|encyclopedia\/(?!index))/;
const editDoc = ({ docPath }: { docPath: string }) =>
  EDITABLE.test(docPath) ? `${REPO}/docs/${docPath}` : undefined;

const config: Config = {
  title: "CyberJudah",
  tagline: "KJV Study Bible with Apocrypha, study notes, class notes, encyclopedia, the law, precepts, and case studies",
  favicon: "img/cyber-bible-icon-64.png",
  stylesheets: [
    { href: "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500&family=JetBrains+Mono:wght@400;500;700&display=swap", type: "text/css" },
  ],
  url: "https://devsecobie.github.io",
  baseUrl: "/cyberjudah/",
  organizationName: "DevSecObie",
  projectName: "cyberjudah",
  deploymentBranch: "gh-pages",
  trailingSlash: false,
  onBrokenLinks: "throw",
  onBrokenAnchors: "ignore",   // verse ids are raw HTML; Docusaurus only tracks anchors it generates
  markdown: { format: "detect", hooks: { onBrokenMarkdownLinks: "warn" } },
  future: { v4: true, faster: { swcJsLoader: true, swcJsMinimizer: true, swcHtmlMinimizer: true, lightningCssMinimizer: true, rspackBundler: true, rspackPersistentCache: false, mdxCrossCompilerCache: true, ssgWorkerThreads: false } },
  i18n: { defaultLocale: "en", locales: ["en"] },
  plugins: [
    ["@docusaurus/plugin-client-redirects", {
      // Greek Esther exists only as the Additions (chapters 10-16); references to
      // 1-9 belong to canonical Esther.
      redirects: [
        // The stock blog archive route is disabled (see archiveBasePath) in favour of /classes/browse.
        { from: "/classes/archive", to: "/classes/browse" },
        { from: "/captains/archive", to: "/captains/browse" },
        { from: "/bible/esther-greek/6", to: "/bible/esther/6" },
        { from: "/bible/esther-greek/7", to: "/bible/esther/7" },
        { from: "/bible/esther-greek/9", to: "/bible/esther/9" },
      ],
    }],
    ["@docusaurus/plugin-pwa", {
      debug: false,
      offlineModeActivationStrategies: ["appInstalled", "standalone", "queryString"],
      pwaHead: [
        { tagName: "link", rel: "icon", href: "/cyberjudah/img/cyber-bible-icon-64.png" },
        { tagName: "link", rel: "manifest", href: "/cyberjudah/manifest.json" },
        { tagName: "meta", name: "theme-color", content: "#05070f" },
      ],
    }],
    // 15 Minutes w/ The Captains: short weekday teachings from the IUIC Captains channel.
    // A second blog instance rather than a tag on the Sabbath notes, so each keeps its own
    // feed, its own pagination and its own browse page.
    ["@docusaurus/plugin-content-blog", {
      id: "captains",
      path: "captains",
      routeBasePath: "captains",
      archiveBasePath: null,
      editUrl: REPO,
      blogTitle: "15 Minutes w/ The Captains",
      blogDescription: "Episode notes from 15 Minutes w/ The Captains",
      blogSidebarTitle: "Recent episodes",
      blogSidebarCount: "ALL",
      postsPerPage: 10,
      showReadingTime: true,
      onUntruncatedBlogPosts: "ignore",
      onInlineAuthors: "ignore",
      feedOptions: { type: "all", title: "CyberJudah · 15 Minutes w/ The Captains", description: "Episode notes from 15 Minutes w/ The Captains", copyright: "Public-domain KJV text with Apocrypha." },
    }],
    "docusaurus-plugin-image-zoom",
  ],
  presets: [
    ["classic", {
      docs: {
        path: "docs",
        routeBasePath: "/",
        editUrl: editDoc,
        sidebarPath: "./sidebars.ts",
        showLastUpdateTime: false,
        numberPrefixParser: false,
        breadcrumbs: true,
      },
      blog: {
        path: "blog",
        routeBasePath: "classes",
        // /classes/browse replaces the stock archive page, whose single JS chunk had grown past 5 MB.
        archiveBasePath: null,
        editUrl: REPO,
        blogTitle: "Sabbath Class Notes",
        blogDescription: "Class notes from IUIC in the ClassRoom",
        blogSidebarTitle: "Recent classes",
        blogSidebarCount: "ALL",
        postsPerPage: 10,
        showReadingTime: true,
        onUntruncatedBlogPosts: "ignore",
        onInlineAuthors: "ignore",
        feedOptions: { type: "all", title: "CyberJudah · Sabbath Class Notes", description: "Class notes from IUIC in the ClassRoom", copyright: "Public-domain KJV text with Apocrypha." },
      },
      theme: { customCss: "./src/css/custom.css" },
    } satisfies Preset.Options],
  ],
  themeConfig: {
    // Social card for link previews; twitter:card=summary_large_image was already emitted, but with no image.
    image: "img/cyberjudah-social-card.png",
    colorMode: { defaultMode: "dark", respectPrefersColorScheme: true },
    zoom: { selector: ".markdown img, .class-hero img" },
    docs: { sidebar: { hideable: true, autoCollapseCategories: true } },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    navbar: {
      title: "CyberJudah",
      logo: { alt: "CyberJudah Holy Bible", src: "img/cyber-bible-icon-256.png" },
      hideOnScroll: true,
      items: [
        { type: "docSidebar", sidebarId: "bible", label: "Bible", position: "left" },
        { type: "docSidebar", sidebarId: "study", label: "Study", position: "left" },
        { to: "/classes/browse", label: "Classes", position: "left" },
        { to: "/captains/browse", label: "Captains", position: "left" },
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
        { title: "Read", items: [{ label: "Bible", to: "/bible" }, { label: "4 Chapters a Day", to: "/study" }, { label: "Sabbath Class Notes", to: "/classes/browse" }, { label: "Classes by Book", to: "/classes/by-book" }, { label: "15 Minutes w/ The Captains", to: "/captains/browse" }, { label: "Encyclopedia", to: "/encyclopedia" }] },
        { title: "The Law", items: [{ label: "Handbook", to: "/law" }, { label: "Precepts", to: "/precepts" }, { label: "Case Studies", to: "/cases" }, { label: "Concordance", to: "/concordance" }] },
        { title: "Tools", items: [{ label: "Search", to: "/search" }, { label: "API", to: "/api" }, { label: "Downloads", to: "/downloads" }] },
      ],
      copyright: "The Bible text is the public-domain King James Version (1769) with Apocrypha.",
    },
  } satisfies Preset.ThemeConfig,
};
export default config;
