import { PDFDocument, StandardFonts } from 'pdf-lib'

const MARGIN = 50
const FONT_SIZE = 11
const LINE_HEIGHT = 15
const MAX_CHARS_PER_LINE = 95

/**
 * Sanitizes text so it can be encoded with the WinAnsi (Windows-1252) standard
 * font used by pdf-lib: common unicode punctuation is normalized, anything
 * outside the encodable range becomes '?'.
 */
export function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2012]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u2022\u25CF]/g, '-')
    .replace(/\t/g, '    ')
    .replace(/[^\n\r\x20-\x7E\u00A1-\u00FF]/g, '?')
}

function wrapLine(line: string): string[] {
  if (line.length <= MAX_CHARS_PER_LINE) return [line]
  const out: string[] = []
  let current = ''
  for (const word of line.split(' ')) {
    if (word.length > MAX_CHARS_PER_LINE) {
      // hard-break very long "words"
      if (current) {
        out.push(current)
        current = ''
      }
      for (let i = 0; i < word.length; i += MAX_CHARS_PER_LINE) {
        out.push(word.slice(i, i + MAX_CHARS_PER_LINE))
      }
      continue
    }
    if ((current + (current ? ' ' : '') + word).length > MAX_CHARS_PER_LINE) {
      out.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) out.push(current)
  return out
}

/** Build a simple multi-page A4 PDF document from plain text. */
export async function textToPdfBuffer(rawText: string): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('QTB DEV TOOLS — Converted Document')
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const sanitized = sanitizeWinAnsi(rawText)
  const lines = sanitized.split(/\r?\n/)

  let page = pdf.addPage([595.28, 841.89]) // A4
  let y = page.getHeight() - MARGIN

  for (const rawLine of lines) {
    const wrapped = wrapLine(rawLine)
    for (const line of wrapped) {
      if (y < MARGIN) {
        page = pdf.addPage([595.28, 841.89])
        y = page.getHeight() - MARGIN
      }
      page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font })
      y -= LINE_HEIGHT
    }
  }

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}
