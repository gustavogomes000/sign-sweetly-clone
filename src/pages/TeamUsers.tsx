import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, MoreHorizontal, Shield, ShieldCheck, User, Loader2, Pencil, Trash2, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  hierarchy: string;
  department_id: string | null;
  active: boolean;
  created_at: string;
  avatar_url: string | null;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface Permission {
  permission: string;
  granted: boolean;
}

const ALL_PERMISSIONS = [
  { key: 'documents:read', label: 'Ver documentos', group: 'Documentos' },
  { key: 'documents:write', label: 'Criar/editar documentos', group: 'Documentos' },
  { key: 'documents:delete', label: 'Excluir documentos', group: 'Documentos' },
  { key: 'documents:send', label: 'Enviar para assinatura', group: 'Documentos' },
  { key: 'contacts:read', label: 'Ver contatos', group: 'Contatos' },
  { key: 'contacts:write', label: 'Criar/editar contatos', group: 'Contatos' },
  { key: 'templates:read', label: 'Ver modelos', group: 'Modelos' },
  { key: 'templates:write', label: 'Criar/editar modelos', group: 'Modelos' },
  { key: 'folders:read', label: 'Ver pastas', group: 'Pastas' },
  { key: 'folders:write', label: 'Criar/editar pastas', group: 'Pastas' },
  { key: 'analytics:read', label: 'Ver relatórios', group: 'Relatórios' },
  { key: 'integrations:read', label: 'Ver integrações', group: 'Integrações' },
  { key: 'integrations:write', label: 'Gerenciar integrações', group: 'Integrações' },
  { key: 'team:read', label: 'Ver equipe', group: 'Equipe' },
  { key: 'team:write', label: 'Gerenciar equipe', group: 'Equipe' },
  { key: 'departments:read', label: 'Ver departamentos', group: 'Departamentos' },
  { key: 'departments:write', label: 'Gerenciar departamentos', group: 'Departamentos' },
  { key: 'settings:read', label: 'Ver configurações', group: 'Configurações' },
  { key: 'settings:write', label: 'Alterar configurações', group: 'Configurações' },
];

const HIERARCHY_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  gestor: 'Gestor',
  user: 'Usuário',
};

const HIERARCHY_COLORS: Record<string, string> = {
  owner: 'bg-primary text-primary-foreground',
  gestor: 'bg-accent text-accent-foreground',
  user: 'bg-secondary text-secondary-foreground',
};

const HIERARCHY_ICONS: Record<string, typeof Shield> = {
  owner: ShieldCheck,
  gestor: Shield,
  user: User,
};

