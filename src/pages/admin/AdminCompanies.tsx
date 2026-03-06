import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Search, Users, FileText, MoreHorizontal, Trash2, Edit, Eye } from 'lucide-react';
import { mockCompanies } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminCompanies() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', cnpj: '', email: '', phone: '', plan: 'starter', maxUsers: '5', maxDocs: '100', adminName: '', adminEmail: '' });
  const { toast } = useToast();

  const filtered = mockCompanies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    toast({ title: 'Empresa criada com sucesso! ✅', description: `${newCompany.name} foi adicionada à plataforma. Login enviado para ${newCompany.adminEmail}.` });
    setCreateOpen(false);
    setNewCompany({ name: '', cnpj: '', email: '', phone: '', plan: 'starter', maxUsers: '5', maxDocs: '100', adminName: '', adminEmail: '' });
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="text-sm text-muted-foreground">{mockCompanies.length} empresas cadastradas</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20"><Plus className="w-4 h-4 mr-1" />Nova empresa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar nova empresa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da empresa</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Razão social *</Label>
                  <Input value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} placeholder="Empresa LTDA" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ *</Label>
                  <Input value={newCompany.cnpj} onChange={e => setNewCompany({...newCompany, cnpj: e.target.value})} placeholder="00.000.000/0001-00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={newCompany.phone} onChange={e => setNewCompany({...newCompany, phone: e.target.value})} placeholder="(11) 0000-0000" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Email da empresa *</Label>
                  <Input type="email" value={newCompany.email} onChange={e => setNewCompany({...newCompany, email: e.target.value})} placeholder="contato@empresa.com" />
                </div>
              </div>

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plano e limites</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Plano</Label>
                  <Select value={newCompany.plan} onValueChange={v => setNewCompany({...newCompany, plan: v})}>
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
                  <Input type="number" value={newCompany.maxUsers} onChange={e => setNewCompany({...newCompany, maxUsers: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Docs/mês</Label>
                  <Input type="number" value={newCompany.maxDocs} onChange={e => setNewCompany({...newCompany, maxDocs: e.target.value})} />
                </div>
              </div>

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin principal</p>
              <p className="text-xs text-muted-foreground">Este usuário receberá o login e poderá criar outros usuários da empresa.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={newCompany.adminName} onChange={e => setNewCompany({...newCompany, adminName: e.target.value})} placeholder="Nome do admin" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={newCompany.adminEmail} onChange={e => setNewCompany({...newCompany, adminEmail: e.target.value})} placeholder="admin@empresa.com" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!newCompany.name || !newCompany.cnpj || !newCompany.adminEmail}>Criar empresa</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
            <SelectItem value="suspended">Suspensas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Companies grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(comp => (
          <Card key={comp.id} className="hover:shadow-md transition-all hover:border-primary/30">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{comp.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{comp.cnpj}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link to={`/admin/companies/${comp.id}`}><Eye className="w-4 h-4 mr-2" />Detalhes</Link></DropdownMenuItem>
                    <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Desativar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Badge variant={comp.status === 'active' ? 'default' : comp.status === 'suspended' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {comp.status === 'active' ? 'Ativa' : comp.status === 'suspended' ? 'Suspensa' : 'Inativa'}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{comp.plan}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{comp.usersCount}/{comp.maxUsers} usuários</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{comp.documentsUsed}/{comp.maxDocumentsMonth} docs</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uso do plano</span>
                  <span>{Math.round(comp.documentsUsed / comp.maxDocumentsMonth * 100)}%</span>
                </div>
                <Progress value={(comp.documentsUsed / comp.maxDocumentsMonth) * 100} className="h-1.5" />
              </div>

              <div className="mt-4">
                <Link to={`/admin/companies/${comp.id}`}>
                  <Button variant="outline" size="sm" className="w-full">Ver detalhes</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
