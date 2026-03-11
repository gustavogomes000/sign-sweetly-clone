import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { Hexagon, Zap, Settings, User, Bell, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { user } = useAuth();
  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'US';

  return (
    <>
      <AppHeader title="Configurações" />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="profile" className="text-xs tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><User className="w-3 h-3 mr-1" />PERFIL</TabsTrigger>
            <TabsTrigger value="account" className="text-xs tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Settings className="w-3 h-3 mr-1" />CONTA</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Bell className="w-3 h-3 mr-1" />NOTIFICAÇÕES</TabsTrigger>
            <TabsTrigger value="api" className="text-xs tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Code2 className="w-3 h-3 mr-1" />API</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border rounded-xl bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" />
                    <CardTitle className="text-sm tracking-wider">INFORMAÇÕES PESSOAIS</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 border-2 border-primary/30">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{userInitials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{user?.name || 'Usuário'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <Button variant="outline" size="sm" className="ml-auto">Alterar foto</Button>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground tracking-wider">NOME</Label>
                      <Input defaultValue={user?.name?.split(' ')[0] || ''} className="bg-secondary/50 border-border/50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground tracking-wider">SOBRENOME</Label>
                      <Input defaultValue={user?.name?.split(' ').slice(1).join(' ') || ''} className="bg-secondary/50 border-border/50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground tracking-wider">EMAIL</Label>
                      <Input type="email" defaultValue={user?.email || ''} className="bg-secondary/50 border-border/50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground tracking-wider">TELEFONE</Label>
                      <Input defaultValue="" placeholder="(11) 99999-0000" className="bg-secondary/50 border-border/50" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button className="bg-primary text-primary-foreground  text-xs tracking-wider">SALVAR</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="account">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border rounded-xl bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Hexagon className="w-4 h-4 text-primary/40" strokeWidth={1.5} />
                    <CardTitle className="text-sm tracking-wider">DADOS DA EMPRESA</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground tracking-wider">RAZÃO SOCIAL</Label>
                    <Input defaultValue="" placeholder="Razão Social" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground tracking-wider">CNPJ</Label>
                    <Input defaultValue="" placeholder="00.000.000/0001-00" className="bg-secondary/50 border-border/50" />
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex justify-end">
                    <Button className="bg-primary text-primary-foreground  text-xs tracking-wider">SALVAR</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="notifications">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border rounded-xl bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-warning" />
                    <CardTitle className="text-sm tracking-wider">PREFERÊNCIAS</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    'Documento assinado por todos os signatários',
                    'Signatário visualizou o documento',
                    'Signatário recusou assinar',
                    'Documento próximo do prazo',
                    'Documento expirado',
                  ].map((item) => (
                    <div key={item} className="flex items-center justify-between py-1">
                      <span className="text-sm text-foreground">{item}</span>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="api">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border rounded-xl bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-info" />
                    <CardTitle className="text-sm tracking-wider">CHAVES DE API</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Use sua chave de API para integrar com outros sistemas.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground tracking-wider">CHAVE DE ACESSO</Label>
                    <div className="flex gap-2">
                      <Input value="sk-live-••••••••••••••••" readOnly className="font-mono text-sm bg-secondary/50 border-border/50" />
                      <Button variant="outline" size="sm" className="">Copiar</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground tracking-wider">WEBHOOK URL</Label>
                    <Input placeholder="https://seusite.com/webhook" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="flex justify-end">
                    <Button className="bg-primary text-primary-foreground  text-xs tracking-wider">SALVAR</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
