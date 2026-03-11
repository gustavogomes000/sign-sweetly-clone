import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useDashboardStats, useDocuments } from '@/hooks/useDocuments';
import { Loader2, Hexagon, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Analytics() {
  const [period, setPeriod] = useState('7d');
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: documents = [], isLoading: docsLoading } = useDocuments();

  const isLoading = statsLoading || docsLoading;

  const pieData = [
    { name: 'Assinados', value: stats?.signedDocuments ?? 0, color: 'hsl(152, 62%, 42%)' },
    { name: 'Aguardando', value: stats?.pendingSignatures ?? 0, color: 'hsl(38, 92%, 50%)' },
    { name: 'Expirados', value: stats?.expiredDocuments ?? 0, color: 'hsl(180, 10%, 46%)' },
    { name: 'Cancelados', value: stats?.cancelledDocuments ?? 0, color: 'hsl(0, 84%, 60%)' },
    { name: 'Rascunhos', value: stats?.drafts ?? 0, color: 'hsl(160, 14%, 80%)' },
  ].filter(d => d.value > 0);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayBuckets = Array.from({ length: 7 }, () => ({ count: 0, totalHours: 0 }));
  documents.forEach(doc => {
    if (doc.status === 'signed' && doc.signers.length > 0) {
      const createdDate = new Date(doc.criado_em);
      const dayOfWeek = createdDate.getDay();
      const lastSigned = doc.signers.filter(s => s.assinado_em).map(s => new Date(s.assinado_em!).getTime()).sort((a, b) => b - a)[0];
      if (lastSigned) {
        dayBuckets[dayOfWeek].count++;
        dayBuckets[dayOfWeek].totalHours += (lastSigned - createdDate.getTime()) / (1000 * 60 * 60);
      }
    }
  });
  const timeData = dayNames.map((day, i) => ({
    day,
    hours: dayBuckets[i].count > 0 ? Math.round((dayBuckets[i].totalHours / dayBuckets[i].count) * 10) / 10 : 0,
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
            <SelectTrigger className="w-40 h-9 bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="game-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  <CardTitle className="text-sm font-game tracking-wider">DOCUMENTOS POR MÊS</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {stats?.monthlyData && stats.monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.monthlyData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'Rajdhani' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'Rajdhani' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / 0.3)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Rajdhani' }} />
                        <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'Rajdhani' }} />
                        <Bar dataKey="sent" name="Enviados" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="signed" name="Assinados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-game">Nenhum dado</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="game-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Hexagon className="w-4 h-4 text-primary/40" strokeWidth={1.5} />
                  <CardTitle className="text-sm font-game tracking-wider">STATUS DOS DOCUMENTOS</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / 0.3)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Rajdhani' }} />
                        <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'Rajdhani' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-muted-foreground text-sm font-game">Nenhum documento</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="game-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <CardTitle className="text-sm font-game tracking-wider">TEMPO MÉDIO DE ASSINATURA (HORAS)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'Rajdhani' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'Rajdhani' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / 0.3)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Rajdhani' }} />
                      <Area type="monotone" dataKey="hours" name="Horas" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
}