export default function TeamUsers() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  // Create form
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formHierarchy, setFormHierarchy] = useState('user');
  const [formDepartment, setFormDepartment] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, deptsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('departments').select('*').order('name'),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data as unknown as Profile[]);
    if (deptsRes.data) setDepartments(deptsRes.data as unknown as Department[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateUser = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) return;
    setSaving(true);

    // Create auth user via edge function or direct signup
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formEmail.trim(),
      password: formPassword.trim(),
      options: { data: { full_name: formName.trim() } },
    });

    if (authError || !authData.user) {
      toast.error(authError?.message || 'Erro ao criar usuário');
      setSaving(false);
      return;
    }

    // Update profile hierarchy and department
    const updates: Record<string, unknown> = { hierarchy: formHierarchy };
    if (formDepartment) updates.department_id = formDepartment;

    await supabase.from('profiles').update(updates).eq('id', authData.user.id);

    toast.success('Usuário criado com sucesso');
    setSaving(false);
    setCreateOpen(false);
    setFormName(''); setFormEmail(''); setFormPassword(''); setFormHierarchy('user'); setFormDepartment('');
    fetchData();
  };

  const openPermissions = async (profile: Profile) => {
    setSelectedUser(profile);
    const { data } = await supabase
      .from('user_permissions')
      .select('permission, granted')
      .eq('user_id', profile.id);
    
    const permsMap = new Map((data || []).map((p: { permission: string; granted: boolean }) => [p.permission, p.granted]));
    
    // Build full permissions list with defaults
    const isManager = profile.hierarchy === 'owner' || profile.hierarchy === 'gestor';
    const fullPerms = ALL_PERMISSIONS.map(p => ({
      permission: p.key,
      granted: permsMap.has(p.key) ? permsMap.get(p.key)! : isManager,
    }));
    
    setUserPermissions(fullPerms);
    setPermissionsOpen(true);
  };

  const togglePermission = (permKey: string) => {
    setUserPermissions(prev => prev.map(p =>
      p.permission === permKey ? { ...p, granted: !p.granted } : p
    ));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);

    // Upsert all permissions
    for (const perm of userPermissions) {
      await supabase.from('user_permissions').upsert({
        user_id: selectedUser.id,
        permission: perm.permission,
        granted: perm.granted,
        granted_by: user?.id,
      }, { onConflict: 'user_id,permission' });
    }

    toast.success('Permissões atualizadas');
    setSaving(false);
    setPermissionsOpen(false);
  };

  const updateHierarchy = async (profile: Profile, newHierarchy: string) => {
    await supabase.from('profiles').update({ hierarchy: newHierarchy }).eq('id', profile.id);
    toast.success('Hierarquia atualizada');
    fetchData();
  };

  const toggleActive = async (profile: Profile) => {
    await supabase.from('profiles').update({ active: !profile.active }).eq('id', profile.id);
    toast.success(profile.active ? 'Usuário desativado' : 'Usuário ativado');
    fetchData();
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return '—';
    return departments.find(d => d.id === deptId)?.name || '—';
  };

  return (
    <>
      <AppHeader title="Equipe" subtitle={`${profiles.length} usuários`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {['owner', 'gestor', 'user'].map(h => {
              const count = profiles.filter(p => p.hierarchy === h).length;
              const Icon = HIERARCHY_ICONS[h];
              return (
                <Card key={h} className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{HIERARCHY_LABELS[h]}</span>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Novo usuário
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Hierarquia</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const Icon = HIERARCHY_ICONS[profile.hierarchy] || User;
                    return (
                      <TableRow key={profile.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground">
                              {profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{profile.full_name}</p>
                              <p className="text-xs text-muted-foreground">{profile.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={HIERARCHY_COLORS[profile.hierarchy]}>
                            <Icon className="w-3 h-3 mr-1" />
                            {HIERARCHY_LABELS[profile.hierarchy] || profile.hierarchy}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getDepartmentName(profile.department_id)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={profile.active ? 'default' : 'secondary'}>
                            {profile.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openPermissions(profile)}>
                                <Key className="w-4 h-4 mr-2" />Permissões
                              </DropdownMenuItem>
                              {profile.hierarchy !== 'owner' && (
                                <>
                                  <DropdownMenuItem onClick={() => updateHierarchy(profile, profile.hierarchy === 'gestor' ? 'user' : 'gestor')}>
                                    <Shield className="w-4 h-4 mr-2" />
                                    {profile.hierarchy === 'gestor' ? 'Rebaixar para Usuário' : 'Promover a Gestor'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleActive(profile)}>
                                    <User className="w-4 h-4 mr-2" />
                                    {profile.active ? 'Desativar' : 'Ativar'}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Cadastre um novo membro da equipe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@empresa.com" />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Senha inicial" />
            </div>
            <div>
              <Label>Hierarquia</Label>
              <Select value={formHierarchy} onValueChange={setFormHierarchy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={formDepartment} onValueChange={setFormDepartment}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={!formName.trim() || !formEmail.trim() || !formPassword.trim() || saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Permissões — {selectedUser?.full_name}
            </DialogTitle>
            <DialogDescription>
              Defina o que este usuário pode acessar no sistema.
              {selectedUser?.hierarchy === 'owner' && (
                <span className="block mt-1 text-primary font-medium">Proprietários têm acesso total por padrão.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4 pr-1">
            {Object.entries(
              ALL_PERMISSIONS.reduce((acc, p) => {
                if (!acc[p.group]) acc[p.group] = [];
                acc[p.group].push(p);
                return acc;
              }, {} as Record<string, typeof ALL_PERMISSIONS>)
            ).map(([group, perms]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                <div className="space-y-2">
                  {perms.map(p => {
                    const userPerm = userPermissions.find(up => up.permission === p.key);
                    return (
                      <div key={p.key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <span className="text-sm">{p.label}</span>
                        <Switch
                          checked={userPerm?.granted ?? false}
                          onCheckedChange={() => togglePermission(p.key)}
                          disabled={selectedUser?.hierarchy === 'owner'}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsOpen(false)}>Cancelar</Button>
            <Button onClick={savePermissions} disabled={saving || selectedUser?.hierarchy === 'owner'}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
