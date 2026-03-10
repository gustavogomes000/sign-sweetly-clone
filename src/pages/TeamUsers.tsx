import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Loader2, Search, Building2, RefreshCw, Hexagon, Plus, Pencil, Mail, Shield, Key, Lock, Eye, FileText, BarChart3, UserCog, Trash2 } from 'lucide-react';
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

interface Permission {
  permission: string;
  granted: boolean;
}

const hierarchyConfig: Record<string, { label: string; description: string; color: string; icon: typeof Shield }> = {
  owner: { label: 'OWNER', description: 'Acesso total — cria departamentos, gerencia equipe, todas as permissões', color: 'bg-accent text-accent-foreground', icon: Shield },
  gestor: { label: 'GESTOR', description: 'Gerencia equipe e documentos do departamento — configura permissões de usuários', color: 'bg-primary text-primary-foreground', icon: UserCog },
  user: { label: 'USUÁRIO', description: 'Acesso básico — visualiza e cria documentos conforme permissões', color: 'bg-secondary text-secondary-foreground', icon: Eye },
};

// All available permissions organized by category
const permissionCategories = [
  {
    label: 'Documentos',
    icon: FileText,
    permissions: [
      { key: 'documents:create', label: 'Criar documentos', description: 'Enviar novos documentos para assinatura' },
      { key: 'documents:read', label: 'Visualizar documentos', description: 'Ver documentos e seu status' },
      { key: 'documents:update', label: 'Editar documentos', description: 'Alterar documentos existentes' },
      { key: 'documents:delete', label: 'Excluir documentos', description: 'Remover documentos do sistema' },
      { key: 'documents:cancel', label: 'Cancelar documentos', description: 'Cancelar envios pendentes' },
      { key: 'documents:resend', label: 'Reenviar documentos', description: 'Reenviar links de assinatura' },
    ],
  },
  {
    label: 'Contatos',
    icon: Users,
    permissions: [
      { key: 'contacts:create', label: 'Criar contatos', description: 'Adicionar novos contatos' },
      { key: 'contacts:read', label: 'Visualizar contatos', description: 'Ver lista de contatos' },
      { key: 'contacts:update', label: 'Editar contatos', description: 'Alterar dados de contatos' },
      { key: 'contacts:delete', label: 'Excluir contatos', description: 'Remover contatos' },
    ],
  },
  {
    label: 'Templates',
    icon: FileText,
    permissions: [
      { key: 'templates:create', label: 'Criar templates', description: 'Criar modelos de documento' },
      { key: 'templates:read', label: 'Visualizar templates', description: 'Ver templates disponíveis' },
      { key: 'templates:update', label: 'Editar templates', description: 'Alterar templates existentes' },
      { key: 'templates:delete', label: 'Excluir templates', description: 'Remover templates' },
    ],
  },
  {
    label: 'Equipe',
    icon: UserCog,
    permissions: [
      { key: 'team:read', label: 'Visualizar equipe', description: 'Ver membros da equipe' },
      { key: 'team:manage', label: 'Gerenciar equipe', description: 'Convidar e editar membros' },
      { key: 'team:permissions', label: 'Gerenciar permissões', description: 'Definir níveis de acesso' },
    ],
  },
  {
    label: 'Sistema',
    icon: BarChart3,
    permissions: [
      { key: 'analytics:read', label: 'Relatórios', description: 'Visualizar analytics e dashboards' },
      { key: 'settings:manage', label: 'Configurações', description: 'Alterar configurações do sistema' },
    ],
  },
];

const allPermissionKeys = permissionCategories.flatMap(c => c.permissions.map(p => p.key));

// Default permissions by hierarchy
const defaultPermissions: Record<string, string[]> = {
  owner: allPermissionKeys,
  gestor: allPermissionKeys.filter(k => !k.includes('settings:manage')),
  user: ['documents:create', 'documents:read', 'contacts:read', 'templates:read', 'analytics:read'],
};

