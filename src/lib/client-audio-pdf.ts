"use client";

/**
 * Client-side "Smart Document" PDF renderer — Audio → PDF tool.
 *
 * WHY client-side: Arabic PDF typesetting needs full bidi + glyph shaping.
 * The browser canvas (with the loaded Noto Kufi Arabic webfont) renders
 * Arabic perfectly, so each A4 page is painted on an offscreen canvas and
 * assembled into a real PDF with pdf-lib (already in the bundle). This adds
 * ZERO server dependencies and stays well under the Workers bundle limit.
 *
 * Output: a beautifully organized document — brand header, title page area,
 * executive summary, key points, structured sections, conclusion, footer.
 */

import { PDFDocument } from "pdf-lib";

/* ------------------------------------------------------------------ */
/* Types (mirror the API response of /api/tools/audio-pdf)             */
/* ------------------------------------------------------------------ */

export interface AudioDocSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

export interface SmartAudioDoc {
  title: string;
  subtitle: string;
  language: string;
  summary: string;
  keyPoints: string[];
  sections: AudioDocSection[];
  conclusion: string;
  wordCount: number;
}

export interface AudioPdfMeta {
  sourceFile: string;
  styleLabel: string;
  processedAt: string; // ISO or localized string
  durationLabel?: string;
  /** Optional site logo (admin setting) drawn in the header tile. */
  logoUrl?: string;
  engine?: string;
}

/* ------------------------------------------------------------------ */
/* Layout constants (A4 @ 150 DPI)                                     */
/* ------------------------------------------------------------------ */

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN_X = 110;
const MARGIN_TOP = 100;
const MARGIN_BOTTOM = 130;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const INK = "#18181b";
const BODY = "#3f3f46";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const ACCENT_1 = "#0ea5e9";
const ACCENT_2 = "#06b6d4";
const SKY_BG = "#f0f9ff";
const SKY_BORDER = "#bae6fd";
const NEUTRAL_BG = "#fafaf9";
const NEUTRAL_BORDER = "#e7e5e4";

const AR_FONT = '"Noto Kufi Arabic"';
const LAT_FONT = '"Geist"';
const fontStack = `${AR_FONT}, ${LAT_FONT}, sans-serif`;

const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const isRtlText = (s: string) => RTL_RE.test(s);

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

let fontsReady: Promise<void> | null = null;

function ensureFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  const loads: Promise<unknown>[] = [];
  if (typeof document !== "undefined" && document.fonts) {
    loads.push(
      document.fonts.load(`400 24px ${AR_FONT}`, "نص عربي"),
      document.fonts.load(`500 24px ${AR_FONT}`, "نص عربي"),
      document.fonts.load(`600 30px ${AR_FONT}`, "نص عربي"),
      document.fonts.load(`700 52px ${AR_FONT}`, "نص عربي"),
      document.fonts.load(`400 24px ${LAT_FONT}`, "Sample"),
      document.fonts.load(`600 26px ${LAT_FONT}`, "Sample"),
      document.fonts.load(`800 34px ${LAT_FONT}`, "Sample")
    );
  }
  fontsReady = Promise.all(loads)
    .then(() => document.fonts?.ready)
    .then(() => undefined)
    .catch(() => undefined);
  return fontsReady;
}

/* ------------------------------------------------------------------ */
/* Paginator                                                           */
/* ------------------------------------------------------------------ */

interface Page {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

class Paginator {
  pages: Page[] = [];
  ctx!: CanvasRenderingContext2D;
  y = MARGIN_TOP;
  private page!: Page;

  constructor() {
    this.newPage();
  }

  newPage() {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = "alphabetic";
    this.page = { canvas, ctx };
    this.pages.push(this.page);
    this.ctx = ctx;
    this.y = MARGIN_TOP;
  }

