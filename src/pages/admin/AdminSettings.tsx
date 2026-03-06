import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettings() {
  const { toast } = useToast();

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações da Plataforma</h1>
        <p className="text-sm text-muted-foreground font-body">Configurações globais do Valeris</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="microservices">Microsserviços</TabsTrigger>
          <TabsTrigger value="plans">Planos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações gerais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Nome da plataforma</Label>
                <Input defaultValue="Valeris" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL base da API</Label>
                <Input defaultValue="https://api.signflow.com/v1" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Modo manutenção</p>
                  <p className="text-xs text-muted-foreground">Bloquear acesso de empresas temporariamente</p>
                </div>
                <Switch />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => toast({ title: 'Salvo!' })}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="microservices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">URLs dos Microsserviços</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure os endpoints dos microsserviços externos que serão consumidos pela plataforma.</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Microsserviço de Assinatura</Label>
                  <Input placeholder="https://api.seuservico.com/signature" defaultValue="" />
                  <p className="text-[10px] text-muted-foreground">Componente/API que renderiza a tela de assinatura</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Microsserviço de Coleta de Documento</Label>
                  <Input placeholder="https://api.seuservico.com/document-collection" defaultValue="" />
                  <p className="text-[10px] text-muted-foreground">API para captura de foto do documento (RG/CNH/CPF)</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Microsserviço de Selfie</Label>
                  <Input placeholder="https://api.seuservico.com/selfie" defaultValue="" />
                  <p className="text-[10px] text-muted-foreground">API para captura de selfie do signatário</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Microsserviço de Selfie com Documento</Label>
                  <Input placeholder="https://api.seuservico.com/selfie-document" defaultValue="" />
                  <p className="text-[10px] text-muted-foreground">API para captura de selfie segurando documento</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Usar mocks (desenvolvimento)</p>
                  <p className="text-xs text-muted-foreground">Simular chamadas sem microsserviço real</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => toast({ title: 'Microsserviços configurados!' })}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Planos disponíveis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'Starter', users: 5, docs: 100, price: 'R$ 99/mês' },
                { name: 'Professional', users: 20, docs: 500, price: 'R$ 299/mês' },
                { name: 'Enterprise', users: 50, docs: 1000, price: 'R$ 799/mês' },
              ].map(plan => (
                <div key={plan.name} className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.users} usuários · {plan.docs} docs/mês</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{plan.price}</p>
                    <Button variant="outline" size="sm" className="mt-1">Editar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
