/**
 * Client-side PDF text extraction using pdf.js (browser build).
 *
 * The Cloudflare Workers runtime cannot run pdfjs server-side (no worker
 * support, ~10ms CPU budget), so PDF text is extracted IN THE BROWSER —
 * exactly like image-to-image conversion — and the extracted text is sent
 * to the API. The pdf.js worker is served from /pdfjs/pdf.worker.min.mjs
 * (static asset, version-locked to the installed pdfjs-dist).
 */

let workerConfigured = false;

/** Read a PDF file and return its full text, page by page. */
export async function extractPdfText(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    workerConfigured = true;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      if (item.hasEOL) text += "\n";
      else if (item.str === "") text += " ";
    }
    pages.push(text.trim());
    page.cleanup();
    onProgress?.(Math.round((n / doc.numPages) * 100));
  }
  await doc.destroy();

  return pages
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
