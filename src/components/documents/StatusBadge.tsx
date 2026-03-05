import { DocumentStatus } from '@/types/document';
import { cn } from '@/lib/utils';

const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Aguardando', className: 'bg-warning/15 text-warning' },
  signed: { label: 'Assinado', className: 'bg-success/15 text-success' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive' },
  expired: { label: 'Expirado', className: 'bg-muted text-muted-foreground' },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