  get remaining() {
    return PAGE_H - MARGIN_BOTTOM - this.y;
  }
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        // Hard-break a single word wider than the column.
        if (!line && ctx.measureText(candidate).width > maxWidth) {
          let chunk = "";
          for (const ch of candidate) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
          continue;
        }
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function setFont(
  ctx: CanvasRenderingContext2D,
  weight: number,
  size: number,
  text: string
) {
  // Noto Kufi has no italic; Arabic-first stack keeps metrics consistent.
  ctx.font = `${weight} ${size}px ${fontStack}`;
  void text;
}

interface DrawLineOpts {
  weight: number;
  size: number;
  color: string;
  x?: number; // left anchor (LTR) or right anchor (RTL)
  anchor?: "start" | "center";
  maxWidth?: number;
}

/** Draw a text block at a specific y; returns height consumed. */
function drawBlockAt(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  opts: DrawLineOpts & { lineHeight?: number }
): number {
  setFont(ctx, opts.weight, opts.size, text);
  const rtl = isRtlText(text);
  ctx.direction = rtl ? "rtl" : "ltr";
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = opts.lineHeight ?? Math.round(opts.size * 1.52);
  const x = opts.x ?? (rtl ? PAGE_W - MARGIN_X : MARGIN_X);
  const anchor = opts.anchor ?? "start";
  ctx.textAlign =
    anchor === "center" ? "center" : rtl && anchor === "start" ? "right" : "left";
  // With textAlign 'right' the x IS the (physical) right edge — for RTL the
  // anchor is the right margin itself, never shifted by the column width.
  const anchorX = anchor === "center" ? PAGE_W / 2 : x;
  ctx.fillStyle = opts.color;
  let yy = y;
  for (const line of lines) {
    if (line) ctx.fillText(line, anchorX, yy + opts.size * 0.82);
    yy += lineHeight;
  }
  return lines.length * lineHeight;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function accentGradient(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, ACCENT_1);
  g.addColorStop(1, ACCENT_2);
  return g;
}

/* ------------------------------------------------------------------ */
/* Block renderers                                                     */
/* ------------------------------------------------------------------ */

const LINE = (size: number) => Math.round(size * 1.52);

/**
 * Fetch the admin site logo as a decodable bitmap. Fetch (not <img>) so the
 * canvas is never tainted — any failure simply falls back to the Q mark.
 */
async function loadLogoBitmap(url?: string): Promise<ImageBitmap | null> {
  if (!url || typeof fetch === "undefined" || typeof createImageBitmap !== "function") {
    return null;
  }
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}


function drawBrandPanel(p: { ctx: CanvasRenderingContext2D }, meta: AudioPdfMeta, title: string, logo: ImageBitmap | null) {
  const { ctx } = p;
  const panelH = 168;
  const x = MARGIN_X;
  const y = MARGIN_TOP;
  const w = CONTENT_W;

  // Dark brand panel
  roundRect(ctx, x, y, w, panelH, 24);
  ctx.fillStyle = "#101014";
  ctx.fill();
  // gradient edge
  ctx.save();
  roundRect(ctx, x, y, w, panelH, 24);
  ctx.clip();
  const g = accentGradient(ctx, x, y, 340, panelH);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, 340, panelH);
  ctx.restore();

