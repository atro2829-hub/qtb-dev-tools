/**
 * Generates public/og-image.png (1200x630) for social sharing previews.
 * Run once: bun scripts/generate-og.ts
 */
import sharp from "sharp";
import { writeFileSync } from "fs";

const W = 1200;
const H = 630;

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sparks" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="45%" stop-color="#d946ef"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.85" cy="0.1" r="0.5">
      <stop offset="0%" stop-color="#d946ef" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#d946ef" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.1" cy="0.95" r="0.5">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <!-- logo tile -->
  <rect x="72" y="86" width="108" height="108" rx="28" fill="#0a0a0a"/>
  <circle cx="126" cy="133" r="24" fill="none" stroke="#ffffff" stroke-width="11"/>
  <line x1="143" y1="150" x2="163" y2="170" stroke="#ffffff" stroke-width="11" stroke-linecap="round"/>
  <path d="M162 96l4.2 11.4 11.4 4.2-11.4 4.2-4.2 11.4-4.2-11.4-11.4-4.2 11.4-4.2z" fill="url(#sparks)"/>

  <text x="206" y="152" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="800" fill="#0a0a0a" letter-spacing="1">QTB DEV TOOLS</text>
  <rect x="207" y="168" width="196" height="7" rx="3.5" fill="url(#sparks)"/>

  <text x="72" y="330" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="900" fill="#0a0a0a" letter-spacing="-2">Professional tools.</text>
  <text x="72" y="438" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="900" fill="url(#sparks)" letter-spacing="-2">One platform.</text>

  <text x="74" y="510" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500" fill="#525252">AI background removal · File conversion · Document translation · PDF tools</text>

  <!-- tool chips -->
  <g font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">
    <rect x="74" y="546" width="128" height="52" rx="26" fill="#fef3c7" stroke="#f59e0b" stroke-opacity="0.4"/>
    <text x="138" y="580" text-anchor="middle" fill="#b45309">AI Cutout</text>
    <rect x="216" y="546" width="150" height="52" rx="26" fill="#fce7f3" stroke="#d946ef" stroke-opacity="0.4"/>
    <text x="291" y="580" text-anchor="middle" fill="#a21caf">Converter</text>
    <rect x="380" y="546" width="150" height="52" rx="26" fill="#d1fae5" stroke="#10b981" stroke-opacity="0.4"/>
    <text x="455" y="580" text-anchor="middle" fill="#047857">Translator</text>
    <rect x="544" y="546" width="140" height="52" rx="26" fill="#ede9fe" stroke="#8b5cf6" stroke-opacity="0.4"/>
    <text x="614" y="580" text-anchor="middle" fill="#6d28d9">PDF Tools</text>
  </g>

  <!-- footer -->
  <rect x="0" y="622" width="${W}" height="8" fill="url(#sparks)"/>
  <text x="72" y="608" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#a3a3a3" letter-spacing="2">QUTAIBIV.COM</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync("public/og-image.png", png);
console.log("og-image.png written:", png.length, "bytes");
