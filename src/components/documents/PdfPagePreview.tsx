import { useEffect, useRef, useState, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cn } from '@/lib/utils';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ── Global PDF document cache ──
const pdfCache = new Map<string, { doc: PDFDocumentProxy; lastUsed: number }>();
const MAX_CACHE = 8;

async function getCachedPdf(url: string): Promise<PDFDocumentProxy> {
  const cached = pdfCache.get(url);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.doc;
  }

  const doc = await getDocument({ url, cMapUrl: undefined, disableAutoFetch: false, disableStream: false }).promise;

  // Evict oldest if cache full
  if (pdfCache.size >= MAX_CACHE) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of pdfCache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      pdfCache.get(oldestKey)?.doc.destroy();
      pdfCache.delete(oldestKey);
    }
  }

  pdfCache.set(url, { doc, lastUsed: Date.now() });
  return doc;
}

interface PdfPagePreviewProps {
  documentUrl: string;
  page: number;
  className?: string;
}

const CANVAS_BASE_WIDTH = 595;

export default function PdfPagePreview({ documentUrl, page, className }: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<ReturnType<PDFDocumentProxy['getPage']> extends Promise<infer P> ? P extends { render: (...args: any[]) => infer R } ? R : null : null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const renderPage = useCallback(async (cancelled: { current: boolean }) => {
    setIsLoading(true);
    setError(null);

    try {
      const pdf = await getCachedPdf(documentUrl);
      if (cancelled.current) return;

      const safePageNumber = Math.min(Math.max(page, 1), pdf.numPages);
      const pdfPage = await pdf.getPage(safePageNumber);
      if (cancelled.current) return;

      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const renderScale = CANVAS_BASE_WIDTH / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale: renderScale });

      const canvas = canvasRef.current;
      if (!canvas || cancelled.current) return;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Erro no contexto do canvas.');

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const renderTask = pdfPage.render({ canvasContext: context, viewport });
      await renderTask.promise;
    } catch (err: any) {
      if (!cancelled.current && err?.name !== 'RenderingCancelledException') {
        console.error('Erro ao renderizar PDF:', err);
        setError('Falha ao renderizar o PDF.');
      }
    } finally {
      if (!cancelled.current) setIsLoading(false);
    }
  }, [documentUrl, page]);

  useEffect(() => {
    const cancelled = { current: false };
    renderPage(cancelled);
    return () => { cancelled.current = true; };
  }, [renderPage]);

  return (
    <div className={cn('relative h-full w-full bg-background', className)}>
      <canvas ref={canvasRef} className="h-full w-full pointer-events-none" aria-label={`Prévia do PDF - página ${page}`} />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Carregando...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-muted/20">
          <div>
            <p className="text-sm font-semibold text-foreground">{error}</p>
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex mt-3 text-xs px-2.5 py-1.5 rounded border border-border text-foreground bg-card"
            >
              Abrir arquivo em nova aba
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
