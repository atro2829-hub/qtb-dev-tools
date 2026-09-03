/**
 * Generates PWA icons from the brand mark (src/app/icon.svg).
 * Run: bun run scripts/generate-pwa-icons.ts
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const OUT = path.join(ROOT, "public", "icons");
mkdirSync(OUT, { recursive: true });

const svg = readFileSync(path.join(ROOT, "src", "app", "icon.svg"), "utf8");

async function render(size: number, outFile: string, opts?: { scale?: number; background?: string }) {
  const scale = opts?.scale ?? 1;
  const background = opts?.background ?? "transparent";

  let composite = svg;
  if (scale !== 1) {
    // Re-center the artwork inside the viewBox for maskable safe zones.
    const pad = (1 - scale) * 64;
    composite = svg.replace(
      "<svg ",
      `<svg x="${pad / 2}" y="${pad / 2}" width="${64 * scale}" height="${64 * scale}" `
    );
  }

  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : background,
    },
  });

  const layer = sharp(Buffer.from(composite)).resize(size, size);
  const buf = await layer.png().toBuffer();
  await base.composite([{ input: buf }]).png().toFile(path.join(OUT, outFile));
  console.log(`✓ ${outFile} (${size}x${size})`);
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(512, "maskable-512.png", { scale: 0.72, background: "#0a0a0a" });
await render(180, "apple-touch-icon.png", { background: "#0a0a0a" });
console.log("PWA icons generated.");