  // Logo tile (admin logoUrl) — falls back to the Q brand mark
  const tileX = x + 28;
  const tileY = y + 44;
  roundRect(ctx, tileX, tileY, 80, 80, 20);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (logo) {
    ctx.save();
    roundRect(ctx, tileX + 6, tileY + 6, 68, 68, 15);
    ctx.clip();
    const s = Math.max(68 / logo.width, 68 / logo.height);
    const dw = logo.width * s;
    const dh = logo.height * s;
    ctx.drawImage(logo, tileX + (80 - dw) / 2, tileY + (80 - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    setFont(ctx, 800, 44, "Q");
    ctx.fillStyle = "#101014";
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText("Q", x + 68, y + 44 + 58);
  }

  // Brand label + tool name
  setFont(ctx, 700, 22, "QTB");
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("QTB DEV TOOLS", x + 136, y + 78);
  setFont(ctx, 500, 19, "QTB");
  ctx.fillStyle = "#7dd3fc";
  ctx.fillText("AUDIO  →  SMART PDF", x + 136, y + 112);

  // right side: date (LTR latin digits)
  setFont(ctx, 500, 18, "2024");
  ctx.fillStyle = "#a1a1aa";
  ctx.textAlign = "right";
  ctx.fillText(meta.processedAt, x + w - 30, y + 78);
  if (meta.durationLabel) {
    ctx.fillText(meta.durationLabel, x + w - 30, y + 112);
  }

  return y + panelH;
}

function fitTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  maxWidth: number,
  startSize = 52
): { size: number; lines: string[] } {
  let size = startSize;
  setFont(ctx, 700, size, title);
  while (size > 30 && ctx.measureText(title).width > maxWidth) {
    size -= 2;
    setFont(ctx, 700, size, title);
  }
  const lines = wrapText(ctx, title, maxWidth);
  return { size, lines };
}

function drawMetaChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number
): number {
  setFont(ctx, 500, 19, text);
  const padX = 22;
  const h = 44;
  const w = ctx.measureText(text).width + padX * 2;
  roundRect(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = "#f4f4f5";
  ctx.fill();
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.direction = isRtlText(text) ? "rtl" : "ltr";
  ctx.fillText(text, cx, y + h / 2 + 7);
  return w;
}

function drawSummaryCard(p: { ctx: CanvasRenderingContext2D }, label: string, text: string, startY: number) {
  const { ctx } = p;
  const pad = 30;
  const innerW = CONTENT_W - pad * 2 - 6;
  setFont(ctx, 500, 24, text);
  const lines = wrapText(ctx, text, innerW);
  const labelH = 46;
  const h = labelH + lines.length * LINE(24) + pad * 2 - 8;

  roundRect(ctx, MARGIN_X, startY, CONTENT_W, h, 20);
  ctx.fillStyle = SKY_BG;
  ctx.fill();
  ctx.strokeStyle = SKY_BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();
  // accent side bar
  roundRect(ctx, MARGIN_X + 12, startY + 16, 6, h - 32, 3);
  ctx.fillStyle = accentGradient(ctx, MARGIN_X, startY, 8, h);
  ctx.fill();

  setFont(ctx, 700, 20, label);
  ctx.fillStyle = "#0369a1";
  ctx.direction = isRtlText(label) ? "rtl" : "ltr";
  ctx.textAlign = isRtlText(label) ? "right" : "left";
  const labelX = isRtlText(label) ? MARGIN_X + CONTENT_W - pad : MARGIN_X + pad + 8;
  ctx.fillText(label, labelX, startY + pad + 14);

  const rtl = isRtlText(text);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  setFont(ctx, 500, 24, text);
  ctx.fillStyle = BODY;
  let yy = startY + pad + labelH;
  const tx = rtl ? MARGIN_X + CONTENT_W - pad - 8 : MARGIN_X + pad + 8;
  for (const line of lines) {
    ctx.fillText(line, tx, yy + 24 * 0.82);
    yy += LINE(24);
  }
  return startY + h;
}

function drawSectionHeading(p: { ctx: CanvasRenderingContext2D }, heading: string, y: number) {
  const { ctx } = p;
  const rtl = isRtlText(heading);
  const barX = rtl ? PAGE_W - MARGIN_X - 8 : MARGIN_X;
  roundRect(ctx, barX, y + 4, 8, 36, 4);
  ctx.fillStyle = accentGradient(ctx, barX, y, 8, 44);
  ctx.fill();

  setFont(ctx, 700, 29, heading);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillStyle = INK;
  const textX = rtl ? PAGE_W - MARGIN_X - 28 : MARGIN_X + 28;
  const maxW = CONTENT_W - 40;
  const lines = wrapText(ctx, heading, maxW);
  let yy = y;
  for (const line of lines) {
    ctx.fillText(line, textX, yy + 29 * 0.82);
    yy += LINE(29);
  }
  return yy + 6;
}

function drawBulletLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  indent: number
) {
  const rtl = isRtlText(text);
  const textW = CONTENT_W - indent;
  setFont(ctx, 500, 24, text);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillStyle = BODY;
  const lines = wrapText(ctx, text, textW);
  const textAnchorX = rtl ? PAGE_W - MARGIN_X - indent : MARGIN_X + indent;
  let yy = y;
  // dot
  const dotX = rtl ? PAGE_W - MARGIN_X - 11 : MARGIN_X + 11;
  ctx.beginPath();
  ctx.arc(dotX, y + 24 * 0.72, 7, 0, Math.PI * 2);
  ctx.fillStyle = accentGradient(ctx, MARGIN_X, y, 40, 40);
  ctx.fill();
  for (const line of lines) {
    ctx.fillStyle = BODY;
    ctx.fillText(line, textAnchorX, yy + 24 * 0.82);
    yy += LINE(24);
  }
  return yy;
}

function drawFooter(p: { ctx: CanvasRenderingContext2D }, pageNo: number, total: number) {
  const { ctx } = p;
  const y = PAGE_H - 78;
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, y);
  ctx.lineTo(PAGE_W - MARGIN_X, y);
  ctx.stroke();

