import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockStats, mockDocuments, mockFolders } from '@/data/mockData';
import { FileText, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, TrendingUp, Timer, XCircle, FileEdit, Hexagon, Zap } from 'lucide-react';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const statCards = [
  { label: 'Total de documentos', value: mockStats.totalDocuments, icon: FileText, color: 'text-info', bgColor: 'bg-info/10', glowClass: '' },
  { label: 'Aguardando assinatura', value: mockStats.pendingSignatures, icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10', glowClass: 'glow-accent' },
  { label: 'Assinados', value: mockStats.signedDocuments, icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10', glowClass: 'glow-primary' },
  { label: 'Expirados', value: mockStats.expiredDocuments, icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10', glowClass: '' },
  { label: 'Cancelados', value: mockStats.cancelledDocuments, icon: XCircle, color: 'text-muted-foreground', bgColor: 'bg-muted', glowClass: '' },
  { label: 'Rascunhos', value: mockStats.drafts, icon: FileEdit, color: 'text-muted-foreground', bgColor: 'bg-muted', glowClass: '' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20, rotateX: -8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function Dashboard() {
  const recentDocs = mockDocuments.slice(0, 5);

  return (
    <>
      <AppHeader title="Início" subtitle="Visão geral da sua conta" />
      <div className="flex-1 overflow-auto p-6 space-y-6 hex-pattern">
        {/* Stats Grid - 3D game cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={{ y: -4, scale: 1.03 }}
              style={{ perspective: 800 }}
            >
              <Card className="game-card group cursor-default h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <motion.div
                      className={cn('p-2 rounded-lg', stat.bgColor)}
                      whileHover={{ rotate: 12, scale: 1.15 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <stat.icon className={cn('w-4 h-4', stat.color)} />
                    </motion.div>
                    <Hexagon className="w-4 h-4 text-primary/10 group-hover:text-primary/25 transition-colors" strokeWidth={1} />
                  </div>
                  <p className="text-2xl font-game font-bold stat-number">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-body font-semibold">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* KPIs Row - Glowing game panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Card className="game-card overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-game text-muted-foreground tracking-wider uppercase">Taxa de conclusão</p>
                    <p className="text-3xl font-game font-bold stat-number mt-1">{mockStats.completionRate}%</p>
                  </div>
                  <motion.div
                    className="p-3 rounded-xl bg-success/10"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <TrendingUp className="w-5 h-5 text-success" />
                  </motion.div>
                </div>
                <div className="game-progress">
                  <motion.div
                    className="game-progress-bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${mockStats.completionRate}%` }}
                    transition={{ delay: 0.5, duration: 1.2, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 font-body">Documentos completados com sucesso</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Card className="game-card overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-game text-muted-foreground tracking-wider uppercase">Tempo médio</p>
                    <p className="text-3xl font-game font-bold stat-number mt-1">{mockStats.avgSignTime}</p>
                  </div>
                  <motion.div
                    className="p-3 rounded-xl bg-info/10"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Timer className="w-5 h-5 text-info" />
                  </motion.div>
                </div>
                <p className="text-xs text-muted-foreground font-body">Desde o envio até todas assinaturas coletadas</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart - with game frame */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Card className="game-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  <CardTitle className="text-sm font-game tracking-wider">DOCUMENTOS POR MÊS</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mockStats.monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'Rajdhani' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'Rajdhani' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--primary) / 0.3)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'Rajdhani',
                          boxShadow: '0 0 15px hsl(var(--primary) / 0.1)',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'Rajdhani' }} />
                      <Bar dataKey="sent" name="Enviados" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="signed" name="Assinados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Folders - game inventory style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Card className="game-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hexagon className="w-4 h-4 text-primary/40" strokeWidth={1.5} />
                    <CardTitle className="text-sm font-game tracking-wider">PASTAS</CardTitle>
                  </div>
                  <Link to="/folders" className="text-[10px] font-game text-primary hover:underline tracking-wider">VER TODAS</Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {mockFolders.map((folder, i) => (
                  <motion.div
                    key={folder.id}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.05 }}
                  >
                    <Link
                      to={`/folders?folder=${folder.name}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50 transition-all hover:translate-x-1 duration-200"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: folder.color, boxShadow: `0 0 6px ${folder.color}40` }} />
                        <span className="text-sm text-foreground font-body font-semibold">{folder.name}</span>
                      </div>
                      <span className="text-xs font-game text-muted-foreground">{folder.count}</span>
                    </Link>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Documents - game list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <Card className="game-card">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary/50" />
                <h2 className="text-sm font-game font-semibold text-foreground tracking-wider">DOCUMENTOS RECENTES</h2>
              </div>
              <Link to="/documents" className="text-[10px] font-game text-primary hover:underline flex items-center gap-1 tracking-wider">
                VER TODOS <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/50">
              {recentDocs.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.05 }}
                >
                  <Link
                    to={`/documents/${doc.id}`}
                    className="flex items-center justify-between p-4 hover:bg-primary/5 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <motion.div
                        className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 border border-border/50"
                        whileHover={{ rotate: 5, scale: 1.1 }}
                      >
                        <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </motion.div>
                      <div className="min-w-0">
                        <p className="text-sm font-body font-semibold text-foreground truncate group-hover:text-primary transition-colors">{doc.name}</p>
                        <p className="text-xs text-muted-foreground font-body">
                          {format(new Date(doc.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
                          {doc.signers.length > 0 && ` · ${doc.signers.filter(s => s.status === 'signed').length}/${doc.signers.length} assinaturas`}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={doc.status} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
