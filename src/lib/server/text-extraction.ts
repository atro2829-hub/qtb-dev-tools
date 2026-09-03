import { PDFParse } from 'pdf-parse'
import { unzipSync } from 'fflate'

export type SourceFormat = 'pdf' | 'docx' | 'txt' | 'unknown'

/** Detect a source document format from a filename extension. */
export function detectFormat(fileName: string): SourceFormat {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'txt' || ext === 'text' || ext === 'md') return 'txt'
  return 'unknown'
}

/** Extract raw text from a pdf / docx / txt buffer. Throws on unsupported formats. */
export async function extractText(buffer: Buffer, format: SourceFormat): Promise<string> {
  switch (format) {
    case 'pdf': {
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        return result.text
      } finally {
        await parser.destroy()
      }
    }
    case 'docx': {
      return extractDocxText(buffer)
    }
    case 'txt':
      return buffer.toString('utf8')
    default:
      throw new Error('Unsupported source format')
  }
}

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&__AMP__#x000D;': '',
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

/**
 * Extract raw text from a .docx buffer without heavy libraries.
 * A docx is a ZIP archive: read `word/document.xml`, walk `<w:p>` paragraphs
 * and collect `<w:t>` runs (tabs/line-breaks included). Equivalent to
 * mammoth's extractRawText for plain documents, at ~30KB instead of ~2.5MB.
 */
export function extractDocxText(buffer: Buffer): string {
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (file) => file.name === 'word/document.xml',
  })
  const xmlBytes = files['word/document.xml']
  if (!xmlBytes) throw new Error('Invalid docx file: word/document.xml not found')
  const xml = new TextDecoder('utf-8').decode(xmlBytes)

  const out: string[] = []
  const paragraphRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p\/>/g
  const runRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/?>|<w:br\s*\/?>|<w:cr\s*\/?>/g
  let paraMatch: RegExpExecArray | null
  while ((paraMatch = paragraphRe.exec(xml))) {
    if (paraMatch[0] === '<w:p/>') {
      out.push('')
      continue
    }
    const segment = paraMatch[1] ?? ''
    let line = ''
    let runMatch: RegExpExecArray | null
    while ((runMatch = runRe.exec(segment))) {
      const token = runMatch[0]
      if (token.startsWith('<w:tab')) line += '\t'
      else if (token.startsWith('<w:br') || token.startsWith('<w:cr')) line += '\n'
      else line += decodeXmlEntities(runMatch[1] ?? '')
    }
    out.push(line)
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
}

/**
 * Lightly strips markdown artifacts left over in raw text (heading hashes,
 * bold/italic markers, inline code ticks) so generated PDFs look clean.
 */
export function stripMarkdownArtifacts(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let l = line.replace(/^\s{0,3}#{1,6}\s+/, '')
      l = l.replace(/\*\*([^*]*)\*\*/g, '$1')
      l = l.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1$2')
      l = l.replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, '$1$2')
      l = l.replace(/`([^`]*)`/g, '$1')
      return l
    })
    .join('\n')
}
