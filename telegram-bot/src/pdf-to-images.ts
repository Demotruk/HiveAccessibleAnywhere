/**
 * Convert PDF pages to PNG image buffers using MuPDF (WASM).
 *
 * Used to send gift cards as photos instead of PDF files,
 * which feel less intimidating to Telegram users.
 */

import * as mupdf from 'mupdf';
import { readFileSync } from 'node:fs';

/**
 * Convert each page of a PDF file to a PNG buffer.
 * Returns an array of PNG buffers (one per page).
 */
export function pdfToImages(pdfPath: string, dpi: number = 200): Buffer[] {
  const pdfData = readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(pdfData, 'application/pdf');
  const images: Buffer[] = [];

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const scaleFactor = dpi / 72; // PDF default is 72 DPI
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scaleFactor, scaleFactor),
      mupdf.ColorSpace.DeviceRGB,
      false, // no alpha
      true,  // annots
    );
    const pngData = pixmap.asPNG();
    images.push(Buffer.from(pngData));
  }

  return images;
}
