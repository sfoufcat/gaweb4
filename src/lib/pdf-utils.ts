/**
 * PDF Text Extraction Utility
 *
 * Client-side PDF text extraction using Mozilla's PDF.js library.
 * Extracts text content from PDFs for use as AI context.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure the worker path - must be available at this URL
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

// Maximum characters to extract (to control API costs)
const MAX_EXTRACTED_CHARS = 8000;

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  charCount: number;
  truncated: boolean;
  error?: string;
}

/**
 * Extract text content from a PDF file
 * @param file - The PDF file to extract text from
 * @returns Extraction result with text content and metadata
 */
export async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  // Validate file type
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return {
      success: false,
      text: '',
      pageCount: 0,
      charCount: 0,
      truncated: false,
      error: 'Invalid file type. Please upload a PDF file.',
    };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      text: '',
      pageCount: 0,
      charCount: 0,
      truncated: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Extract text from items, filtering for actual text items
      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ');

      fullText += pageText + '\n\n';

      // Early exit if we've already exceeded the max
      if (fullText.length > MAX_EXTRACTED_CHARS * 1.5) {
        break;
      }
    }

    // Clean up the text
    fullText = fullText
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n')  // Normalize paragraph breaks
      .trim();

    // Truncate if needed
    const truncated = fullText.length > MAX_EXTRACTED_CHARS;
    const finalText = truncated
      ? fullText.slice(0, MAX_EXTRACTED_CHARS) + '...[truncated]'
      : fullText;

    return {
      success: true,
      text: finalText,
      pageCount,
      charCount: finalText.length,
      truncated,
    };
  } catch (error) {
    console.error('[PDF Extract] Error:', error);
    return {
      success: false,
      text: '',
      pageCount: 0,
      charCount: 0,
      truncated: false,
      error: error instanceof Error
        ? `Failed to extract text: ${error.message}`
        : 'Failed to extract text from PDF.',
    };
  }
}

/**
 * Get a preview of the PDF text (first N characters)
 */
export function getPdfPreview(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
