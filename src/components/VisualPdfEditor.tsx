import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Configure pdfjs worker to use the unpkg CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface VisualPdfEditorProps {
  file: File;
  onSave: (buffer: Uint8Array, filename: string) => void;
}

interface EditRecord {
  pageIndex: number;
  id: string; // The text item index or unique id
  originalText: string;
  newText: string;
  transform: number[]; // The original pdf transform matrix
  width: number;
  height: number;
  defaultFont?: boolean;
}

export default function VisualPdfEditor({ file, onSave }: VisualPdfEditorProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  
  // Track all user edits
  const [edits, setEdits] = useState<Record<string, EditRecord>>({});

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  // Intercept the text layer rendering to make it editable
  const customTextRenderer = (textItem: any) => {
    // In some react-pdf versions textItem might be passed as an object { str, itemIndex }
    const textStr = textItem.str || '';
    const index = textItem.itemIndex !== undefined ? textItem.itemIndex : Math.random().toString();
    const itemId = `${pageNumber}-${index}`;
    
    // Check if we have an edit for this item
    const currentText = edits[itemId]?.newText ?? textStr;
    const isEdited = !!edits[itemId];
    const isEditing = activeEditId === itemId;

    if (isEditing) {
      return (
        <input
          autoFocus
          className="editable-text-input"
          defaultValue={currentText}
          onBlur={(e) => {
            const newText = e.target.value;
            if (newText !== textStr) {
               setEdits(prev => ({
                 ...prev,
                 [itemId]: {
                   pageIndex: pageNumber - 1,
                   id: itemId,
                   originalText: textStr,
                   newText,
                   transform: textItem.transform || [1, 0, 0, 1, 0, 0],
                   width: textItem.width || 0,
                   height: textItem.height || 0
                 }
               }));
            } else {
               if (edits[itemId]) {
                   const newEdits = {...edits};
                   delete newEdits[itemId];
                   setEdits(newEdits);
               }
            }
            setActiveEditId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <span
        className={`editable-text-item ${isEdited ? 'edited' : ''}`}
        title="Haz clic para editar"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault(); // prevents standard text selection so we can edit
          setActiveEditId(itemId);
        }}
      >
        {currentText}
      </span>
    );
  };

  const handleExport = async () => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      // Apply all edits
      Object.values(edits).forEach((edit: EditRecord) => {
         const page = pages[edit.pageIndex];
         if (!page) return;

         // The transform matrix format from PDF.js: [scaleX, skewX, skewY, scaleY, tx, ty]
         // Actually, pdfjs-dist gives [scaleX, skewY, skewX, scaleY, tx, ty]
         const [scaleX, skewY, skewX, scaleY, tx, ty] = edit.transform;
         
         const fontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
         
         // 1. "Redact" the original text by drawing a white rectangle
         // This is a naive approach; background could be non-white.
         // We use the approximate width given by pdfjs and size of the font.
         page.drawRectangle({
            x: tx,
            y: ty,
            width: edit.width,
            height: fontSize * 1.2, // Approximate line height
            color: rgb(1, 1, 1),
         });

         // 2. Draw the new text
         page.drawText(edit.newText, {
           x: tx,
           y: ty, // PDF coordinates are usually from bottom-left
           size: fontSize,
           font: helveticaFont,
           color: rgb(0, 0, 0), 
         });
      });

      const pdfBytes = await pdfDoc.save();
      onSave(pdfBytes, file.name);

    } catch (err) {
      console.error(err);
      alert('Error saving PDF.');
    }
  };

  return (
    <div className="flex flex-col items-center w-full relative">
      {/* Editor Controls */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 p-4 mb-4 bg-[#1a1d23]/90 backdrop-blur border border-white/10 shadow-lg rounded-xl w-full">
         <div className="flex items-center gap-4 text-sm">
            <button 
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="text-white disabled:opacity-50 hover:bg-white/10 px-3 py-1.5 rounded transition-colors"
            >
              Anterior
            </button>
            <span className="text-slate-300 font-medium">
              Página {pageNumber} de {numPages || '-'}
            </span>
            <button 
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="text-white disabled:opacity-50 hover:bg-white/10 px-3 py-1.5 rounded transition-colors"
            >
              Siguiente
            </button>
         </div>

         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="text-white hover:text-blue-400">-</button>
                <span className="text-white text-xs font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="text-white hover:text-blue-400">+</button>
             </div>
             
             <button
              onClick={handleExport}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-2"
             >
                Exportar Cambios
             </button>
         </div>
      </div>

      {/* Document Canvas area */}
      <div className="bg-[#1f232b] p-8 rounded-xl shadow-2xl relative overflow-auto max-w-full flex-grow flex justify-center items-start min-h-[600px] border border-white/5">
         {fileUrl && (
            <Document
               file={fileUrl}
               onLoadSuccess={onDocumentLoadSuccess}
               loading={
                 <div className="flex flex-col items-center justify-center p-20">
                   <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                   <p className="text-slate-400">Renderizando PDF...</p>
                 </div>
               }
            >
               <style>
                 {`
                   .react-pdf__Page__textContent.textLayer {
                     z-index: 50 !important;
                     opacity: 1 !important;
                   }
                   .react-pdf__Page__textContent.textLayer > span {
                     pointer-events: auto !important;
                     border-radius: 2px;
                     color: transparent;
                     cursor: text;
                   }
                   .react-pdf__Page__textContent.textLayer > span:hover {
                     background-color: rgba(59, 130, 246, 0.1) !important;
                     outline: 1px dotted rgba(59, 130, 246, 0.8) !important;
                   }
                   
                   .editable-text-item {
                     color: transparent; /* Transparent by default to show canvas underneath */
                     display: inline-block;
                     width: 100%;
                     height: 100%;
                   }

                   .react-pdf__Page__textContent.textLayer > span > .editable-text-item.edited {
                     color: #1a1a1a !important;
                     background-color: white !important;
                     padding: 0 2px;
                     margin-left: -2px; /* Offset for padding */
                     border-radius: 2px;
                     box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
                   }

                   .editable-text-input {
                     position: absolute;
                     top: 0;
                     left: 0;
                     width: max-content;
                     min-width: 100%;
                     height: 120%;
                     font-size: inherit;
                     font-family: sans-serif;
                     color: #1a1a1a;
                     background-color: white;
                     border: 1px solid #3b82f6;
                     border-radius: 2px;
                     outline: none;
                     padding: 0 2px;
                     margin: -1px 0 0 -3px; /* Offset for border and padding */
                     z-index: 100;
                     box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                   }
                 `}
               </style>
               <Page 
                 pageNumber={pageNumber} 
                 scale={scale} 
                 renderAnnotationLayer={false} 
                 renderTextLayer={true}
                 customTextRenderer={customTextRenderer}
                 className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] !bg-white"
               />
            </Document>
         )}
      </div>
    </div>
  );
}
