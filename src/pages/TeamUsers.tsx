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
  nome_completo: string;
  email: string;
  hierarquia: string;
  ativo: boolean;
  avatar_url: string | null;
  departamento_id: string | null;
  criado_em: string;
}

interface Department {
  id: string;
  nome: string;
}

interface Permission {
  permissao: string;
  concedida: boolean;
}

const hierarchyConfig: Record<string, { label: string; description: string; color: string; icon: typeof Shield }> = {
  owner: { label: 'OWNER', description: 'Acesso total — cria departamentos, gerencia equipe, todas as permissões', color: 'bg-accent text-accent-foreground', icon: Shield },
  gestor: { label: 'GESTOR', description: 'Gerencia equipe e documentos do departamento — configura permissões de usuários', color: 'bg-primary text-primary-foreground', icon: UserCog },
  user: { label: 'USUÁRIO', description: 'Acesso básico — visualiza e cria documentos conforme permissões', color: 'bg-secondary text-secondary-foreground', icon: Eye },
};

const permissionCategories = [
  {
    label: 'Documentos', icon: FileText,
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
    label: 'Contatos', icon: Users,
    permissions: [
      { key: 'contacts:create', label: 'Criar contatos', description: 'Adicionar novos contatos' },
      { key: 'contacts:read', label: 'Visualizar contatos', description: 'Ver lista de contatos' },
      { key: 'contacts:update', label: 'Editar contatos', description: 'Alterar dados de contatos' },
      { key: 'contacts:delete', label: 'Excluir contatos', description: 'Remover contatos' },
    ],
  },
  {
    label: 'Templates', icon: FileText,
    permissions: [
      { key: 'templates:create', label: 'Criar templates', description: 'Criar modelos de documento' },
      { key: 'templates:read', label: 'Visualizar templates', description: 'Ver templates disponíveis' },
      { key: 'templates:update', label: 'Editar templates', description: 'Alterar templates existentes' },
      { key: 'templates:delete', label: 'Excluir templates', description: 'Remover templates' },
    ],
  },
  {
    label: 'Equipe', icon: UserCog,
    permissions: [
      { key: 'team:read', label: 'Visualizar equipe', description: 'Ver membros da equipe' },
      { key: 'team:manage', label: 'Gerenciar equipe', description: 'Convidar e editar membros' },
      { key: 'team:permissions', label: 'Gerenciar permissões', description: 'Definir níveis de acesso' },
    ],
  },
  {
    label: 'Sistema', icon: BarChart3,
    permissions: [
      { key: 'analytics:read', label: 'Relatórios', description: 'Visualizar analytics e dashboards' },
      { key: 'settings:manage', label: 'Configurações', description: 'Alterar configurações do sistema' },
    ],
  },
];

