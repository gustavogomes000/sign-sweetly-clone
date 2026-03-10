import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, Users, Building2, Search, RefreshCw, Shield, Mail, Briefcase, Crown, User, UserPlus, CheckCircle2, Send, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bluepointApi, type BPColaborador } from '@/services/bluepointApi';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const hierarchyConfig: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  owner: { label: 'OWNER', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Crown },
  gestor: { label: 'GESTOR', color: 'bg-primary/15 text-primary border-primary/30', icon: Shield },
  user: { label: 'USUÁRIO', color: 'bg-muted text-muted-foreground border-border', icon: User },
};

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>();
  const deptId = Number(id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog state for importing a collaborator
  const [importingColab, setImportingColab] = useState<BPColaborador | null>(null);
  const [importHierarchy, setImportHierarchy] = useState<string>('user');
  const [importing, setImporting] = useState(false);

  // Batch import dialog
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchHierarchy, setBatchHierarchy] = useState<string>('user');
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set());
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const { data: departamento, isLoading: loadingDept, error: deptError } = useQuery({
    queryKey: ['bluepoint-departamento', deptId],
    queryFn: async () => {
      const result = await bluepointApi.obterDepartamento(deptId);
      return result;
    },
    enabled: !isNaN(deptId) && deptId > 0,
    staleTime: 5 * 60_000,
    retry: 2,
  });

  const { data: colaboradores = [], isLoading: loadingColab, refetch, isFetching, error: colabError } = useQuery({
    queryKey: ['bluepoint-dept-colaboradores', deptId],
    queryFn: async () => {
      const result = await bluepointApi.listarColaboradoresDepartamento(deptId);
      if (Array.isArray(result)) return result;
      return [];
    },
    enabled: !isNaN(deptId) && deptId > 0,
    staleTime: 5 * 60_000,
    retry: 2,
  });

  // Check which collaborators are already imported
  const { data: importedProfiles = [] } = useQuery({
    queryKey: ['imported-profiles-bp'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, bluepoint_id, email, full_name, hierarchy, active')
        .not('bluepoint_id', 'is', null);
      return data || [];
    },
    staleTime: 30_000,
  });

  const importedBpIds = new Set(importedProfiles.map(p => p.bluepoint_id));
  const apiError = deptError || colabError;

  const filtered = colaboradores.filter((c) => {
    if (!c) return false;
    const matchSearch = !search || 
      (c.nome || '').toLowerCase().includes(search.toLowerCase()) || 
      (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = colaboradores.filter(c => c?.status === 'ativo').length;
  const importedCount = colaboradores.filter(c => c && importedBpIds.has(c.id)).length;
  const isLoading = loadingDept || loadingColab;

  const handleImportSingle = async () => {
    if (!importingColab) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: importingColab.email,
          full_name: importingColab.nome,
          hierarchy: importHierarchy,
          department_id: null,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Update profile with bluepoint_id and must_change_password
      if (data?.user_id) {
        await supabase.from('profiles').update({
          bluepoint_id: importingColab.id,
          must_change_password: true,
        }).eq('id', data.user_id);
      }

      toast({ title: `✅ ${importingColab.nome} importado!`, description: `Email enviado para ${importingColab.email} com credenciais de acesso.` });
      setImportingColab(null);
      queryClient.invalidateQueries({ queryKey: ['imported-profiles-bp'] });
    } catch (err) {
      toast({ title: 'Erro ao importar', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleBatchImport = async () => {
    const selected = colaboradores.filter(c => c && batchSelected.has(c.id) && !importedBpIds.has(c.id));
    if (selected.length === 0) return;
    setBatchImporting(true);
    setBatchProgress({ current: 0, total: selected.length });

    let successCount = 0;
    for (const colab of selected) {
      try {
        const { data, error } = await supabase.functions.invoke('invite-user', {
          body: {
            email: colab.email,
            full_name: colab.nome,
            hierarchy: batchHierarchy,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.user_id) {
          await supabase.from('profiles').update({
            bluepoint_id: colab.id,
            must_change_password: true,
          }).eq('id', data.user_id);
        }
        successCount++;
      } catch (err) {
        console.warn(`Failed to import ${colab.nome}:`, err);
      }
      setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    toast({ title: `✅ ${successCount} de ${selected.length} importados!`, description: 'Emails enviados com credenciais de acesso.' });
    setBatchImporting(false);
    setShowBatchImport(false);
    setBatchSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['imported-profiles-bp'] });
  };

  const toggleBatchSelect = (colabId: number) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(colabId)) next.delete(colabId); else next.add(colabId);
      return next;
    });
  };

  const selectAllNotImported = () => {
    const notImported = filtered.filter(c => c && !importedBpIds.has(c.id)).map(c => c.id);
    setBatchSelected(new Set(notImported));
  };

  const deptName = departamento?.nome?.toUpperCase() || `DEPARTAMENTO ${id}`;

  return (
    <>
      <AppHeader
        title={deptName}
        subtitle={`${colaboradores.length} colaboradores`}
      />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <Link to="/departments" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
          <ArrowLeft className="w-4 h-4" /> Voltar para departamentos
        </Link>

        {/* Error state */}
        {apiError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Erro ao carregar dados</p>
                <p className="text-xs text-muted-foreground">{apiError instanceof Error ? apiError.message : 'Erro desconhecido'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto shrink-0">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL', value: colaboradores.length, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
            { label: 'ATIVOS', value: activeCount, icon: Users, color: 'text-success', bgColor: 'bg-success/10' },
            { label: 'IMPORTADOS', value: importedCount, icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10' },
            { label: 'STATUS', value: departamento?.status?.toUpperCase() || '—', icon: Building2, color: 'text-primary', bgColor: 'bg-primary/10' },
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
          <Card className="game-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground font-body">{departamento.descricao}</p>
            </CardContent>
          </Card>
        )}

        {/* Filters + Actions */}
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
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="font-game text-xs tracking-wider">
              <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> ATUALIZAR
            </Button>
            {filtered.filter(c => c && !importedBpIds.has(c.id)).length > 0 && (
              <Button size="sm" onClick={() => { selectAllNotImported(); setShowBatchImport(true); }} className="font-game text-xs tracking-wider">
                <Send className="w-4 h-4 mr-1" /> IMPORTAR EM LOTE
              </Button>
            )}
          </div>
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
                  <p className="font-body">{colaboradores.length === 0 ? 'Nenhum colaborador neste departamento' : 'Nenhum colaborador encontrado com os filtros atuais'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead className="font-game text-[10px] tracking-wider">COLABORADOR</TableHead>
                        <TableHead className="font-game text-[10px] tracking-wider hidden md:table-cell">CARGO</TableHead>
                        <TableHead className="font-game text-[10px] tracking-wider hidden lg:table-cell">MATRÍCULA</TableHead>
                        <TableHead className="font-game text-[10px] tracking-wider">STATUS</TableHead>
                        <TableHead className="font-game text-[10px] tracking-wider">SISTEMA</TableHead>
                        <TableHead className="font-game text-[10px] tracking-wider text-right">AÇÕES</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => {
                        if (!c) return null;
                        const isImported = importedBpIds.has(c.id);
                        const profile = importedProfiles.find(p => p.bluepoint_id === c.id);
                        const initials = (c.nome || 'NN').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                        return (
                          <TableRow key={c.id} className="border-border/30 hover:bg-primary/5">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-9 h-9 border border-border/30">
                                  {c.foto && <AvatarImage src={c.foto} alt={c.nome} />}
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-game font-bold">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-body font-semibold">{c.nome || '—'}</p>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="w-3 h-3" /> {c.email || '—'}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1.5 text-sm font-body">
                                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                {c.cargo?.nome || '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-body font-mono hidden lg:table-cell">{c.matricula || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">
                                {(c.status || 'N/A').toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isImported ? (
                                <Badge variant="outline" className={`text-[10px] font-game tracking-wider ${hierarchyConfig[profile?.hierarchy || 'user']?.color || ''}`}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {hierarchyConfig[profile?.hierarchy || 'user']?.label || 'USUÁRIO'}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground font-body">Não importado</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isImported && c.email ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="font-game text-xs tracking-wider"
                                  onClick={() => { setImportingColab(c); setImportHierarchy(c.tipo === 'admin' ? 'gestor' : 'user'); }}
                                >
                                  <UserPlus className="w-3.5 h-3.5 mr-1" /> IMPORTAR
                                </Button>
                              ) : isImported ? (
                                <span className="text-xs text-success font-game">✓ ATIVO</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem email</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Import single collaborator dialog */}
      <Dialog open={!!importingColab} onOpenChange={(open) => !open && setImportingColab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">IMPORTAR COLABORADOR</DialogTitle>
            <DialogDescription className="text-sm">
              Um email será enviado com credenciais de acesso. No primeiro login, o usuário deverá trocar a senha.
            </DialogDescription>
          </DialogHeader>
          {importingColab && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <p className="text-sm font-semibold">{importingColab.nome}</p>
                <p className="text-xs text-muted-foreground">{importingColab.email}</p>
                <p className="text-xs text-muted-foreground">Cargo: {importingColab.cargo?.nome || '—'} • Matrícula: {importingColab.matricula || '—'}</p>
              </div>
              <div>
                <Label className="text-xs font-game tracking-wider text-muted-foreground">HIERARQUIA NO SISTEMA</Label>
                <Select value={importHierarchy} onValueChange={setImportHierarchy}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">
                      <div className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-400" /> Owner — Acesso total</div>
                    </SelectItem>
                    <SelectItem value="gestor">
                      <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-primary" /> Gestor — Gerencia equipe e documentos</div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> Usuário — Acesso básico</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportingColab(null)}>Cancelar</Button>
            <Button onClick={handleImportSingle} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Importar e enviar email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch import dialog */}
      <Dialog open={showBatchImport} onOpenChange={setShowBatchImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">IMPORTAÇÃO EM LOTE</DialogTitle>
            <DialogDescription className="text-sm">
              Selecione os colaboradores e defina a hierarquia padrão. Todos receberão email com credenciais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-game tracking-wider text-muted-foreground">HIERARQUIA PADRÃO</Label>
              <Select value={batchHierarchy} onValueChange={setBatchHierarchy}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner"><div className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-400" /> Owner</div></SelectItem>
                  <SelectItem value="gestor"><div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-primary" /> Gestor</div></SelectItem>
                  <SelectItem value="user"><div className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> Usuário</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-60 overflow-auto space-y-1">
              {filtered.filter(c => c && !importedBpIds.has(c.id) && c.email).map(c => (
                <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchSelected.has(c.id)}
                    onChange={() => toggleBatchSelect(c.id)}
                    className="rounded border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  </div>
                </label>
              ))}
              {filtered.filter(c => c && !importedBpIds.has(c.id) && c.email).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Todos os colaboradores já foram importados!</p>
              )}
            </div>
            {batchImporting && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">{batchProgress.current} de {batchProgress.total}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchImport(false)} disabled={batchImporting}>Cancelar</Button>
            <Button onClick={handleBatchImport} disabled={batchImporting || batchSelected.size === 0}>
              {batchImporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Importar {batchSelected.size} colaborador{batchSelected.size !== 1 ? 'es' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
