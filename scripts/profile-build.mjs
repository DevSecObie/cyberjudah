// Profile the real production pipeline without changing its output or routing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "build-profile");
fs.mkdirSync(out, { recursive: true });
const env = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=3500",
  DOCUSAURUS_SSR_CONCURRENCY: process.env.DOCUSAURUS_SSR_CONCURRENCY ?? "1",
  DOCUSAURUS_SSG_WORKER_THREAD_COUNT: process.env.DOCUSAURUS_SSG_WORKER_THREAD_COUNT ?? "1",
  DOCUSAURUS_PERF_LOGGER: "true",
};
const report = { node: process.version, platform: process.platform,
  heapOptions: env.NODE_OPTIONS, ssrConcurrency: env.DOCUSAURUS_SSR_CONCURRENCY,
  workerThreads: env.DOCUSAURUS_SSG_WORKER_THREAD_COUNT,
  startedAt: new Date().toISOString(), stages: [] };
const stages = [
  ["generator", ["scripts/generate.mjs"]],
  ["pagefind", ["scripts/build-search-index.mjs"]],
  ["docusaurus", ["node_modules/@docusaurus/core/bin/docusaurus.mjs", "build"]],
];
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(report, null, 2) + "\n");
for (const [name, args] of stages) {
  const start = performance.now();
  const log = fs.createWriteStream(path.join(out, `${name}.log`));
  const timed = ["darwin", "linux"].includes(process.platform) && fs.existsSync("/usr/bin/time");
  // macOS reports RSS in bytes; GNU time reports KiB. Keep raw output as evidence.
  const child = spawn(timed ? "/usr/bin/time" : process.execPath,
    timed ? [process.platform === "darwin" ? "-l" : "-v", process.execPath, ...args] : args,
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stdout.on("data", (chunk) => { process.stdout.write(chunk); log.write(chunk); });
  child.stderr.on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk); log.write(chunk); });
  const code = await new Promise((resolve) => {
    child.on("error", (error) => { stderr += String(error); log.write(String(error)); resolve(1); });
    child.on("close", (code) => resolve(code ?? 1));
  });
  await new Promise((resolve) => log.end(resolve));
  const rss = process.platform === "darwin"
    ? stderr.match(/(\d+)\s+maximum resident set size/)
    : stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
  const footprint = stderr.match(/(\d+)\s+peak memory footprint/);
  report.stages.push({ name, seconds: +( (performance.now() - start) / 1000).toFixed(2),
    maxRssMiB: rss ? +(Number(rss[1]) / (process.platform === "darwin" ? 1048576 : 1024)).toFixed(1) : null,
    macPeakFootprintMiB: footprint ? +(Number(footprint[1]) / 1048576).toFixed(1) : null,
    exitCode: code });
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(report, null, 2) + "\n");
  if (code !== 0) process.exit(code);
}
console.table(report.stages);