const allPermissionKeys = permissionCategories.flatMap(c => c.permissions.map(p => p.key));

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
  const [inviteData, setInviteData] = useState({ nome_completo: '', email: '', hierarquia: 'user' as Hierarchy, departamento_id: '' });
  const [inviting, setInviting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['team-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('*').order('nome_completo');
      if (error) throw error;
      return data as Profile[];
    },
    staleTime: 30_000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const { data } = await supabase.from('departamentos').select('id, nome').order('nome');
      return (data || []) as Department[];
    },
  });

  const { data: userPermissions = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['user-permissions', editingProfile?.id],
    queryFn: async () => {
      if (!editingProfile) return [];
      const { data } = await supabase.from('permissoes_usuario').select('permissao, concedida').eq('usuario_id', editingProfile.id);
      return (data || []) as Permission[];
    },
    enabled: !!editingProfile,
  });

  const openEditDialog = (profile: Profile) => {
    setEditingProfile({ ...profile });
    setEditTab('profile');
  };

  const getEffectivePermission = (permKey: string): boolean => {
    if (editPermissions[permKey] !== undefined) return editPermissions[permKey];
    const explicit = userPermissions.find(p => p.permissao === permKey);
    if (explicit) return explicit.concedida;
    const hierarchy = editingProfile?.hierarquia || 'user';
    return (defaultPermissions[hierarchy] || defaultPermissions.user).includes(permKey);
  };

  const filtered = profiles.filter((p) => {
    const matchSearch = !search || p.nome_completo.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase());
    const matchHierarchy = hierarchyFilter === 'all' || p.hierarquia === hierarchyFilter;
    return matchSearch && matchHierarchy;
  });

  const activeCount = profiles.filter(p => p.ativo).length;
  const gestorCount = profiles.filter(p => p.hierarquia === 'gestor').length;
  const ownerCount = profiles.filter(p => p.hierarquia === 'owner').length;

  const updateProfile = useMutation({
    mutationFn: async (profile: Profile) => {
      const { error } = await supabase.from('perfis').update({
        nome_completo: profile.nome_completo,
        hierarquia: profile.hierarquia,
        ativo: profile.ativo,
        departamento_id: profile.departamento_id || null,
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
      const permEntries = Object.entries(editPermissions);
      if (permEntries.length === 0) return;

      for (const [permission, granted] of permEntries) {
        const { error } = await supabase.from('permissoes_usuario').upsert({
          usuario_id: editingProfile.id,
          permissao: permission,
          concedida: granted,
        }, { onConflict: 'usuario_id,permissao' });
        if (error) {
          await supabase.from('permissoes_usuario').delete().eq('usuario_id', editingProfile.id).eq('permissao', permission);
          await supabase.from('permissoes_usuario').insert({ usuario_id: editingProfile.id, permissao: permission, concedida: granted });
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
          full_name: editingProfile.nome_completo,
          hierarchy: editingProfile.hierarquia,
          department_id: editingProfile.departamento_id,
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
    if (!inviteData.nome_completo || !inviteData.email) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteData.email,
          full_name: inviteData.nome_completo,
          hierarchy: inviteData.hierarquia,
          department_id: inviteData.departamento_id || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Convite enviado ✅', description: `Email enviado para ${inviteData.email}` });
      setShowInvite(false);
      setInviteData({ nome_completo: '', email: '', hierarquia: 'user', departamento_id: '' });
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
      <div className="flex-1 overflow-auto p-6 space-y-4">
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
                      const dept = departments.find(d => d.id === p.departamento_id);
                      const h = hierarchyConfig[p.hierarquia] || hierarchyConfig.user;
                      return (
                        <TableRow key={p.id} className="border-border/30 hover:bg-primary/5">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 border border-border/30">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-game font-bold">
                                  {p.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-body font-semibold">{p.nome_completo}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="w-3 h-3" />{p.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${h.color} text-[10px] font-game tracking-wider`}>{h.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[10px] font-game tracking-wider">
                              {p.ativo ? 'ATIVO' : 'INATIVO'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-body">{dept?.nome || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="font-game text-xs tracking-wider" onClick={() => openEditDialog(p)}>
                              <Pencil className="w-3.5 h-3.5 mr-1" /> EDITAR
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

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => { if (!open) { setEditingProfile(null); setEditPermissions({}); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">EDITAR MEMBRO</DialogTitle>
          </DialogHeader>
          {editingProfile && (
            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList className="w-full">
                <TabsTrigger value="profile" className="flex-1">Perfil</TabsTrigger>
                <TabsTrigger value="permissions" className="flex-1">Permissões</TabsTrigger>
                <TabsTrigger value="security" className="flex-1">Segurança</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={editingProfile.nome_completo} onChange={(e) => setEditingProfile({ ...editingProfile, nome_completo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editingProfile.email} disabled className="opacity-60" />
                </div>
                <div className="space-y-2">
                  <Label>Hierarquia</Label>
                  <Select value={editingProfile.hierarquia} onValueChange={(v) => setEditingProfile({ ...editingProfile, hierarquia: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={editingProfile.departamento_id || 'none'} onValueChange={(v) => setEditingProfile({ ...editingProfile, departamento_id: v === 'none' ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch checked={editingProfile.ativo} onCheckedChange={(v) => setEditingProfile({ ...editingProfile, ativo: v })} />
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4 mt-4">
                {loadingPerms ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                ) : (
                  permissionCategories.map((cat) => (
                    <div key={cat.label} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold">{cat.label}</p>
                      </div>
                      <div className="space-y-1 pl-6">
                        {cat.permissions.map((perm) => (
                          <div key={perm.key} className="flex items-center justify-between py-1">
                            <div>
                              <p className="text-sm">{perm.label}</p>
                              <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                            </div>
                            <Checkbox checked={getEffectivePermission(perm.key)} onCheckedChange={() => togglePermission(perm.key)} />
                          </div>
                        ))}
                      </div>
                      <Separator />
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="security" className="space-y-4 mt-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-warning" />
                      <p className="text-sm font-semibold">Redefinir senha</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Envia um email com link para redefinição de senha.</p>
                    <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)}>
                      <Key className="w-4 h-4 mr-1" />Enviar email de redefinição
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => { setEditingProfile(null); setEditPermissions({}); }}>Cancelar</Button>
                <Button onClick={handleSaveAll} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Salvar alterações
                </Button>
              </DialogFooter>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password confirmation */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar redefinição</DialogTitle>
            <DialogDescription>Um email será enviado para {editingProfile?.email} com um link de redefinição.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">CONVIDAR MEMBRO</DialogTitle>
            <DialogDescription>O membro receberá um email com credenciais de acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={inviteData.nome_completo} onChange={(e) => setInviteData({ ...inviteData, nome_completo: e.target.value })} placeholder="João Silva" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={inviteData.email} onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })} placeholder="joao@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Hierarquia</Label>
              <Select value={inviteData.hierarquia} onValueChange={(v: Hierarchy) => setInviteData({ ...inviteData, hierarquia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={inviteData.departamento_id || 'none'} onValueChange={(v) => setInviteData({ ...inviteData, departamento_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteData.nome_completo || !inviteData.email}>
              {inviting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}