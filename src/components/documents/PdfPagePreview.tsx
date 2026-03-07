import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cn } from '@/lib/utils';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPagePreviewProps {
  documentUrl: string;
  page: number;
  className?: string;
}

const CANVAS_BASE_WIDTH = 595;

export default function PdfPagePreview({ documentUrl, page, className }: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderPdfPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const pdf = await getDocument({ url: documentUrl }).promise;
        const safePageNumber = Math.min(Math.max(page, 1), pdf.numPages);
        const pdfPage = await pdf.getPage(safePageNumber);

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const renderScale = CANVAS_BASE_WIDTH / baseViewport.width;
        const viewport = pdfPage.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível obter o contexto de renderização do PDF.');

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao renderizar PDF no editor:', err);
          setError('Falha ao renderizar o PDF no editor.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    renderPdfPage();

    return () => {
      cancelled = true;
    };
  }, [documentUrl, page]);

  return (
    <div className={cn('relative h-full w-full bg-background', className)}>
      <canvas ref={canvasRef} className="h-full w-full pointer-events-none" aria-label={`Prévia do PDF - página ${page}`} />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <span className="text-xs text-muted-foreground">Carregando página do PDF...</span>
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
