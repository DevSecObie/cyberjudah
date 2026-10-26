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
    exports, __meta: { env: {} }, Error, ...globals,
    require: name => name === "react/jsx-runtime" ? require(name) : imports[name] ?? {},
  });
  return exports;
}
const refs = load("../src/components/site/ref-quote.tsx", { "@tanstack/react-router": { Link: link } });
const doctrine = load("../src/routes/doctrine/-shared.tsx", {
  "@tanstack/react-router": { Link: link },
  "@/components/site/ref-quote": refs,
  "@/components/site/ref-card": { RefCards: passthrough },
  "@/lib/teaching-refs": load("../src/lib/teaching-refs.ts"),
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
