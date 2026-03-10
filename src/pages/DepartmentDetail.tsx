import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Users, Building2, Search, RefreshCw, Hexagon, Briefcase, Mail, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { bluepointApi, type BPColaborador, type BPDepartamento } from '@/services/bluepointApi';
import { motion } from 'framer-motion';

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>();
  const deptId = Number(id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ativo');

  const { data: departamento, isLoading: loadingDept } = useQuery({
    queryKey: ['bluepoint-departamento', deptId],
    queryFn: () => bluepointApi.obterDepartamento(deptId),
    enabled: !!deptId,
    staleTime: 5 * 60_000,
  });

  const { data: colaboradores = [], isLoading: loadingColab, refetch, isFetching } = useQuery({
    queryKey: ['bluepoint-dept-colaboradores', deptId],
    queryFn: () => bluepointApi.listarColaboradoresDepartamento(deptId),
    enabled: !!deptId,
    staleTime: 5 * 60_000,
  });

  const filtered = colaboradores.filter((c) => {
    const matchSearch = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = colaboradores.filter(c => c.status === 'ativo').length;
  const adminCount = colaboradores.filter(c => c.tipo === 'admin').length;
  const isLoading = loadingDept || loadingColab;

  return (
    <>
      <AppHeader
        title={departamento?.nome?.toUpperCase() || 'Departamento'}
        subtitle={`${colaboradores.length} colaboradores`}
      />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Back link */}
        <Link to="/departments" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
          <ArrowLeft className="w-4 h-4" /> Voltar para departamentos
        </Link>

        {/* Department info + stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL', value: colaboradores.length, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
            { label: 'ATIVOS', value: activeCount, icon: Users, color: 'text-success', bgColor: 'bg-success/10' },
            { label: 'ADMINS', value: adminCount, icon: Building2, color: 'text-accent', bgColor: 'bg-accent/10' },
            { label: 'STATUS', value: departamento?.status?.toUpperCase() || '—', icon: Hexagon, color: 'text-primary', bgColor: 'bg-primary/10' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -2, scale: 1.02 }}>
              <Card className="game-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}><stat.icon className={`w-4 h-4 ${stat.color}`} /></div>
                  </div>
                  <p className="text-2xl font-game font-bold stat-number">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-game tracking-wider">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {departamento?.descricao && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="game-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground font-body">{departamento.descricao}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-72 bg-secondary/50 border-border/50" />
          </div>
          <Button
            variant={statusFilter === 'ativo' ? 'default' : 'outline'}
            size="sm"
            className="font-game text-xs tracking-wider"
            onClick={() => setStatusFilter(statusFilter === 'ativo' ? 'all' : 'ativo')}
          >
            {statusFilter === 'ativo' ? 'SOMENTE ATIVOS' : 'TODOS'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="font-game text-xs tracking-wider ml-auto">
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> ATUALIZAR
          </Button>
        </div>

        {/* Collaborators table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="game-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="w-10 h-10 mb-2 opacity-30" />
                  <p className="font-body">Nenhum colaborador encontrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="font-game text-[10px] tracking-wider">COLABORADOR</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">CARGO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">MATRÍCULA</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">TIPO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">STATUS</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">BIOMETRIA</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">ADMISSÃO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="border-border/30 hover:bg-primary/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 border border-border/30">
                              {c.foto && <AvatarImage src={c.foto} alt={c.nome} />}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-game font-bold">
                                {c.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-body font-semibold">{c.nome}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" /> {c.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm font-body">
                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                            {c.cargo?.nome || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-body font-mono">{c.matricula}</TableCell>
                        <TableCell>
                          <Badge variant={c.tipo === 'admin' ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">
                            {c.tipo === 'admin' ? 'ADMIN' : 'COLAB'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">
                            {c.status === 'ativo' ? 'ATIVO' : 'INATIVO'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.biometria?.cadastrada ? 'default' : 'outline'} className="text-[10px] font-game tracking-wider">
                            {c.biometria?.cadastrada ? '✓ OK' : 'PENDENTE'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-body">
                          {c.dataAdmissao ? new Date(c.dataAdmissao).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
