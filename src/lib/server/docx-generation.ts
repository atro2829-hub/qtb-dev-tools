import { Document, Packer, Paragraph, TextRun } from 'docx'

/** Build a .docx file with one paragraph per line of the given text. */
export async function textToDocxBuffer(rawText: string, title = 'QTB DEV TOOLS Document'): Promise<Buffer> {
  const lines = rawText.split(/\r?\n/)
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, font: 'Calibri', size: 22 })], // 11pt
      })
  )

  const doc = new Document({
    creator: 'QTB DEV TOOLS',
    title,
    sections: [{ properties: {}, children: paragraphs }],
  })

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer)
}
