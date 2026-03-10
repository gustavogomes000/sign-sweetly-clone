import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Users, Loader2, Search, Building2, RefreshCw, Hexagon, Plus, Pencil, Mail, Shield } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

type Hierarchy = 'owner' | 'gestor' | 'user';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  hierarchy: string;
  active: boolean;
  avatar_url: string | null;
  department_id: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

const hierarchyLabels: Record<string, { label: string; color: string }> = {
  owner: { label: 'OWNER', color: 'bg-accent text-accent-foreground' },
  gestor: { label: 'GESTOR', color: 'bg-primary text-primary-foreground' },
  user: { label: 'USUÁRIO', color: 'bg-secondary text-secondary-foreground' },
};

export default function TeamUsers() {
  const [search, setSearch] = useState('');
  const [hierarchyFilter, setHierarchyFilter] = useState<string>('all');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ full_name: '', email: '', hierarchy: 'user' as Hierarchy, department_id: '' });
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['team-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
    staleTime: 30_000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      return (data || []) as Department[];
    },
  });

  const filtered = profiles.filter((p) => {
    const matchSearch = !search || p.full_name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase());
    const matchHierarchy = hierarchyFilter === 'all' || p.hierarchy === hierarchyFilter;
    return matchSearch && matchHierarchy;
  });

  const activeCount = profiles.filter(p => p.active).length;
  const gestorCount = profiles.filter(p => p.hierarchy === 'gestor').length;
  const ownerCount = profiles.filter(p => p.hierarchy === 'owner').length;

  const updateProfile = useMutation({
    mutationFn: async (profile: Profile) => {
      const { error } = await supabase.from('profiles').update({
        full_name: profile.full_name,
        hierarchy: profile.hierarchy,
        active: profile.active,
        department_id: profile.department_id || null,
      }).eq('id', profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-profiles'] });
      setEditingProfile(null);
      toast({ title: 'Perfil atualizado ✅' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar', description: String(err), variant: 'destructive' });
    },
  });

  const handleInvite = async () => {
    if (!inviteData.full_name || !inviteData.email) return;
    setInviting(true);
    try {
      // Create user via edge function that uses service role
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteData.email,
          full_name: inviteData.full_name,
          hierarchy: inviteData.hierarchy,
          department_id: inviteData.department_id || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Convite enviado ✅', description: `Email de redefinição de senha enviado para ${inviteData.email}` });
      setShowInvite(false);
      setInviteData({ full_name: '', email: '', hierarchy: 'user', department_id: '' });
      queryClient.invalidateQueries({ queryKey: ['team-profiles'] });
    } catch (err) {
      toast({ title: 'Erro ao convidar', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  return (
    <>
      <AppHeader title="Equipe" subtitle={`${profiles.length} membros`} />
      <div className="flex-1 overflow-auto p-6 space-y-4 hex-pattern">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL', value: profiles.length, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
            { label: 'ATIVOS', value: activeCount, icon: Users, color: 'text-success', bgColor: 'bg-success/10' },
            { label: 'GESTORES', value: gestorCount, icon: Shield, color: 'text-accent', bgColor: 'bg-accent/10' },
            { label: 'OWNERS', value: ownerCount, icon: Building2, color: 'text-primary', bgColor: 'bg-primary/10' },
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
            <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-72 bg-secondary/50 border-border/50" />
          </div>
          <Select value={hierarchyFilter} onValueChange={setHierarchyFilter}>
            <SelectTrigger className="w-40 h-9 bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="gestor">Gestor</SelectItem>
              <SelectItem value="user">Usuário</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="font-game text-xs tracking-wider">
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> ATUALIZAR
          </Button>
          <Button size="sm" onClick={() => setShowInvite(true)} className="font-game text-xs tracking-wider ml-auto">
            <Plus className="w-4 h-4 mr-1" /> CONVIDAR MEMBRO
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
                      <TableHead className="font-game text-[10px] tracking-wider">MEMBRO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">NÍVEL</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">STATUS</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider">DEPARTAMENTO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider text-right">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const dept = departments.find(d => d.id === p.department_id);
                      const h = hierarchyLabels[p.hierarchy] || hierarchyLabels.user;
                      return (
                        <TableRow key={p.id} className="border-border/30 hover:bg-primary/5">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 border border-border/30">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-game font-bold">
                                  {p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-body font-semibold">{p.full_name}</p>
                                <p className="text-xs text-muted-foreground">{p.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] font-game tracking-wider ${h.color}`}>{h.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.active ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">
                              {p.active ? 'ATIVO' : 'INATIVO'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-body">{dept?.name || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingProfile({ ...p })}>
                              <Pencil className="w-4 h-4" />
                            </Button>
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

      {/* Edit profile dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">Editar membro</DialogTitle>
          </DialogHeader>
          {editingProfile && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={editingProfile.full_name} onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingProfile.email} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label>Nível de acesso</Label>
                <Select value={editingProfile.hierarchy} onValueChange={(v) => setEditingProfile({ ...editingProfile, hierarchy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner — Acesso total ao sistema</SelectItem>
                    <SelectItem value="gestor">Gestor — Gerencia equipe e documentos</SelectItem>
                    <SelectItem value="user">Usuário — Acesso básico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={editingProfile.department_id || 'none'} onValueChange={(v) => setEditingProfile({ ...editingProfile, department_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={editingProfile.active} onCheckedChange={(v) => setEditingProfile({ ...editingProfile, active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancelar</Button>
            <Button onClick={() => editingProfile && updateProfile.mutate(editingProfile)} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> Convidar membro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={inviteData.full_name} onChange={(e) => setInviteData({ ...inviteData, full_name: e.target.value })} placeholder="João Silva" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={inviteData.email} onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })} placeholder="joao@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Nível de acesso</Label>
              <Select value={inviteData.hierarchy} onValueChange={(v) => setInviteData({ ...inviteData, hierarchy: v as Hierarchy })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner — Acesso total</SelectItem>
                  <SelectItem value="gestor">Gestor — Gerencia equipe</SelectItem>
                  <SelectItem value="user">Usuário — Acesso básico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={inviteData.department_id || 'none'} onValueChange={(v) => setInviteData({ ...inviteData, department_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">O membro receberá um email com link para definir a senha e acessar o sistema.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteData.full_name || !inviteData.email}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
