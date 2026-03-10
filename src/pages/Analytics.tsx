import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useDashboardStats, useDocuments } from '@/hooks/useDocuments';
import { Loader2 } from 'lucide-react';

export default function Analytics() {
  const [period, setPeriod] = useState('7d');
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: documents = [], isLoading: docsLoading } = useDocuments();

  const isLoading = statsLoading || docsLoading;

  // Build pie data from real stats
  const pieData = [
    { name: 'Assinados', value: stats?.signedDocuments ?? 0, color: 'hsl(var(--success))' },
    { name: 'Aguardando', value: stats?.pendingSignatures ?? 0, color: 'hsl(var(--warning))' },
    { name: 'Expirados', value: stats?.expiredDocuments ?? 0, color: 'hsl(var(--muted-foreground))' },
    { name: 'Cancelados', value: stats?.cancelledDocuments ?? 0, color: 'hsl(var(--destructive))' },
    { name: 'Rascunhos', value: stats?.drafts ?? 0, color: 'hsl(var(--border))' },
  ].filter(d => d.value > 0);

  // Build time data from real documents (avg sign time per day of week)
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayBuckets = Array.from({ length: 7 }, () => ({ count: 0, totalHours: 0 }));
  
  documents.forEach(doc => {
    if (doc.status === 'signed' && doc.signers.length > 0) {
      const createdDate = new Date(doc.created_at);
      const dayOfWeek = createdDate.getDay();
      const lastSigned = doc.signers
        .filter(s => s.signed_at)
        .map(s => new Date(s.signed_at!).getTime())
        .sort((a, b) => b - a)[0];
      if (lastSigned) {
        const hours = (lastSigned - createdDate.getTime()) / (1000 * 60 * 60);
        dayBuckets[dayOfWeek].count++;
        dayBuckets[dayOfWeek].totalHours += hours;
      }
    }
  });

  const timeData = dayNames.map((day, i) => ({
    day,
    hours: dayBuckets[i].count > 0
      ? Math.round((dayBuckets[i].totalHours / dayBuckets[i].count) * 10) / 10
      : 0,
  }));

  if (isLoading) {
    return (
      <>
        <AppHeader title="Relatórios" subtitle="Métricas e análises da sua conta" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Relatórios"
        subtitle="Métricas e análises da sua conta"
        actions={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-fade-in">
            <CardHeader><CardTitle className="text-base">Documentos por mês</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                {stats?.monthlyData && stats.monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="sent" name="Enviados" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="signed" name="Assinados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Nenhum dado disponível
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '50ms' }}>
            <CardHeader><CardTitle className="text-base">Status dos documentos</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground text-sm">Nenhum documento ainda</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: '100ms' }}>
            <CardHeader><CardTitle className="text-base">Tempo médio de assinatura (horas)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="hours" name="Horas" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
