// optimize-icons.mjs
// Resize + recompress every favicon in assets/icons/ to a small, uniform PNG.
// Favicons only ever render at ~28-44px on the page, so 64x64 is plenty.
//
// Many cached icons were saved with a `.png` name but actually contain ICO,
// SVG, or (for broken downloads) HTML error pages. This script detects the
// real format via magic bytes and normalizes everything to real PNG.
//
// Run: node scripts/optimize-icons.mjs   (or: npm run optimize-icons)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import ico from "sharp-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const iconsDir = path.join(root, "assets/icons");

const TARGET = 64; // px, square

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function detectFormat(buf) {
  const hex = buf.subarray(0, 4).toString("hex");
  if (hex.startsWith("89504e47")) return "png";
  if (hex.startsWith("47494638")) return "gif";
  if (hex.startsWith("ffd8ff")) return "jpeg";
  if (hex.startsWith("52494646")) return "webp"; // RIFF (WebP)
  if (hex.startsWith("00000100") || hex.startsWith("00000200")) return "ico";
  const head = buf.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "svg";
  if (head.startsWith("<!") || head.startsWith("<html") || head.startsWith("<head"))
    return "html";
  return "unknown";
}

// Produce a sharp instance from an arbitrary favicon buffer.
async function toSharp(buf, fmt) {
  if (fmt === "ico") {
    // Decode ICO, pick the largest frame.
    const images = ico.sharpsFromIco(buf, undefined, true); // [{ image, ... }]
    let best = null;
    let bestArea = -1;
    for (const entry of images) {
      const img = entry.image || entry;
      const meta = await img.metadata();
      const area = (meta.width || 0) * (meta.height || 0);
      if (area > bestArea) {
        bestArea = area;
        best = img;
      }
    }
    if (!best) throw new Error("empty ICO");
    return best;
  }
  if (fmt === "svg") {
    return sharp(buf, { density: 256 }); // rasterize crisply
  }
  // png / jpeg / gif / webp
  return sharp(buf, { animated: false });
}

async function main() {
  if (!fs.existsSync(iconsDir)) {
    console.error(`No icons directory at ${iconsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(iconsDir)
    .filter((f) => /\.(png|ico|jpg|jpeg|webp|gif|svg)$/i.test(f));

  let beforeTotal = 0;
  let afterTotal = 0;
  let optimized = 0;
  let skipped = 0;
  const broken = [];

  for (const file of files) {
    const src = path.join(iconsDir, file);
    const stat = fs.statSync(src);
    beforeTotal += stat.size;

    const base = file.replace(/\.[^.]+$/, "");
    const dest = path.join(iconsDir, `${base}.png`);
    const buf = fs.readFileSync(src);
    const fmt = detectFormat(buf);

    if (fmt === "html" || fmt === "unknown") {
      // Broken/placeholder download — remove so the app falls back to the
      // online favicon APIs instead of rendering a blank image.
      broken.push(base);
      fs.rmSync(src);
      console.log(`  x ${base.padEnd(22)} removed (${fmt} placeholder)`);
      continue;
    }

    try {
      const img = await toSharp(buf, fmt);
      const out = await img
        .resize(TARGET, TARGET, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, palette: true, quality: 80, effort: 8 })
        .toBuffer();

      // Remove non-png original if we're renaming.
      if (src !== dest && fs.existsSync(src)) fs.rmSync(src);
      fs.writeFileSync(dest, out);

      afterTotal += out.length;
      optimized++;
      const flag = out.length < stat.size ? " " : "+";
      console.log(
        `  ${flag} ${base.padEnd(22)} ${fmtKB(stat.size).padStart(8)} -> ${fmtKB(
          out.length
        ).padStart(8)}  (${fmt})`
      );
    } catch (e) {
      afterTotal += stat.size;
      skipped++;
      console.error(`  ! ${base}: ${e.message}`);
    }
  }

  console.log(
    `\nDone. optimized=${optimized} removed=${broken.length} skipped=${skipped}`
  );
  console.log(
    `Total: ${fmtKB(beforeTotal)} -> ${fmtKB(afterTotal)} ` +
      `(saved ${fmtKB(beforeTotal - afterTotal)}, ` +
      `${(((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(1)}%)`
  );
  if (broken.length) {
    console.log(
      `\nRemoved broken icons (will re-download on next fetch-icons run):\n  ${broken.join(
        ", "
      )}`
    );
  }
}

main().catch((err) => {
  console.error("optimize-icons failed:", err);
  process.exit(1);
});
