/**
 * PDF Text Extraction Service
 *
 * Extracts text from PDF files for summarization.
 */

// pdf-parse doesn't have proper ESM exports, using dynamic import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
}

/**
 * Extract text content from a PDF file URL
 * @param pdfUrl - URL to the PDF file (e.g., Firebase Storage URL)
 * @returns Extracted text and page count
 */
export async function extractTextFromPdf(pdfUrl: string): Promise<PdfExtractionResult> {
  // Download the PDF file
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Parse the PDF
  const data = await pdf(buffer);

  return {
    text: data.text.trim(),
    pageCount: data.numpages,
    metadata: {
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      creator: data.info?.Creator,
    },
  };
}

/**
 * Extract text from a PDF buffer directly
 * @param buffer - PDF file as Buffer
 * @returns Extracted text and page count
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
  const data = await pdf(buffer);

  return {
    text: data.text.trim(),
    pageCount: data.numpages,
    metadata: {
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      creator: data.info?.Creator,
    },
  };
}