export default function TeamUsers() {
  const [search, setSearch] = useState('');
  const [hierarchyFilter, setHierarchyFilter] = useState<string>('all');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editTab, setEditTab] = useState('profile');
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [showInvite, setShowInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ full_name: '', email: '', hierarchy: 'user' as Hierarchy, department_id: '' });
  const [inviting, setInviting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  // Load permissions for the editing user
  const { data: userPermissions = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['user-permissions', editingProfile?.id],
    queryFn: async () => {
      if (!editingProfile) return [];
      const { data } = await supabase.from('user_permissions').select('permission, granted').eq('user_id', editingProfile.id);
      return (data || []) as Permission[];
    },
    enabled: !!editingProfile,
  });

  // When editing profile changes, sync permissions
  const openEditDialog = (profile: Profile) => {
    setEditingProfile({ ...profile });
    setEditTab('profile');
    // Permissions will be loaded via the query above
  };

  // Compute effective permissions (user_permissions overrides defaults)
  const getEffectivePermission = (permKey: string): boolean => {
    // Check if there's an explicit override
    if (editPermissions[permKey] !== undefined) return editPermissions[permKey];
    const explicit = userPermissions.find(p => p.permission === permKey);
    if (explicit) return explicit.granted;
    // Default based on hierarchy
    const hierarchy = editingProfile?.hierarchy || 'user';
    return (defaultPermissions[hierarchy] || defaultPermissions.user).includes(permKey);
  };

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
      toast({ title: 'Perfil atualizado ✅' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar', description: String(err), variant: 'destructive' });
    },
  });

  const savePermissions = useMutation({
    mutationFn: async () => {
      if (!editingProfile) return;
      // Get all changed permissions
      const permEntries = Object.entries(editPermissions);
      if (permEntries.length === 0) return;

      for (const [permission, granted] of permEntries) {
        // Upsert each permission
        const { error } = await supabase.from('user_permissions').upsert({
          user_id: editingProfile.id,
          permission,
          granted,
        }, { onConflict: 'user_id,permission' });
        if (error) {
          // If upsert fails (no unique constraint), try delete + insert
          await supabase.from('user_permissions').delete().eq('user_id', editingProfile.id).eq('permission', permission);
          await supabase.from('user_permissions').insert({ user_id: editingProfile.id, permission, granted });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', editingProfile?.id] });
      toast({ title: 'Permissões salvas ✅' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao salvar permissões', description: String(err), variant: 'destructive' });
    },
  });

  const handleSaveAll = async () => {
    if (!editingProfile) return;
    await updateProfile.mutateAsync(editingProfile);
    if (Object.keys(editPermissions).length > 0) {
      await savePermissions.mutateAsync();
    }
    setEditingProfile(null);
    setEditPermissions({});
  };

  const handleResetPassword = async () => {
    if (!editingProfile) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: editingProfile.email,
          full_name: editingProfile.full_name,
          hierarchy: editingProfile.hierarchy,
          department_id: editingProfile.department_id,
          reset_only: true,
        },
      });
      if (error) throw error;
      toast({ title: 'Email de redefinição enviado ✅', description: `Link enviado para ${editingProfile.email}` });
      setShowResetConfirm(false);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteData.full_name || !inviteData.email) return;
    setInviting(true);
    try {
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

      toast({ title: 'Convite enviado ✅', description: `Email enviado para ${inviteData.email}` });
      setShowInvite(false);
      setInviteData({ full_name: '', email: '', hierarchy: 'user', department_id: '' });
      queryClient.invalidateQueries({ queryKey: ['team-profiles'] });
    } catch (err) {
      toast({ title: 'Erro ao convidar', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const togglePermission = (key: string) => {
    const current = getEffectivePermission(key);
    setEditPermissions(prev => ({ ...prev, [key]: !current }));
  };

  const isSaving = updateProfile.isPending || savePermissions.isPending;

  return (
    <>
      <AppHeader title="Equipe" subtitle={`${profiles.length} membros`} />
      <div className="flex-1 overflow-auto p-6 space-y-4 hex-pattern">
        {/* Stats */}
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

        {/* Hierarchy legend */}
        <div className="flex gap-3 flex-wrap">
          {Object.entries(hierarchyConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <Badge className={`${cfg.color} text-[10px] font-game tracking-wider`}>{cfg.label}</Badge>
              <span className="text-muted-foreground font-body">{cfg.description.split('—')[0]}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
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

        {/* Table */}
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
                      <TableHead className="font-game text-[10px] tracking-wider">CADASTRO</TableHead>
                      <TableHead className="font-game text-[10px] tracking-wider text-right">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const dept = departments.find(d => d.id === p.department_id);
                      const h = hierarchyConfig[p.hierarchy] || hierarchyConfig.user;
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
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(p)}>
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

      {/* ─── Full Edit Dialog ─── */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => { if (!open) { setEditingProfile(null); setEditPermissions({}); } }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" />
              {editingProfile?.full_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Edite perfil, nível de acesso e permissões granulares
            </DialogDescription>
          </DialogHeader>

          {editingProfile && (
            <Tabs value={editTab} onValueChange={setEditTab} className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile" className="font-game text-xs tracking-wider">Perfil</TabsTrigger>
                <TabsTrigger value="access" className="font-game text-xs tracking-wider">Acesso</TabsTrigger>
                <TabsTrigger value="permissions" className="font-game text-xs tracking-wider">Permissões</TabsTrigger>
              </TabsList>

              {/* Profile tab */}
              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={editingProfile.full_name} onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editingProfile.email} disabled className="opacity-60" />
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

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Key className="w-4 h-4 text-muted-foreground" /> Senha</Label>
                  <p className="text-xs text-muted-foreground">Envie um link para o usuário redefinir a senha</p>
                  <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)} className="font-game text-xs tracking-wider">
                    <Lock className="w-4 h-4 mr-1" /> Enviar link de redefinição
                  </Button>
                </div>
              </TabsContent>

              {/* Access level tab */}
              <TabsContent value="access" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground font-body">
                  A hierarquia define o nível base de acesso. Permissões individuais podem ser ajustadas na aba "Permissões".
                </p>
                <div className="space-y-3">
                  {Object.entries(hierarchyConfig).map(([key, cfg]) => {
                    const HIcon = cfg.icon;
                    const isSelected = editingProfile.hierarchy === key;
                    return (
                      <Card
                        key={key}
                        className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/50'}`}
                        onClick={() => setEditingProfile({ ...editingProfile, hierarchy: key })}
                      >
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                            <HIcon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge className={`${cfg.color} text-[10px] font-game tracking-wider`}>{cfg.label}</Badge>
                              {isSelected && <Badge variant="outline" className="text-[10px] font-game tracking-wider text-primary border-primary">ATUAL</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 font-body">{cfg.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Permissions tab */}
              <TabsContent value="permissions" className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground font-body">
                  Permissões marcadas em <span className="text-primary font-semibold">verde</span> estão ativas. As padrão vêm da hierarquia ({hierarchyConfig[editingProfile.hierarchy]?.label || 'USUÁRIO'}), mas podem ser personalizadas.
                </p>
                {loadingPerms ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                ) : (
                  permissionCategories.map((cat) => {
                    const CatIcon = cat.icon;
                    return (
                      <div key={cat.label}>
                        <div className="flex items-center gap-2 mb-2">
                          <CatIcon className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-game tracking-wider font-bold">{cat.label.toUpperCase()}</h3>
                        </div>
                        <div className="space-y-1 pl-6">
                          {cat.permissions.map((perm) => {
                            const isGranted = getEffectivePermission(perm.key);
                            return (
                              <div key={perm.key} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-secondary/50">
                                <Checkbox
                                  checked={isGranted}
                                  onCheckedChange={() => togglePermission(perm.key)}
                                  className={isGranted ? 'border-primary data-[state=checked]:bg-primary' : ''}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-body font-medium">{perm.label}</p>
                                  <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <Separator className="my-3" />
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditingProfile(null); setEditPermissions({}); }}>Cancelar</Button>
            <Button onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password confirmation */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">Redefinir senha</DialogTitle>
            <DialogDescription>
              Enviar email de redefinição de senha para <strong>{editingProfile?.email}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
              Enviar
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
              <div className="space-y-2">
                {Object.entries(hierarchyConfig).map(([key, cfg]) => {
                  const isSelected = inviteData.hierarchy === key;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'}`}
                      onClick={() => setInviteData({ ...inviteData, hierarchy: key as Hierarchy })}
                    >
                      <Badge className={`${cfg.color} text-[10px] font-game tracking-wider`}>{cfg.label}</Badge>
                      <span className="text-xs text-muted-foreground font-body flex-1">{cfg.description.split('—')[0]}</span>
                    </div>
                  );
                })}
              </div>
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
            <p className="text-xs text-muted-foreground font-body">O membro receberá um email com link para definir a senha e acessar o sistema.</p>
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
