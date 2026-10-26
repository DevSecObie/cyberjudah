import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { launchPath, pathToStartParam } from "../src/lib/telegram-links.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/doctrine.json", import.meta.url), "utf8"));
const require = createRequire(import.meta.url);
const link = ({ to, children, ...rest }) => createElement("a", { ...rest, href: to }, children);
const passthrough = ({ children }) => children;
function load(path, imports = {}, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8").replaceAll("import.meta", "__meta");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, __meta: { env: {} }, Error, URL, ...globals,
    require: name => name === "react/jsx-runtime" ? require(name) : imports[name] ?? {},
  });
  return exports;
}
const refs = load("../src/components/site/ref-quote.tsx", { "@tanstack/react-router": { Link: link } });
const doctrine = load("../src/routes/doctrine/-shared.tsx", {
  "@tanstack/react-router": { Link: link, useRouter: () => ({ invalidate() {} }) },
  "@/components/site/ref-quote": refs,
  "@/components/site/ref-card": { RefCards: passthrough },
  "@/lib/teaching-refs": load("../src/lib/teaching-refs.ts"),
});

test("False Doctrines labels appear in route headings, breadcrumbs, metadata and empty states", () => {
  for (const index of [true, false]) {
    const result = { data: index ? [{ ...fixture, refs: 2, scriptures: fixture.scriptures.length }] : fixture, error: null };
    const { Route } = load(index ? "../src/routes/doctrine/index.tsx" : "../src/routes/doctrine/$slug.tsx", {
      react: require("react"),
      "@tanstack/react-router": { Link: link, createFileRoute: () => config => ({ ...config, useLoaderData: () => result }) },
      "@/components/site/chrome": { Page: passthrough, Kicker: passthrough, ReadLink: link },
      "@/components/site/browse-tools": { Breadcrumbs: ({ items }) => createElement("nav", null, items.map(item => item.label).join(" / ")) },
      "@/components/site/return-bar": { CiteLanding: passthrough },
      "@/lib/head": { pageHead: tags => tags },
      "./-shared": doctrine,
    });
    const html = renderToStaticMarkup(createElement(Route.component));
    assert.ok(html.includes(index ? "False Doctrines.</h1>" : "False Doctrines / Alpha fixture"));
    if (!index) assert.ok(html.includes('href="/doctrine">All false doctrines</a>'));
    assert.equal(Route.head({ loaderData: result }).at(0).title, index ? "False Doctrines · CyberJudah" : `${fixture.name} · False Doctrines · CyberJudah`);
  }
  for (const [error, message] of [["unpublished", "The false doctrines section is not published yet"], ["unavailable", "The false doctrines section did not load"]]) {
    assert.ok(renderToStaticMarkup(createElement(doctrine.DoctrineEmpty, { error })).includes(message));
  }
});

