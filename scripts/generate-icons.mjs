#!/usr/bin/env node
// Node 組み込みの zlib のみで PNG を書き出し、
// Capacitor/iOS のアイコン・スプラッシュ原本を生成する。
//
// 出力:
//   assets/icon.png          1024x1024 (@capacitor/assets 用)
//   assets/splash.png        2732x2732
//   assets/splash-dark.png   2732x2732 (icon.png と同じ暗色調)
//   icons/icon-192.png       PWA 用
//   icons/icon-512.png       PWA 用
//   icons/apple-touch-icon.png 180x180

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ---------- PNG エンコーダ (truecolor + alpha, 8bit) ----------

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba, { alpha = true } = {}) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(alpha ? 6 : 2, 9); // color type: 6=RGBA, 2=RGB
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const channels = alpha ? 4 : 3;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const srcI = (y * width + x) * 4;
      const dstI = y * (stride + 1) + 1 + x * channels;
      raw[dstI] = rgba[srcI];
      raw[dstI + 1] = rgba[srcI + 1];
      raw[dstI + 2] = rgba[srcI + 2];
      if (alpha) raw[dstI + 3] = rgba[srcI + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 描画プリミティブ ----------

function makeCanvas(size) {
  return { size, pixels: Buffer.alloc(size * size * 4) };
}

function setPx(cv, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size) return;
  const i = (y * cv.size + x) * 4;
  cv.pixels[i] = r;
  cv.pixels[i + 1] = g;
  cv.pixels[i + 2] = b;
  cv.pixels[i + 3] = a;
}

function blendPx(cv, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size) return;
  const i = (y * cv.size + x) * 4;
  const dstA = cv.pixels[i + 3] / 255;
  const srcA = a / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  const blend = (sc, dc) => (sc * srcA + dc * dstA * (1 - srcA)) / outA;
  cv.pixels[i] = Math.round(blend(r, cv.pixels[i]));
  cv.pixels[i + 1] = Math.round(blend(g, cv.pixels[i + 1]));
  cv.pixels[i + 2] = Math.round(blend(b, cv.pixels[i + 2]));
  cv.pixels[i + 3] = Math.round(outA * 255);
}

function fillRadialBg(cv, inner, outer) {
  const s = cv.size;
  const cx = s / 2;
  const cy = s * 0.35;
  const maxR = Math.hypot(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxR;
      const t = Math.min(1, d * 1.5);
      const r = Math.round(inner[0] + (outer[0] - inner[0]) * t);
      const g = Math.round(inner[1] + (outer[1] - inner[1]) * t);
      const b = Math.round(inner[2] + (outer[2] - inner[2]) * t);
      setPx(cv, x, y, r, g, b, 255);
    }
  }
}

function fillCircle(cv, cx, cy, radius, color) {
  const [r, g, b, a = 255] = color;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const x1 = Math.min(cv.size - 1, Math.ceil(cx + radius + 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const y1 = Math.min(cv.size - 1, Math.ceil(cy + radius + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r2) {
        blendPx(cv, x, y, r, g, b, a);
      } else {
        // アンチエイリアス: 半径付近のピクセルを滑らかに
        const d = Math.sqrt(d2);
        const diff = d - radius;
        if (diff < 1) {
          const aa = Math.round(a * (1 - diff));
          if (aa > 0) blendPx(cv, x, y, r, g, b, aa);
        }
      }
    }
  }
}

function strokeCircle(cv, cx, cy, radius, thickness, color) {
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  const [r, g, b, a = 255] = color;
  const x0 = Math.max(0, Math.floor(cx - outer - 1));
  const x1 = Math.min(cv.size - 1, Math.ceil(cx + outer + 1));
  const y0 = Math.max(0, Math.floor(cy - outer - 1));
  const y1 = Math.min(cv.size - 1, Math.ceil(cy + outer + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= inner && d <= outer) {
        blendPx(cv, x, y, r, g, b, a);
      } else if (d > outer && d < outer + 1) {
        blendPx(cv, x, y, r, g, b, Math.round(a * (1 - (d - outer))));
      } else if (d < inner && d > inner - 1) {
        blendPx(cv, x, y, r, g, b, Math.round(a * (1 - (inner - d))));
      }
    }
  }
}

function fillTriangle(cv, p1, p2, p3, color) {
  const [r, g, b, a = 255] = color;
  const minX = Math.max(0, Math.floor(Math.min(p1[0], p2[0], p3[0])));
  const maxX = Math.min(cv.size - 1, Math.ceil(Math.max(p1[0], p2[0], p3[0])));
  const minY = Math.max(0, Math.floor(Math.min(p1[1], p2[1], p3[1])));
  const maxY = Math.min(cv.size - 1, Math.ceil(Math.max(p1[1], p2[1], p3[1])));
  const edge = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const area = edge(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w1 = edge(p2[0], p2[1], p3[0], p3[1], x, y) / area;
      const w2 = edge(p3[0], p3[1], p1[0], p1[1], x, y) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
        blendPx(cv, x, y, r, g, b, a);
      }
    }
  }
}

