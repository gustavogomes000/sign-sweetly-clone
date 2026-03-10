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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, Users, Building2, Search, RefreshCw, Shield, Mail, Pencil, UserPlus, Crown, UserCheck, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const hierarchyConfig: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  owner: { label: 'OWNER', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Crown },
  gestor: { label: 'GESTOR', color: 'bg-primary/15 text-primary border-primary/30', icon: Shield },
  user: { label: 'USUÁRIO', color: 'bg-muted text-muted-foreground border-border', icon: User },
};

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  hierarchy: string;
  active: boolean;
  department_id: string | null;
}

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHierarchy, setEditHierarchy] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: department, isLoading: loadingDept } = useQuery({
    queryKey: ['department', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: members = [], isLoading: loadingMembers, refetch, isFetching } = useQuery({
    queryKey: ['department-members', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('department_id', id!)
        .order('full_name');
      if (error) throw error;
      return data as ProfileRow[];
    },
    enabled: !!id,
  });

  // All profiles without department (for adding)
  const { data: unassigned = [] } = useQuery({
    queryKey: ['unassigned-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .is('department_id', null)
        .eq('active', true)
        .order('full_name');
      if (error) throw error;
      return data as ProfileRow[];
    },
    enabled: addingUser,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; full_name: string; email: string; hierarchy: string; active: boolean }) => {
      const { error } = await supabase.from('profiles').update({
        full_name: updates.full_name,
        email: updates.email,
        hierarchy: updates.hierarchy,
        active: updates.active,
      }).eq('id', updates.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Usuário atualizado ✅' });
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['department-members', id] });
    },
    onError: (err) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').update({ department_id: id }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Membro adicionado ✅' });
      setAddingUser(false);
      queryClient.invalidateQueries({ queryKey: ['department-members', id] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').update({ department_id: null }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Membro removido do departamento' });
      queryClient.invalidateQueries({ queryKey: ['department-members', id] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const filtered = members.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return m.full_name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s);
  });

  const activeCount = members.filter(m => m.active).length;
  const ownerCount = members.filter(m => m.hierarchy === 'owner').length;
  const gestorCount = members.filter(m => m.hierarchy === 'gestor').length;
  const isLoading = loadingDept || loadingMembers;

  const openEditDialog = (user: ProfileRow) => {
    setEditingUser(user);
    setEditName(user.full_name);
    setEditEmail(user.email);
    setEditHierarchy(user.hierarchy);
    setEditActive(user.active);
  };

  return (
    <>
      <AppHeader
        title={department?.name?.toUpperCase() || 'Departamento'}
        subtitle={`${members.length} membros`}
      />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <Link to="/departments" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
          <ArrowLeft className="w-4 h-4" /> Voltar para departamentos
        </Link>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL', value: members.length, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
            { label: 'ATIVOS', value: activeCount, icon: UserCheck, color: 'text-success', bgColor: 'bg-success/10' },
            { label: 'GESTORES', value: gestorCount, icon: Shield, color: 'text-accent', bgColor: 'bg-accent/10' },
            { label: 'OWNERS', value: ownerCount, icon: Crown, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
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

        {department?.description && (
          <Card className="game-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground font-body">{department.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Filters + Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar membro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-72 bg-secondary/50 border-border/50" />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="font-game text-xs tracking-wider">
              <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> ATUALIZAR
            </Button>
            <Button size="sm" onClick={() => setAddingUser(true)} className="font-game text-xs tracking-wider">
              <UserPlus className="w-4 h-4 mr-1" /> ADICIONAR MEMBRO
            </Button>
          </div>
        </div>

        {/* Members table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="game-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="w-10 h-10 mb-2 opacity-30" />
                  <p className="font-body">Nenhum membro neste departamento</p>
                  <Button variant="link" size="sm" onClick={() => setAddingUser(true)} className="mt-2">
                    Adicionar membro
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="font-game text-[10px] tracking-wider">MEMBRO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">HIERARQUIA</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">STATUS</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider text-right">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => {
                      const hc = hierarchyConfig[m.hierarchy] || hierarchyConfig.user;
                      const HIcon = hc.icon;
                      return (
                        <TableRow key={m.id} className="border-border/30 hover:bg-primary/5">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 border border-border/30">
                                {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name} />}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-game font-bold">
                                  {m.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-body font-semibold">{m.full_name}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="w-3 h-3" /> {m.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-game tracking-wider ${hc.color}`}>
                              <HIcon className="w-3 h-3 mr-1" /> {hc.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.active ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">
                              {m.active ? 'ATIVO' : 'INATIVO'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(m)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => removeMutation.mutate(m.id)}
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Edit user dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">EDITAR MEMBRO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" />
            </div>
            <div>
              <Label>Hierarquia</Label>
              <Select value={editHierarchy} onValueChange={setEditHierarchy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-400" /> Owner</div>
                  </SelectItem>
                  <SelectItem value="gestor">
                    <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-primary" /> Gestor</div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> Usuário</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Ativo</Label>
              <Select value={editActive ? 'true' : 'false'} onValueChange={v => setEditActive(v === 'true')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button
              onClick={() => editingUser && updateMutation.mutate({ id: editingUser.id, full_name: editName, email: editEmail, hierarchy: editHierarchy, active: editActive })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={addingUser} onOpenChange={setAddingUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">ADICIONAR MEMBRO</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-auto">
            {unassigned.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Todos os usuários já pertencem a um departamento.</p>
            ) : (
              unassigned.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-game">
                        {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => assignMutation.mutate(u.id)} disabled={assignMutation.isPending}>
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