test("Doctrine renders only the supplied claim, KJV including Apocrypha, verbatim words and related chips", () => {
  const before = structuredClone(fixture);
  const html = renderToStaticMarkup(createElement(doctrine.DoctrineAnswers, { entry: fixture }));
  assert.ok(html.includes(fixture.claim));
  for (const answer of fixture.answers) {
    for (const ref of answer.refs) for (const verse of ref.text) assert.ok(html.includes(verse.text));
    for (const s of answer.sense) { assert.ok(html.includes(s.text)); assert.ok(html.includes(s.teacher)); }
  }
  for (const href of ["/classes/2026/fixture?t=65", "https://www.youtube.com/watch?v=fixture0002&amp;t=0s", "/bible/genesis/1?v=1", "/bible/2-esdras/6?v=38", "/precepts/fixture-precept", "/cases/fixture-case", "/topics/fixture-topic"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(html.indexOf(fixture.claim) < html.indexOf("Answer 1"));
  assert.deepEqual(fixture, before);
});

test("scriptures render their KJV text, exact class bullets, read markers and hour timestamps", () => {
  const before = structuredClone(fixture);
  const html = renderToStaticMarkup(createElement(doctrine.DoctrineAnswers, { entry: fixture }));
  const scripture = html.slice(html.indexOf("Scriptures against it"), html.indexOf("Related precepts"));
  assert.equal((scripture.match(/<li /g) ?? []).length, 2);
  for (const ref of fixture.scriptures) for (const verse of ref.text) assert.ok(scripture.includes(verse.text));
  assert.ok(scripture.includes('href="/bible/job/3#v17"'));
  assert.ok(scripture.includes(fixture.scriptures[0].points[0].text));
  assert.ok(scripture.includes(">Fixture explanation class · "));
  assert.ok(scripture.includes("Read in Fixture reading class"));
  assert.ok(scripture.includes('href="/classes/2026/fixture-scripture?t=821">Watch at 13:41'));
  assert.ok(scripture.includes('href="https://www.youtube.com/watch?v=fixture0004&amp;t=3725s"'));
  assert.ok(scripture.includes("Watch at 1:02:05"));
  assert.ok(!html.includes("undefined") && !html.includes("62:05") && !html.includes("<figcaption> · "));
  assert.ok(html.indexOf("Answer 1") < html.indexOf("Scriptures against it"));
  assert.deepEqual(fixture, before);
});

test("doctrine hides empty related sections and handles teachers and existing note queries", () => {
  const entry = structuredClone(fixture);
  entry.related.cases = []; entry.related.topics = [];
  entry.answers[0].sense[1].t = 4520; entry.answers[0].sense[1].ts = "1:15:20";
  const point = entry.scriptures[0].points[0];
  point.teacher = "Fixture teacher";
  point.note = "/classes/2026/fixture-scripture?source=fixture&t=1#moment";
  const html = renderToStaticMarkup(createElement(doctrine.DoctrineAnswers, { entry }));
  assert.ok(html.includes("Fixture teacher · Fixture explanation class"));
  assert.ok(html.includes('href="/classes/2026/fixture-scripture?source=fixture&amp;t=821#moment"'));
  assert.ok(html.includes("Watch at 1:15:20"));
  assert.ok(!html.includes("Related cases") && !html.includes("Related topics"));
  entry.scriptures = [];
  assert.ok(!renderToStaticMarkup(createElement(doctrine.DoctrineAnswers, { entry })).includes("Scriptures against it"));
});

test("Doctrine loaders distinguish not-published from connection failure and can retry after publication", async () => {
  for (const [message, expected] of [["404 for /api/doctrine/index.json", "unpublished"], ["503 for /api/doctrine/index.json", "unavailable"], ["network failure", "unavailable"]]) {
    const result = await doctrine.loadDoctrine(async () => { throw new Error(message); });
    assert.equal(result.data, null); assert.equal(result.error, expected);
  }
  const result = await doctrine.loadDoctrine(async () => fixture);
  assert.equal(result.error, null); assert.equal(result.data, fixture);
});

test("Doctrine API reads the published paths without rewriting their content", async () => {
  const calls = [];
  const { api } = load("../src/lib/api.ts", {}, { fetch: async url => { calls.push(new URL(url).pathname); return Response.json(fixture); } });
  assert.deepEqual(await api.doctrineEntry(fixture.slug), fixture);
  await api.doctrine();
  assert.deepEqual(calls, ["/api/doctrine/alpha-fixture.json", "/api/doctrine/index.json"]);
  const failed = load("../src/lib/api.ts", {}, { fetch: async () => new Response(null, { status: 404 }) }).api;
  await assert.rejects(failed.doctrine(), /404/);
  await assert.rejects(failed.doctrineEntry(fixture.slug), /404/);
  assert.equal(launchPath(pathToStartParam(fixture.url)), fixture.url);
});

test("a timed note seeks its recording embed, handles zero and resets on untimed navigation", () => {
  const frame = { src: "https://www.youtube-nocookie.com/embed/fixture0001", scrollIntoView() { this.scrolled = true; } };
  let search = "?t=65";
  const { NoteBody } = load("../src/components/site/note-body.tsx", {
    react: { useRef: () => ({ current: { querySelector: () => frame } }), useEffect: fn => fn() },
    "@tanstack/react-router": { useRouter: () => ({}), useRouterState: () => search },
    "@/components/site/ref-card": { RefCards: passthrough },
  }, { URL, URLSearchParams });
  NoteBody({ html: "" }); assert.equal(new URL(frame.src).searchParams.get("start"), "65"); assert.equal(frame.scrolled, true);
  search = "?t=0"; NoteBody({ html: "" }); assert.equal(new URL(frame.src).searchParams.get("start"), "0");
  search = ""; NoteBody({ html: "" }); assert.equal(new URL(frame.src).search, "");
  for (const invalid of ["-1", "oops", "1.5", "999999999999999999999"]) {
    search = `?t=${invalid}`; NoteBody({ html: "" }); assert.equal(new URL(frame.src).search, "");
  }
});