// ---------- アプリアイコン ----------

function drawIcon(size) {
  const cv = makeCanvas(size);
  // 背景
  fillRadialBg(cv, [31, 51, 89], [12, 17, 27]);

  const cx = size / 2;
  const cy = size / 2;

  // 外側のオーラリング (グロー)
  for (let r = size * 0.48; r > size * 0.4; r -= 1) {
    const alpha = Math.max(0, 40 - (size * 0.48 - r) * 6);
    strokeCircle(cv, cx, cy, r, 1.2, [107, 212, 255, Math.round(alpha)]);
  }
  strokeCircle(cv, cx, cy, size * 0.42, size * 0.015, [107, 212, 255, 220]);

  // 敵 (ヴォーギン) — 赤い円 (下層)
  fillCircle(cv, cx + size * 0.18, cy + size * 0.12, size * 0.1, [255, 95, 117, 235]);
  strokeCircle(cv, cx + size * 0.18, cy + size * 0.12, size * 0.1, size * 0.008, [255, 216, 222, 255]);

  // プレイヤー (ノヴ) — 青い円
  fillCircle(cv, cx - size * 0.08, cy - size * 0.05, size * 0.16, [107, 212, 255, 255]);
  strokeCircle(cv, cx - size * 0.08, cy - size * 0.05, size * 0.16, size * 0.008, [212, 243, 255, 255]);

  // 攻撃のスラッシュ (黄色い三角)
  const sx = cx + size * 0.02;
  const sy = cy - size * 0.03;
  fillTriangle(
    cv,
    [sx, sy - size * 0.02],
    [sx + size * 0.22, sy - size * 0.04],
    [sx + size * 0.08, sy + size * 0.04],
    [255, 241, 166, 230],
  );

  return cv;
}

function drawSplash(size) {
  const cv = makeCanvas(size);
  fillRadialBg(cv, [31, 51, 89], [12, 17, 27]);
  // 中央にアイコンを縮小して配置
  const inner = drawIcon(Math.floor(size * 0.38));
  const offset = Math.floor((size - inner.size) / 2);
  for (let y = 0; y < inner.size; y++) {
    for (let x = 0; x < inner.size; x++) {
      const i = (y * inner.size + x) * 4;
      const r = inner.pixels[i];
      const g = inner.pixels[i + 1];
      const b = inner.pixels[i + 2];
      const a = inner.pixels[i + 3];
      blendPx(cv, x + offset, y + offset, r, g, b, a);
    }
  }
  return cv;
}

// ---------- リサイズ (nearest-neighbor + 平均) ----------

function resizeCanvas(src, target) {
  const out = makeCanvas(target);
  const ratio = src.size / target;
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      const sx0 = Math.floor(x * ratio);
      const sy0 = Math.floor(y * ratio);
      const sx1 = Math.min(src.size, Math.floor((x + 1) * ratio));
      const sy1 = Math.min(src.size, Math.floor((y + 1) * ratio));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          const i = (yy * src.size + xx) * 4;
          r += src.pixels[i];
          g += src.pixels[i + 1];
          b += src.pixels[i + 2];
          a += src.pixels[i + 3];
          n++;
        }
      }
      n = n || 1;
      const i = (y * target + x) * 4;
      out.pixels[i] = Math.round(r / n);
      out.pixels[i + 1] = Math.round(g / n);
      out.pixels[i + 2] = Math.round(b / n);
      out.pixels[i + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ---------- メイン ----------

async function writePng(path, cv, opts = {}) {
  await mkdir(dirname(path), { recursive: true });
  const png = encodePng(cv.size, cv.size, cv.pixels, opts);
  await writeFile(path, png);
  console.log(`[icons] wrote ${path} (${cv.size}x${cv.size}, ${png.length} bytes)`);
}

async function main() {
  // 1024 を作って、他は縮小で生成
  const master = drawIcon(1024);

  // App Store 提出用は alpha 不要 / 透過禁止
  await writePng(resolve(root, "assets/icon.png"), master, { alpha: false });
  await writePng(resolve(root, "assets/icon-only.png"), master, { alpha: false });
  await writePng(resolve(root, "assets/icon-foreground.png"), master);
  await writePng(resolve(root, "assets/icon-background.png"), (function () {
    const bg = makeCanvas(1024);
    fillRadialBg(bg, [31, 51, 89], [12, 17, 27]);
    return bg;
  })(), { alpha: false });

  const splash = drawSplash(2732);
  await writePng(resolve(root, "assets/splash.png"), splash, { alpha: false });
  await writePng(resolve(root, "assets/splash-dark.png"), splash, { alpha: false });

  await writePng(resolve(root, "icons/icon-192.png"), resizeCanvas(master, 192));
  await writePng(resolve(root, "icons/icon-512.png"), resizeCanvas(master, 512));
  await writePng(resolve(root, "icons/apple-touch-icon.png"), resizeCanvas(master, 180));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
