import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Set up the PDF.js worker using public unpkg URL for client-side processing
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Extracts raw text from a provided PDF file using pdf.js.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    let lastY;
    let pageText = '';
    
    for (const item of textContent.items) {
      const textItem = item as TextItem;
      // Heuristic for new line: if Y coordinate changes significantly
      if (lastY !== undefined && lastY !== textItem.transform[5]) {
        pageText += '\n';
      }
      pageText += textItem.str;
      lastY = textItem.transform[5];
    }
    
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
}

/**
 * Generates and downloads a new PDF containing the edited text.
 */
export function generateEditedPDF(text: string, originalFilename: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // Setting font size to a readable default
  doc.setFontSize(12);
  
  const pageHeight = doc.internal.pageSize.height;
  const marginX = 20;
  const marginY = 20;
  // Calculate max width for text (A4 width is 210mm)
  const maxWidth = 210 - marginX * 2;
  
  // splitTextToSize wraps text to fit within the width
  const splitText = doc.splitTextToSize(text, maxWidth);
  
  let currentY = marginY;
  const lineHeight = 7; // Approx line height in mm for size 12
  
  for (let i = 0; i < splitText.length; i++) {
    // If the next line goes out of bounds, add a new page
    if (currentY > pageHeight - marginY) {
      doc.addPage();
      currentY = marginY;
    }
    doc.text(splitText[i], marginX, currentY);
    currentY += lineHeight;
  }
  
  const finalFilename = originalFilename.replace('.pdf', '') + '-editado.pdf';
  doc.save(finalFilename);
}
