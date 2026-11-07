#!/usr/bin/env node
// Import committed source bytes from a local checkout, never a floating network response.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { TIMELINE_REPOSITORY, TIMELINE_PATH, TIMELINE_LICENSE_PATH, TIMELINE_CREDITS_PATH, TIMELINE_CREDIT, sha256, validateTimeline } from "../../engine/timeline-data.mjs";

export function syncTimeline({ repo, ref, destination, check = false }) {
  if (!repo || !/^[a-f0-9]{40}$/i.test(ref ?? "")) throw new Error("Supply --repo <local Telegram checkout> and --ref <reviewed 40-character commit>");
  const git = args => execFileSync("git", ["-C", repo, ...args], { maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const origin = git(["remote", "get-url", "origin"]).toString().trim();
  if (!/^(?:https:\/\/github\.com\/|git@github\.com:)DevSecObie\/cyberjudah-telegram(?:\.git)?$/.test(origin)) throw new Error("The source checkout must be DevSecObie/cyberjudah-telegram");
  const commit = git(["rev-parse", "--verify", `${ref}^{commit}`]).toString().trim();
  const read = source => git(["show", `${commit}:${source}`]);
  const bytes = read(TIMELINE_PATH), license = read(TIMELINE_LICENSE_PATH), credits = read(TIMELINE_CREDITS_PATH);
  validateTimeline(bytes);
  // Match the existing site's credit, without evaluating upstream code.
  for (const [field, value] of Object.entries(TIMELINE_CREDIT).filter(([key]) => key !== "licenseUrl")) {
    const line = credits.toString().split("\n").find(line => line.includes('name: "Timeline layout and events"'));
    if (!line?.includes(`${field}: ${JSON.stringify(value)}`)) throw new Error("The upstream Timeline attribution changed; review it before importing");
  }
  if (!credits.toString().includes(`const GPL = ${JSON.stringify(TIMELINE_CREDIT.licenseUrl)}`)) throw new Error("The upstream Timeline licence URL changed");
  const provenance = { version: 1, repository: TIMELINE_REPOSITORY, commit, path: TIMELINE_PATH, sha256: sha256(bytes), licensePath: TIMELINE_LICENSE_PATH, licenseSha256: sha256(license), creditsPath: TIMELINE_CREDITS_PATH, creditsSha256: sha256(credits) };
  const files = new Map([["timeline.json", bytes], ["bible-strong-LICENSE", license], ["source.json", Buffer.from(JSON.stringify(provenance, null, 2) + "\n")]]);
  if (!check) fs.mkdirSync(destination, { recursive: true });
  for (const [file, content] of files) {
    const target = path.join(destination, file);
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(content)) throw new Error(`Timeline snapshot mismatch: ${file}`);
    } else fs.writeFileSync(target, content);
  }
  return provenance;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = key => args[args.indexOf(key) + 1];
  const root = fileURLToPath(new URL("../../", import.meta.url));
  try {
    const result = syncTimeline({ repo: args.includes("--repo") ? opt("--repo") : undefined, ref: args.includes("--ref") ? opt("--ref") : undefined, destination: path.join(root, "data", "timeline"), check: args.includes("--check") });
    console.log(`Timeline ${args.includes("--check") ? "verified" : "imported"}: ${result.commit}, sha256 ${result.sha256}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
