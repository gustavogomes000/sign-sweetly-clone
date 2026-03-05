import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { mockStats, mockDocuments } from '@/data/mockData';
import { FileText, Clock, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statCards = [
  { label: 'Total de documentos', value: mockStats.totalDocuments, icon: FileText, color: 'text-info' },
  { label: 'Aguardando assinatura', value: mockStats.pendingSignatures, icon: Clock, color: 'text-warning' },
  { label: 'Documentos assinados', value: mockStats.signedDocuments, icon: CheckCircle2, color: 'text-success' },
  { label: 'Documentos expirados', value: mockStats.expiredDocuments, icon: AlertTriangle, color: 'text-destructive' },
];

export default function Dashboard() {
  const recentDocs = mockDocuments.slice(0, 5);

  return (
    <>
      <AppHeader title="Início" subtitle="Visão geral da sua conta" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Documents */}
        <Card className="animate-fade-in">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Documentos recentes</h2>
            <Link to="/documents" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentDocs.map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      {doc.signers.length > 0 && ` · ${doc.signers.length} signatário(s)`}
                    </p>
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
