import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

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
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    }
    case 'txt':
      return buffer.toString('utf8')
    default:
      throw new Error('Unsupported source format')
  }
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
