import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cn } from '@/lib/utils';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ── Simple PDF document cache ──
const pdfCache = new Map<string, PDFDocumentProxy>();

interface PdfPagePreviewProps {
  documentUrl: string;
  page: number;
  className?: string;
}

export default function PdfPagePreview({ documentUrl, page, className }: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get or cache the PDF document
        let pdf = pdfCache.get(documentUrl);
        if (!pdf) {
          console.log('[PDF] Loading document:', documentUrl.slice(-40));
          pdf = await getDocument(documentUrl).promise;
          pdfCache.set(documentUrl, pdf);
          console.log('[PDF] Document loaded, pages:', pdf.numPages);
        }

        if (cancelled) return;

        const safePageNumber = Math.min(Math.max(page, 1), pdf.numPages);
        const pdfPage = await pdf.getPage(safePageNumber);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) {
          console.warn('[PDF] Canvas ref is null');
          return;
        }

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Cannot get 2d context');
        }

        // Render at fixed 595 width scale
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = 595 / baseViewport.width;
        const viewport = pdfPage.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;

        if (!cancelled) {
          console.log('[PDF] Page', safePageNumber, 'rendered successfully');
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[PDF] Render error:', err);
          setError('Falha ao renderizar o PDF.');
          setIsLoading(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [documentUrl, page]);

  return (
    <div className={cn('relative h-full w-full bg-white', className)}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full object-contain pointer-events-none"
        style={{ display: isLoading && !error ? 'none' : 'block' }}
        aria-label={`Prévia do PDF - página ${page}`}
      />

      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando PDF...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-foreground">{error}</p>
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex mt-3 text-xs px-2.5 py-1.5 rounded border border-border text-foreground bg-card hover:bg-muted transition-colors"
            >
              Abrir arquivo em nova aba
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
