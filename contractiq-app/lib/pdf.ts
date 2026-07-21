import pdf from 'pdf-parse'

export interface ExtractedText {
  text: string
  pageCount: number
}

export async function extractTextWithPageMarkers(
  buffer: Buffer
): Promise<ExtractedText> {
  const pages: string[] = []

  const data = await pdf(buffer, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((content: any) => {
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ')
          .trim()
        pages.push(pageText)
        return pageText
      })
    },
  })

  const pageCount = pages.length || data.numpages

  // If pagerender didn't fire (some pdf-parse versions), fall back to splitting
  // the raw text by form-feed characters or using the full text as page 1
  if (pages.length === 0) {
    const text = `[PAGE 1]\n${data.text}`
    return { text, pageCount: data.numpages }
  }

  const text = pages
    .map((pageText, i) => `[PAGE ${i + 1}]\n${pageText}`)
    .join('\n\n')

  return { text, pageCount }
}
