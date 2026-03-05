import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockApiKeys, mockWebhooks } from '@/data/mockData';
import { Copy, Plus, Eye, EyeOff, Trash2, ExternalLink, Code2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function ApiDocs() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const toggleKeyVisibility = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: 'Copiado!', description: 'Chave copiada para a área de transferência.' });
  };

  const codeExample = `curl -X POST https://api.signflow.com/v1/documents \\
  -H "Authorization: Bearer sk-live-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Contrato de Serviço",
    "signers": [
      { "name": "João", "email": "joao@email.com" }
    ],
    "file_url": "https://exemplo.com/contrato.pdf"
  }'`;

  const webhookExample = `{
  "event": "document.signed",
  "data": {
    "document_id": "doc_abc123",
    "signer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "signed_at": "2026-03-05T14:30:00Z"
    }
  }
}`;

  return (
    <>
      <AppHeader title="API & Webhooks" subtitle="Integre o SignFlow com suas aplicações" />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="keys" className="space-y-6">
          <TabsList>
            <TabsTrigger value="keys">Chaves de API</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="docs">Documentação</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Gerencie suas chaves de acesso à API.</p>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova chave</Button>
            </div>
            {mockApiKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{key.name}</p>
                          <Badge variant={key.active ? 'default' : 'secondary'} className="text-[10px]">
                            {key.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">
                            {showKey[key.id] ? key.key : key.key.replace(/(.{10}).*/, '$1••••••••••')}
                          </code>
                          <button onClick={() => toggleKeyVisibility(key.id)} className="text-muted-foreground hover:text-foreground">
                            {showKey[key.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => copyKey(key.key)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Último uso: {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString('pt-BR') : 'Nunca'}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Receba notificações em tempo real sobre eventos.</p>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo webhook</Button>
            </div>
            {mockWebhooks.map((wh) => (
              <Card key={wh.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono">{wh.url}</code>
                        <Switch checked={wh.active} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        {wh.events.map((ev) => (
                          <Badge key={ev} variant="outline" className="text-[10px]">{ev}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="docs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="w-5 h-5" />
                  Referência rápida da API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  A API do SignFlow permite criar, enviar e gerenciar documentos programaticamente.
                </p>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Endpoints principais:</p>
                  <div className="space-y-1.5">
                    {[
                      { method: 'POST', path: '/v1/documents', desc: 'Criar documento' },
                      { method: 'GET', path: '/v1/documents', desc: 'Listar documentos' },
                      { method: 'GET', path: '/v1/documents/:id', desc: 'Detalhes do documento' },
                      { method: 'POST', path: '/v1/documents/:id/send', desc: 'Enviar para assinatura' },
                      { method: 'POST', path: '/v1/documents/:id/cancel', desc: 'Cancelar documento' },
                      { method: 'POST', path: '/v1/documents/:id/resend', desc: 'Reenviar notificação' },
                      { method: 'GET', path: '/v1/contacts', desc: 'Listar contatos' },
                      { method: 'POST', path: '/v1/templates', desc: 'Criar modelo' },
                    ].map((endpoint) => (
                      <div key={endpoint.path + endpoint.method} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={cn('font-mono text-[10px] w-12 justify-center',
                          endpoint.method === 'POST' ? 'text-success border-success/30' : 'text-info border-info/30'
                        )}>
                          {endpoint.method}
                        </Badge>
                        <code className="font-mono text-foreground">{endpoint.path}</code>
                        <span className="text-muted-foreground">— {endpoint.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Exemplo: Criar documento</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto">
                    {codeExample}
                  </pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Exemplo: Payload do webhook</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto">
                    {webhookExample}
                  </pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Eventos de webhook disponíveis:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['document.created', 'document.sent', 'document.viewed', 'document.signed', 'document.completed', 'document.refused', 'document.expired', 'document.cancelled'].map((ev) => (
                      <Badge key={ev} variant="secondary" className="text-xs font-mono">{ev}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
