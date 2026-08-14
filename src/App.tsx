/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { UploadCloud, FileText, Download, Target, FileWarning, RefreshCcw } from 'lucide-react';
import VisualPdfEditor from './components/VisualPdfEditor';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Por favor, sube un archivo .pdf válido.');
      return;
    }
    
    setError(null);
    setFile(selectedFile);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setFile(null);
    setError(null);
  };

  const handleSaveDocument = (buffer: Uint8Array, filename: string) => {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace('.pdf', '') + '-editado.pdf';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 100);
  };

  return (
    <div className="h-screen bg-[#0a0c10] text-slate-300 font-sans flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 lg:px-8 h-16 border-b border-white/5 bg-[#0f1115]/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            PDF<span className="text-blue-500 font-bold italic">Flow</span> <span className="ml-2 text-xs font-normal text-slate-500 uppercase tracking-widest hidden sm:inline">Visual Editor</span>
          </h1>
        </div>
        {file && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:bg-white/5 flex items-center space-x-2 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Subir otro PDF</span>
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-full flex flex-col overflow-hidden bg-[#050608]">
        <div className="w-full h-full flex flex-col">
          {!file && (
            <div className="flex-1 flex flex-col items-center justify-center fade-in p-8">
              <div className="text-center max-w-lg mb-8">
                <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Edición Visual de PDFs</h2>
                <p className="text-slate-400">
                  Sube tu archivo .pdf. El sistema renderizará el documento original y te permitirá hacer doble clic sobre los textos para editarlos directamente sobre la hoja (Similar a Acrobat).
                </p>
              </div>
              
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={triggerFileInput}
                className={`w-full max-w-xl mx-auto rounded-xl border border-dashed p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 block ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10 shadow-inner'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className={`p-4 rounded-full mb-4 ${isDragging ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
                  {isDragging ? <Target className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  {isDragging ? 'Suelta el archivo aquí' : 'Haz clic o arrastra tu PDF aquí'}
                </h3>
                <p className="text-sm text-slate-500 text-center">
                  Soporta archivos .pdf hasta 50MB
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  className="hidden"
                />
              </div>
              
              {error && (
                <div className="mt-6 flex items-center space-x-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-lg border border-red-500/20 animate-in fade-in slide-in-from-bottom-2">
                  <FileWarning className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}
            </div>
          )}

          {file && (
             <div className="flex-1 w-full h-full flex flex-col overflow-y-auto animate-in fade-in relative p-6">
                 <VisualPdfEditor file={file} onSave={handleSaveDocument} />
             </div>
          )}
        </div>
      </main>
    </div>
  );
}
