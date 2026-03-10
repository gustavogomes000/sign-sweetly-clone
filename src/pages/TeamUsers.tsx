import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Loader2, Search, Building2, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { bluepointApi, BPColaborador } from '@/services/bluepointApi';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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
    const matchSearch = search
      ? c.nome.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.cpf.includes(search)
      : true;
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
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats */}
        <div className="flex gap-2 flex-wrap">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Ativos</span>
              <Badge variant="default" className="text-xs">{activeCount}</Badge>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Inativos</span>
              <Badge variant="secondary" className="text-xs">{inactiveCount}</Badge>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Admins</span>
              <Badge variant="secondary" className="text-xs">{adminCount}</Badge>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-72"
            />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos departamentos</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Biometria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            {c.foto && <AvatarImage src={c.foto} alt={c.nome} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                              {c.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{c.empresa?.nomeFantasia || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{c.departamento?.nome || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{c.cargo?.nome || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.tipo === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {c.tipo === 'admin' ? 'Admin' : 'Colaborador'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-xs">
                          {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.biometria?.cadastrada ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {c.biometria?.cadastrada ? '✓ Cadastrada' : 'Pendente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
