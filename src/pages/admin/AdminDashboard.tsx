import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, FileText, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { mockCompanies } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const platformStats = [
  { label: 'Empresas ativas', value: mockCompanies.filter(c => c.status === 'active').length, icon: Building2, color: 'text-primary', bgColor: 'bg-primary/10' },
  { label: 'Total de usuários', value: mockCompanies.reduce((acc, c) => acc + c.usersCount, 0), icon: Users, color: 'text-info', bgColor: 'bg-info/10' },
  { label: 'Documentos (mês)', value: mockCompanies.reduce((acc, c) => acc + c.documentsUsed, 0), icon: FileText, color: 'text-success', bgColor: 'bg-success/10' },
  { label: 'Receita mensal', value: 'R$ 12.400', icon: DollarSign, color: 'text-warning', bgColor: 'bg-warning/10' },
];

const usageData = mockCompanies.filter(c => c.status === 'active').map(c => ({
  name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
  documentos: c.documentsUsed,
  limite: c.maxDocumentsMonth,
}));

export default function AdminDashboard() {
  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1 font-body">Visão geral da plataforma Valeris</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {platformStats.map((stat) => (
          <Card key={stat.label}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Uso por empresa</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="documentos" name="Usados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="limite" name="Limite" fill="hsl(var(--border))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Companies list */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Empresas</CardTitle>
              <Link to="/admin/companies" className="text-xs text-primary hover:underline">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockCompanies.map((comp) => (
              <Link
                key={comp.id}
                to={`/admin/companies/${comp.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{comp.name}</p>
                    <p className="text-xs text-muted-foreground">{comp.usersCount} usuários · {comp.plan}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={comp.status === 'active' ? 'default' : comp.status === 'suspended' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {comp.status === 'active' ? 'Ativa' : comp.status === 'suspended' ? 'Suspensa' : 'Inativa'}
                  </Badge>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{comp.documentsUsed}/{comp.maxDocumentsMonth}</p>
                    <Progress value={(comp.documentsUsed / comp.maxDocumentsMonth) * 100} className="h-1 w-16" />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />Alertas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {mockCompanies.filter(c => c.status === 'suspended').map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-foreground"><strong>{c.name}</strong> está com o plano suspenso</p>
            </div>
          ))}
          {mockCompanies.filter(c => c.documentsUsed / c.maxDocumentsMonth > 0.7 && c.status === 'active').map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <TrendingUp className="w-4 h-4 text-warning shrink-0" />
              <p className="text-sm text-foreground"><strong>{c.name}</strong> usou {Math.round(c.documentsUsed / c.maxDocumentsMonth * 100)}% do limite mensal</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
