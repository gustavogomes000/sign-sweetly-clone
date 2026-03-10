import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Loader2, Search, Building2, RefreshCw, Hexagon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { bluepointApi } from '@/services/bluepointApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';

export default function TeamUsers() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ativo');

  const { data: colaboradores = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['bluepoint-colaboradores'],
    queryFn: () => bluepointApi.listarColaboradores(),
    staleTime: 5 * 60 * 1000,
  });

  const departments = [...new Set(colaboradores.map(c => c.departamento?.nome).filter(Boolean))] as string[];
  const filtered = colaboradores.filter((c) => {
    const matchSearch = search ? c.nome.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.cpf.includes(search) : true;
    const matchDept = deptFilter === 'all' || c.departamento?.nome === deptFilter;
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const activeCount = colaboradores.filter(c => c.status === 'ativo').length;
  const inactiveCount = colaboradores.filter(c => c.status === 'inativo').length;
  const adminCount = colaboradores.filter(c => c.tipo === 'admin').length;

  return (
    <>
      <AppHeader title="Equipe" subtitle={`${colaboradores.length} colaboradores (BluePoint)`} />
      <div className="flex-1 overflow-auto p-6 space-y-4 hex-pattern">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'ATIVOS', value: activeCount, icon: Users, color: 'text-success', bgColor: 'bg-success/10' },
            { label: 'INATIVOS', value: inactiveCount, icon: Users, color: 'text-muted-foreground', bgColor: 'bg-muted' },
            { label: 'ADMINS', value: adminCount, icon: Building2, color: 'text-accent', bgColor: 'bg-accent/10' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -2, scale: 1.02 }}>
              <Card className="game-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}><stat.icon className={`w-4 h-4 ${stat.color}`} /></div>
                    <Hexagon className="w-4 h-4 text-primary/10" strokeWidth={1} />
                  </div>
                  <p className="text-2xl font-game font-bold stat-number">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-game tracking-wider">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, e-mail ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-72 bg-secondary/50 border-border/50" />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48 h-9 bg-secondary/50 border-border/50"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos departamentos</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="font-game text-xs tracking-wider">
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> ATUALIZAR
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="game-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="font-game text-[10px] tracking-wider">COLABORADOR</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">EMPRESA</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">DEPARTAMENTO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">CARGO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">TIPO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">STATUS</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">BIOMETRIA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="border-border/30 hover:bg-primary/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 border border-border/30">
                              {c.foto && <AvatarImage src={c.foto} alt={c.nome} />}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-game font-bold">{c.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-body font-semibold">{c.nome}</p>
                              <p className="text-xs text-muted-foreground">{c.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-body">{c.empresa?.nomeFantasia || '—'}</TableCell>
                        <TableCell className="text-sm font-body">{c.departamento?.nome || '—'}</TableCell>
                        <TableCell className="text-sm font-body">{c.cargo?.nome || '—'}</TableCell>
                        <TableCell><Badge variant={c.tipo === 'admin' ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">{c.tipo === 'admin' ? 'ADMIN' : 'COLAB'}</Badge></TableCell>
                        <TableCell><Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">{c.status === 'ativo' ? 'ATIVO' : 'INATIVO'}</Badge></TableCell>
                        <TableCell><Badge variant={c.biometria?.cadastrada ? 'default' : 'outline'} className="text-[10px] font-game tracking-wider">{c.biometria?.cadastrada ? '✓ OK' : 'PENDENTE'}</Badge></TableCell>
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
