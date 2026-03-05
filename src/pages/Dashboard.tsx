import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockStats, mockDocuments, mockFolders } from '@/data/mockData';
import { FileText, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, TrendingUp, Timer, XCircle, FileEdit } from 'lucide-react';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const statCards = [
  { label: 'Total de documentos', value: mockStats.totalDocuments, icon: FileText, color: 'text-info', bgColor: 'bg-info/10' },
  { label: 'Aguardando assinatura', value: mockStats.pendingSignatures, icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
  { label: 'Assinados', value: mockStats.signedDocuments, icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
  { label: 'Expirados', value: mockStats.expiredDocuments, icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  { label: 'Cancelados', value: mockStats.cancelledDocuments, icon: XCircle, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  { label: 'Rascunhos', value: mockStats.drafts, icon: FileEdit, color: 'text-muted-foreground', bgColor: 'bg-muted' },
];

export default function Dashboard() {
  const recentDocs = mockDocuments.slice(0, 5);

  return (
    <>
      <AppHeader title="Início" subtitle="Visão geral da sua conta" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat, i) => (
            <Card key={stat.label} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* KPIs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de conclusão</p>
                  <p className="text-3xl font-bold text-foreground">{mockStats.completionRate}%</p>
                </div>
                <div className="p-3 rounded-xl bg-success/10">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
              <Progress value={mockStats.completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">Documentos completados com sucesso</p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '50ms' }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tempo médio de assinatura</p>
                  <p className="text-3xl font-bold text-foreground">{mockStats.avgSignTime}</p>
                </div>
                <div className="p-3 rounded-xl bg-info/10">
                  <Timer className="w-5 h-5 text-info" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Desde o envio até todas assinaturas coletadas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="lg:col-span-2 animate-fade-in">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documentos por mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockStats.monthlyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="sent" name="Enviados" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="signed" name="Assinados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Folders */}
          <Card className="animate-fade-in">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pastas</CardTitle>
                <Link to="/folders" className="text-xs text-primary hover:underline">Ver todas</Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockFolders.map((folder) => (
                <Link
                  key={folder.id}
                  to={`/folders?folder=${folder.name}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: folder.color }} />
                    <span className="text-sm text-foreground">{folder.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{folder.count}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
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
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      {doc.signers.length > 0 && ` · ${doc.signers.filter(s => s.status === 'signed').length}/${doc.signers.length} assinaturas`}
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
