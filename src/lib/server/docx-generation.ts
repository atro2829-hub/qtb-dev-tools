import { strToU8, zipSync } from 'fflate'

/**
 * Minimal, dependency-light .docx writer (OOXML + fflate zip).
 *
 * Replaces the `docx` npm package (~3.8MB installed) to keep the Cloudflare
 * Workers bundle under the 3MB free-plan size limit. Produces exactly the same
 * output shape as before: one paragraph per line, Calibri 11pt.
 */

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c])
}

function paragraph(line: string): string {
  if (line.length === 0) return '<w:p/>'
  const run =
    `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>` +
    `<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
    `<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${run}</w:p>`
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
  `</Types>`

const RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`

/** Build a .docx file with one paragraph per line of the given text. */
export async function textToDocxBuffer(rawText: string, title = 'QTB DEV TOOLS Document'): Promise<Buffer> {
  const lines = rawText.split(/\r?\n/)
  const body = lines.map(paragraph).join('')
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${body}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`

  const zip = zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      '_rels/.rels': strToU8(RELS),
      'word/document.xml': strToU8(documentXml),
      'docProps/core.xml': strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
          `xmlns:dc="http://purl.org/dc/elements/1.1/">` +
          `<dc:creator>QTB DEV TOOLS</dc:creator><dc:title>${esc(title)}</dc:title></cp:coreProperties>`
      ),
    },
    { level: 6, mtime: new Date() }
  )

  return Buffer.from(zip)
}
