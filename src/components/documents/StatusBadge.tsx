import * as React from 'react';
import { DocumentStatus } from '@/types/document';
import { cn } from '@/lib/utils';

const statusConfig: Record<DocumentStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground border-muted-foreground/20', dot: 'bg-muted-foreground' },
  pending: { label: 'Aguardando', className: 'bg-warning/15 text-warning border-warning/30', dot: 'bg-warning' },
  signed: { label: 'Assinado', className: 'bg-success/15 text-success border-success/30', dot: 'bg-success' },
  'FINALIZADO_COM_SUCESSO': { label: 'Finalizado', className: 'bg-primary/15 text-primary border-primary/30', dot: 'bg-primary' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive border-destructive/30', dot: 'bg-destructive' },
  expired: { label: 'Expirado', className: 'bg-muted text-muted-foreground border-muted-foreground/20', dot: 'bg-muted-foreground' },
};

export const StatusBadge = React.forwardRef<
  HTMLSpanElement,
  { status: DocumentStatus; showDot?: boolean }
>(({ status, showDot = true }, ref) => {
  const config = statusConfig[status];

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
        config.className
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />}
      {config.label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';
