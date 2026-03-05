import { DocumentStatus } from '@/types/document';
import { cn } from '@/lib/utils';

const statusConfig: Record<DocumentStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  pending: { label: 'Aguardando', className: 'bg-warning/15 text-warning', dot: 'bg-warning' },
  signed: { label: 'Assinado', className: 'bg-success/15 text-success', dot: 'bg-success' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive', dot: 'bg-destructive' },
  expired: { label: 'Expirado', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export function StatusBadge({ status, showDot = true }: { status: DocumentStatus; showDot?: boolean }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />}
      {config.label}
    </span>
  );
}
