/**
 * PDF Text Extraction Service
 *
 * Extracts text from PDF files for summarization.
 * Uses pdfjs-dist for pure JavaScript PDF parsing without canvas dependencies.
 */

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Disable worker for server-side usage
GlobalWorkerOptions.workerSrc = '';

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
  return extractTextFromPdfBuffer(Buffer.from(arrayBuffer));
}

/**
 * Extract text from a PDF buffer directly
 * @param buffer - PDF file as Buffer
 * @returns Extracted text and page count
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
  // Convert Buffer to Uint8Array for pdfjs
  const uint8Array = new Uint8Array(buffer);

  // Load the PDF document
  const loadingTask = getDocument({
    data: uint8Array,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  // Extract text from all pages
  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map((item) => item.str)
      .join(' ');

    textParts.push(pageText);
  }

  // Get metadata
  const metadata = await pdf.getMetadata().catch(() => null);
  const info = metadata?.info as Record<string, string> | undefined;

  return {
    text: textParts.join('\n\n').trim(),
    pageCount,
    metadata: info
      ? {
          title: info.Title,
          author: info.Author,
          subject: info.Subject,
          creator: info.Creator,
        }
      : undefined,
  };
}
