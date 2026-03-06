import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Building2, Users, FileText, Plus, MoreHorizontal, Trash2, Edit, Shield, User, Key } from 'lucide-react';
import { mockCompanies, mockCompanyUsers } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { mockApiKeys } from '@/data/mockData';

export default function AdminCompanyDetail() {
  const { id } = useParams();
  const company = mockCompanies.find(c => c.id === id);
  const users = mockCompanyUsers.filter(u => u.companyId === id);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'company_user' });
  const { toast } = useToast();

  if (!company) {
    return <div className="p-6"><p>Empresa não encontrada.</p></div>;
  }

  const handleCreateUser = () => {
    toast({ title: 'Usuário criado! ✅', description: `Login enviado para ${newUser.email}` });
    setCreateUserOpen(false);
    setNewUser({ name: '', email: '', role: 'company_user' });
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <Link to="/admin/companies" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar para empresas
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{company.cnpj}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={company.status === 'active' ? 'default' : 'destructive'} className="text-xs">
            {company.status === 'active' ? 'Ativa' : 'Suspensa'}
          </Badge>
          <Badge variant="outline" className="text-xs capitalize">{company.plan}</Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{company.usersCount}</p>
            <p className="text-xs text-muted-foreground">Usuários</p>
            <p className="text-[10px] text-muted-foreground">máx. {company.maxUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{company.documentsUsed}</p>
            <p className="text-xs text-muted-foreground">Documentos (mês)</p>
            <Progress value={(company.documentsUsed / company.maxDocumentsMonth) * 100} className="h-1 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{company.maxDocumentsMonth}</p>
            <p className="text-xs text-muted-foreground">Limite mensal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary capitalize">{company.plan}</p>
            <p className="text-xs text-muted-foreground">Plano ativo</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="api">Integrações API</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
            <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo usuário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar usuário</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email *</Label>
                    <Input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="usuario@empresa.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Perfil</Label>
                    <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company_admin">Administrador</SelectItem>
                        <SelectItem value="company_user">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">O usuário receberá um email com as credenciais de acesso.</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateUserOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreateUser} disabled={!newUser.name || !newUser.email}>Criar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <div className="divide-y divide-border">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      u.role === 'company_admin' ? 'bg-primary/10' : 'bg-secondary'
                    )}>
                      {u.role === 'company_admin' ? <Shield className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.role === 'company_admin' ? 'default' : 'secondary'} className="text-[10px]">
                      {u.role === 'company_admin' ? 'Admin' : 'Usuário'}
                    </Badge>
                    <Badge variant={u.status === 'active' ? 'outline' : 'secondary'} className="text-[10px]">
                      {u.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem><Key className="w-4 h-4 mr-2" />Resetar senha</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Desativar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações da empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Razão social</Label>
                  <Input defaultValue={company.name} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ</Label>
                  <Input defaultValue={company.cnpj} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input defaultValue={company.email} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input defaultValue={company.phone || ''} />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Plano</Label>
                  <Select defaultValue={company.plan}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máx. usuários</Label>
                  <Input type="number" defaultValue={company.maxUsers} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Docs/mês</Label>
                  <Input type="number" defaultValue={company.maxDocumentsMonth} />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Status da empresa</p>
                  <p className="text-xs text-muted-foreground">Ativar ou suspender acesso</p>
                </div>
                <Switch defaultChecked={company.status === 'active'} />
              </div>
              <div className="flex justify-end">
                <Button>Salvar alterações</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Chaves de API da empresa</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Chaves para integração com sistemas externos desta empresa.</p>
              {mockApiKeys.map(key => (
                <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <code className="text-xs font-mono text-muted-foreground">{key.key.replace(/(.{10}).*/, '$1••••••••••')}</code>
                  </div>
                  <Badge variant={key.active ? 'default' : 'secondary'} className="text-[10px]">{key.active ? 'Ativa' : 'Inativa'}</Badge>
                </div>
              ))}
              <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-1" />Gerar nova chave</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
