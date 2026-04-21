#!/usr/bin/env node
// ルートの Web 資産を www/ に複製する軽量ビルドステップ。
// Capacitor の webDir は www/ を指すため、ソースをここにコピーする。

import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const out = resolve(root, "www");

const files = [
  "index.html",
  "styles.css",
  "game.js",
  "manifest.webmanifest",
];

const dirs = ["icons"];

async function main() {
  if (existsSync(out)) {
    await rm(out, { recursive: true, force: true });
  }
  await mkdir(out, { recursive: true });

  for (const f of files) {
    const src = resolve(root, f);
    if (!existsSync(src)) {
      console.warn(`[sync-www] skip missing file: ${f}`);
      continue;
    }
    await cp(src, resolve(out, f));
  }

  for (const d of dirs) {
    const src = resolve(root, d);
    if (!existsSync(src)) {
      console.warn(`[sync-www] skip missing dir: ${d}`);
      continue;
    }
    await cp(src, resolve(out, d), { recursive: true });
  }

  console.log(`[sync-www] copied to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