  setFont(ctx, 600, 17, "QTB");
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.fillStyle = FAINT;
  ctx.fillText("QTB DEV TOOLS  ·  qutaibiv.com", MARGIN_X, y + 34);

  ctx.textAlign = "right";
  setFont(ctx, 500, 17, "9");
  ctx.fillText(`${pageNo} / ${total}`, PAGE_W - MARGIN_X, y + 34);
}

/* ------------------------------------------------------------------ */
/* Main renderer                                                       */
/* ------------------------------------------------------------------ */

export async function smartDocToPdf(
  doc: SmartAudioDoc,
  meta: AudioPdfMeta
): Promise<Blob> {
  await ensureFonts();
  const logo = await loadLogoBitmap(meta.logoUrl);

  const p = new Paginator();
  const rtlDoc = isRtlText(doc.title) || doc.language?.toLowerCase().startsWith("ar");

  /* ---- Page 1: brand panel + title + meta ---- */
  p.y = drawBrandPanel(p, meta, doc.title, logo) + 44;

  // Title (centered, auto-fit)
  const titleFit = fitTitle(p.ctx, doc.title, CONTENT_W - 80);
  const titleLineHeight = Math.round(titleFit.size * 1.34);
  const titleH = titleFit.lines.length * titleLineHeight;
  if (titleH + 150 > p.remaining) p.newPage();
  {
    const { ctx } = p;
    ctx.direction = rtlDoc ? "rtl" : "ltr";
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    setFont(ctx, 700, titleFit.size, doc.title);
    let yy = p.y;
    for (const line of titleFit.lines) {
      ctx.fillText(line, PAGE_W / 2, yy + titleFit.size * 0.82);
      yy += titleLineHeight;
    }
    p.y = yy + 10;

    if (doc.subtitle) {
      p.y += 6;
      p.y += drawBlockAt(ctx, doc.subtitle, p.y, {
        weight: 500,
        size: 23,
        color: MUTED,
        anchor: "center",
        maxWidth: CONTENT_W - 160,
      });
    }

    // divider diamond
    p.y += 26;
    const g = accentGradient(ctx, PAGE_W / 2 - 130, p.y, 260, 5);
    roundRect(ctx, PAGE_W / 2 - 130, p.y, 260, 5, 3);
    ctx.fillStyle = g;
    ctx.fill();
    p.y += 42;

    // meta chips
    const chips = [
      meta.processedAt,
      meta.styleLabel,
      `${doc.wordCount.toLocaleString("en-US")} ${rtlDoc ? "كلمة" : "words"}`,
    ];
    if (meta.sourceFile) chips.splice(1, 0, meta.sourceFile.slice(0, 42));
    const chipH = 44;
    const gap = 16;
    const widths = chips.map((c) => {
      setFont(ctx, 500, 19, c);
      return ctx.measureText(c).width + 44;
    });
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    if (totalW > CONTENT_W) {
      chips.length = 2; // date + style only
      widths.length = 0;
      for (const c of chips) {
        setFont(ctx, 500, 19, c);
        widths.push(ctx.measureText(c).width + 44);
      }
    }
    const total2 = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let cx = PAGE_W / 2 - total2 / 2;
    chips.forEach((c, i) => {
      drawMetaChip(ctx, c, cx + widths[i] / 2, p.y);
      cx += widths[i] + gap;
    });
    p.y += chipH + 34;
  }

  /* ---- Summary ---- */
  const summaryLabel = rtlDoc ? "الملخص التنفيذي" : "Executive Summary";
  if (doc.summary?.trim()) {
    setFont(p.ctx, 500, 24, doc.summary);
    const est =
      46 + wrapText(p.ctx, doc.summary, CONTENT_W - 66).length * LINE(24) + 52 + 30;
    if (est > p.remaining) p.newPage();
    p.y = drawSummaryCard(p, summaryLabel, doc.summary.trim(), p.y) + 30;
  }

  /* ---- Key points ---- */
  const kpLabel = rtlDoc ? "أهم النقاط" : "Key Points";
  if (doc.keyPoints?.length) {
    setFont(p.ctx, 500, 24, doc.keyPoints[0]);
    const est = doc.keyPoints.length * LINE(24) + 70;
    if (est > p.remaining) p.newPage();

    // card background for the whole list
    const startY = p.y;
    let yy = startY + 34;
    for (const kp of doc.keyPoints) {
      setFont(p.ctx, 500, 24, kp);
      const lines = wrapText(p.ctx, kp, CONTENT_W - 100);
      yy += lines.length * LINE(24) + 12;
    }
    const cardH = yy - startY + 22 - 12;
    if (cardH + 30 > p.remaining) {
      // fallback: render points as plain bullets flowing across pages
      for (const kp of doc.keyPoints) {
        setFont(p.ctx, 500, 24, kp);
        const lines = wrapText(p.ctx, kp, CONTENT_W - 44);
        if (lines.length * LINE(24) + 12 > p.remaining) p.newPage();
        p.y = drawBulletLine(p.ctx, kp, p.y, 44) + 12;
      }
      p.y += 18;
    } else {
      roundRect(p.ctx, MARGIN_X, startY, CONTENT_W, cardH, 20);
      p.ctx.fillStyle = "#ffffff";
      p.ctx.fill();
      p.ctx.strokeStyle = NEUTRAL_BORDER;
      p.ctx.lineWidth = 2;
      p.ctx.stroke();
      // label chip
      const { ctx } = p;
      setFont(ctx, 700, 20, kpLabel);
      const lw = ctx.measureText(kpLabel).width + 36;
      roundRect(ctx, rtlDoc ? PAGE_W - MARGIN_X - 24 - lw : MARGIN_X + 24, startY - 16, lw, 34, 17);
      ctx.fillStyle = accentGradient(ctx, MARGIN_X, startY, lw, 34);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.direction = rtlDoc ? "rtl" : "ltr";
      ctx.textAlign = "center";
      ctx.fillText(kpLabel, rtlDoc ? PAGE_W - MARGIN_X - 24 - lw / 2 : MARGIN_X + 24 + lw / 2, startY + 7);
      let by = startY + 44;
      for (const kp of doc.keyPoints) {
        p.y = by;
        by = drawBulletLine(ctx, kp, by, 56) + 12;
      }
      p.y = by + 26;
    }
  }

  /* ---- Sections ---- */
  const headingLabel = rtlDoc ? "التقرير المفصّل" : "Detailed Report";
  let firstSection = true;
  for (const section of doc.sections ?? []) {
    const heading = firstSection && !section.heading?.trim()
      ? headingLabel
      : section.heading || (rtlDoc ? "قسم" : "Section");
    firstSection = false;

    // keep heading with at least 2 lines
    if (p.remaining < 190) p.newPage();
    p.y += 14;
    p.y = drawSectionHeading(p, heading, p.y) + 18;

    for (const para of section.paragraphs ?? []) {
      if (!para.trim()) continue;
      setFont(p.ctx, 500, 24, para);
      const lines = wrapText(p.ctx, para, CONTENT_W);
      if (lines.length * LINE(24) > p.remaining && lines.length * LINE(24) < PAGE_H - MARGIN_TOP - MARGIN_BOTTOM) {
        // split across pages: draw what fits, rest on next page
        let idx = 0;
        while (idx < lines.length) {
          const fit = Math.max(1, Math.floor(p.remaining / LINE(24)));
          const slice = lines.slice(idx, idx + fit).join(" ");
          const drawn = drawBlockAt(p.ctx, slice, p.y, { weight: 500, size: 24, color: BODY, lineHeight: LINE(24) });
          p.y += drawn;
          idx += fit;
          if (idx < lines.length) p.newPage();
        }
      } else {
        p.y += drawBlockAt(p.ctx, para, p.y, { weight: 500, size: 24, color: BODY, lineHeight: LINE(24) });
      }
      p.y += 16;
    }

    for (const bullet of section.bullets ?? []) {
      if (!bullet.trim()) continue;
      setFont(p.ctx, 500, 24, bullet);
      const lines = wrapText(p.ctx, bullet, CONTENT_W - 44);
      if (lines.length * LINE(24) + 12 > p.remaining) p.newPage();
      p.y = drawBulletLine(p.ctx, bullet, p.y, 44) + 12;
    }
    p.y += 12;
  }

  /* ---- Conclusion ---- */
  const conclLabel = rtlDoc ? "الخلاصة" : "Conclusion";
  if (doc.conclusion?.trim()) {
    setFont(p.ctx, 500, 24, doc.conclusion);
    const est = 46 + wrapText(p.ctx, doc.conclusion, CONTENT_W - 66).length * LINE(24) + 52 + 30;
    if (est > p.remaining) p.newPage();
    // conclusion card = summary card with neutral colors
    const { ctx } = p;
    const pad = 30;
    const innerW = CONTENT_W - pad * 2 - 6;
    setFont(ctx, 500, 24, doc.conclusion);
    const lines = wrapText(ctx, doc.conclusion, innerW);
    const h = 46 + lines.length * LINE(24) + pad * 2 - 8;
    roundRect(ctx, MARGIN_X, p.y, CONTENT_W, h, 20);
    ctx.fillStyle = NEUTRAL_BG;
    ctx.fill();
    ctx.strokeStyle = NEUTRAL_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(ctx, MARGIN_X + 12, p.y + 16, 6, h - 32, 3);
    ctx.fillStyle = FAINT;
    ctx.fill();
    setFont(ctx, 700, 20, conclLabel);
    ctx.fillStyle = "#44403c";
    ctx.direction = rtlDoc ? "rtl" : "ltr";
    ctx.textAlign = rtlDoc ? "right" : "left";
    ctx.fillText(conclLabel, rtlDoc ? MARGIN_X + CONTENT_W - pad : MARGIN_X + pad + 8, p.y + pad + 14);
    ctx.direction = rtlDoc ? "rtl" : "ltr";
    ctx.textAlign = rtlDoc ? "right" : "left";
    setFont(ctx, 500, 24, doc.conclusion);
    ctx.fillStyle = BODY;
    let yy = p.y + pad + 46;
    const tx = rtlDoc ? MARGIN_X + CONTENT_W - pad - 8 : MARGIN_X + pad + 8;
    for (const line of lines) {
      ctx.fillText(line, tx, yy + 24 * 0.82);
      yy += LINE(24);
    }
    p.y += h + 20;
  }

  /* ---- Footers ---- */
  const total = p.pages.length;
  p.pages.forEach((page, i) => drawFooter(page, i + 1, total));

  /* ---- Assemble PDF ---- */
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title || "QTB Audio Report");
  pdf.setProducer("QTB DEV TOOLS — qutaibiv.com");
  pdf.setCreator("QTB Smart Audio→PDF");

  for (const page of p.pages) {
    const blob = await new Promise<Blob | null>((res) =>
      page.canvas.toBlob((b) => res(b), "image/png")
    );
    if (!blob) throw new Error("Canvas export failed");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = await pdf.embedPng(bytes);
    const pge = pdf.addPage([595.28, 841.89]);
    pge.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

/* ------------------------------------------------------------------ */
/* Plain-text export                                                   */
/* ------------------------------------------------------------------ */

export function smartDocToPlainText(doc: SmartAudioDoc, meta: AudioPdfMeta): string {
  const out: string[] = [];
  out.push(doc.title);
  if (doc.subtitle) out.push(doc.subtitle);
  out.push("");
  out.push(`${meta.processedAt}${meta.sourceFile ? ` — ${meta.sourceFile}` : ""}`);
  out.push("");
  if (doc.summary) {
    out.push("=== " + doc.summary);
    out.push("");
  }
  if (doc.keyPoints?.length) {
    for (const kp of doc.keyPoints) out.push(`• ${kp}`);
    out.push("");
  }
  for (const s of doc.sections ?? []) {
    if (s.heading) out.push(`## ${s.heading}`);
    for (const p of s.paragraphs) out.push(p);
    for (const b of s.bullets) out.push(`• ${b}`);
    out.push("");
  }
  if (doc.conclusion) {
    out.push("=== " + doc.conclusion);
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Download helper                                                     */
/* ------------------------------------------------------------------ */

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function sanitizeFileBase(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 70)
      .replace(/^[-.]+|[-.]+$/g, "") || "audio-report"
  );
}
