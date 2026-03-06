import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockApiKeys, mockWebhooks } from '@/data/mockData';
import { Copy, Plus, Eye, EyeOff, Trash2, Code2, ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
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

  const createDocExample = `curl -X POST https://api.valeris.com/v1/documents \\
  -H "Authorization: Bearer sk-live-..." \\
  -H "Content-Type: multipart/form-data" \\
  -F "name=Contrato de Serviço" \\
  -F "file=@contrato.pdf" \\
  -F 'signers=[{"name":"João","email":"joao@email.com","role":"Signatário","validation_steps":["selfie","document_photo"]}]' \\
  -F "signature_type=electronic" \\
  -F "notify_via=email" \\
  -F "deadline=2026-03-20T23:59:59Z"`;

  const sendDocExample = `curl -X POST https://api.valeris.com/v1/documents/doc_abc123/send \\
  -H "Authorization: Bearer sk-live-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Por favor, assine o contrato.",
    "reminder_days": 3
  }'`;

  const webhookPayload = `{
  "event": "document.signed",
  "timestamp": "2026-03-05T14:30:00Z",
  "data": {
    "document_id": "doc_abc123",
    "document_name": "Contrato de Serviço",
    "signer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "signed_at": "2026-03-05T14:30:00Z",
      "validation_completed": ["selfie", "document_photo"],
      "ip": "192.168.1.1"
    }
  }
}`;

  const statusResponseExample = `{
  "id": "doc_abc123",
  "name": "Contrato de Serviço",
  "status": "pending",
  "created_at": "2026-03-04T10:30:00Z",
  "signers": [
    {
      "name": "João Silva",
      "email": "joao@email.com",
      "status": "signed",
      "signed_at": "2026-03-05T14:30:00Z",
      "validation_steps": [
        {"type": "selfie", "status": "completed"},
        {"type": "document_photo", "status": "completed"}
      ]
    },
    {
      "name": "Maria Santos",
      "email": "maria@email.com",
      "status": "pending",
      "validation_steps": [
        {"type": "selfie", "status": "pending"}
      ]
    }
  ],
  "audit_trail": [
    {"action": "created", "actor": "API", "timestamp": "2026-03-04T10:30:00Z"},
    {"action": "signed", "actor": "João Silva", "timestamp": "2026-03-05T14:30:00Z"}
  ]
}`;

  return (
    <>
      <AppHeader title="API & Integrações" subtitle="Integre o SignFlow com seus sistemas" />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="docs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="docs">Documentação</TabsTrigger>
            <TabsTrigger value="keys">Chaves de API</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="sdks">SDKs & Bibliotecas</TabsTrigger>
          </TabsList>

          {/* DOCUMENTATION */}
          <TabsContent value="docs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="w-5 h-5" />API REST — Referência completa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm font-medium text-foreground">Base URL</p>
                  <code className="text-sm font-mono text-primary">https://api.signflow.com/v1</code>
                  <p className="text-xs text-muted-foreground mt-1">Autenticação via header: <code className="bg-secondary px-1 rounded">Authorization: Bearer {'<api_key>'}</code></p>
                </div>

                {/* Endpoints */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Endpoints disponíveis</p>
                  <div className="space-y-1.5">
                    {[
                      { method: 'POST', path: '/v1/documents', desc: 'Criar documento e enviar para assinatura' },
                      { method: 'POST', path: '/v1/documents/upload', desc: 'Upload de arquivo (multipart)' },
                      { method: 'GET', path: '/v1/documents', desc: 'Listar todos os documentos' },
                      { method: 'GET', path: '/v1/documents/:id', desc: 'Detalhes do documento com status dos signatários' },
                      { method: 'GET', path: '/v1/documents/:id/audit', desc: 'Trilha de auditoria completa' },
                      { method: 'GET', path: '/v1/documents/:id/download', desc: 'Download do documento assinado' },
                      { method: 'POST', path: '/v1/documents/:id/send', desc: 'Enviar/reenviar para assinatura' },
                      { method: 'POST', path: '/v1/documents/:id/cancel', desc: 'Cancelar documento' },
                      { method: 'POST', path: '/v1/documents/:id/resend/:signer_id', desc: 'Reenviar para signatário específico' },
                      { method: 'GET', path: '/v1/contacts', desc: 'Listar contatos' },
                      { method: 'POST', path: '/v1/contacts', desc: 'Criar contato' },
                      { method: 'GET', path: '/v1/templates', desc: 'Listar modelos' },
                      { method: 'POST', path: '/v1/templates', desc: 'Criar modelo' },
                      { method: 'GET', path: '/v1/folders', desc: 'Listar pastas' },
                      { method: 'POST', path: '/v1/webhooks', desc: 'Registrar webhook' },
                      { method: 'DELETE', path: '/v1/webhooks/:id', desc: 'Remover webhook' },
                    ].map((endpoint) => (
                      <div key={endpoint.path + endpoint.method} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={cn('font-mono text-[10px] w-16 justify-center',
                          endpoint.method === 'POST' ? 'text-success border-success/30' :
                          endpoint.method === 'GET' ? 'text-info border-info/30' :
                          'text-destructive border-destructive/30'
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

                {/* Create document example */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Exemplo: Criar documento via API</p>
                  <p className="text-xs text-muted-foreground">Envie documentos automaticamente a partir de qualquer sistema.</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{createDocExample}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Exemplo: Enviar documento para assinatura</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{sendDocExample}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Exemplo: Resposta de status do documento</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{statusResponseExample}</pre>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Payload do Webhook</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{webhookPayload}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Eventos de webhook disponíveis</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'document.created', 'document.sent', 'document.viewed',
                      'document.signed', 'document.completed', 'document.refused',
                      'document.expired', 'document.cancelled',
                      'signer.validation.selfie_completed', 'signer.validation.document_completed',
                      'signer.validation.all_completed'
                    ].map((ev) => (
                      <Badge key={ev} variant="secondary" className="text-xs font-mono">{ev}</Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Rate Limits</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-secondary/40 text-center">
                      <p className="text-lg font-bold text-foreground">100</p>
                      <p className="text-muted-foreground">req/min (Starter)</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/40 text-center">
                      <p className="text-lg font-bold text-foreground">500</p>
                      <p className="text-muted-foreground">req/min (Professional)</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/40 text-center">
                      <p className="text-lg font-bold text-foreground">2000</p>
                      <p className="text-muted-foreground">req/min (Enterprise)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API KEYS */}
          <TabsContent value="keys" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Gerencie suas chaves de acesso à API.</p>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova chave</Button>
            </div>
            {mockApiKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{key.name}</p>
                        <Badge variant={key.active ? 'default' : 'secondary'} className="text-[10px]">{key.active ? 'Ativa' : 'Inativa'}</Badge>
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
                      <p className="text-[10px] text-muted-foreground mt-1">Último uso: {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString('pt-BR') : 'Nunca'}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* WEBHOOKS */}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* SDKs */}
          <TabsContent value="sdks" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">SDKs e Bibliotecas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Use nossas bibliotecas oficiais para integrar mais rapidamente.</p>
                {[
                  { lang: 'Node.js / TypeScript', pkg: 'npm install @signflow/sdk', status: 'stable' },
                  { lang: 'Python', pkg: 'pip install signflow-sdk', status: 'stable' },
                  { lang: 'PHP', pkg: 'composer require signflow/sdk', status: 'beta' },
                  { lang: 'Java', pkg: 'Maven: com.signflow:sdk:1.0.0', status: 'beta' },
                  { lang: 'C# / .NET', pkg: 'dotnet add package SignFlow.SDK', status: 'coming soon' },
                ].map(sdk => (
                  <div key={sdk.lang} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{sdk.lang}</p>
                      <code className="text-xs font-mono text-muted-foreground">{sdk.pkg}</code>
                    </div>
                    <Badge variant={sdk.status === 'stable' ? 'default' : sdk.status === 'beta' ? 'secondary' : 'outline'} className="text-[10px]">
                      {sdk.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Exemplo rápido (Node.js)</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`import SignFlow from '@signflow/sdk';

const client = new SignFlow({ apiKey: 'sk-live-...' });

// Criar e enviar documento
const doc = await client.documents.create({
  name: 'Contrato de Serviço',
  file: fs.readFileSync('contrato.pdf'),
  signers: [
    {
      name: 'João Silva',
      email: 'joao@email.com',
      role: 'Signatário',
      validationSteps: ['selfie', 'document_photo']
    }
  ],
  signatureType: 'electronic',
  deadline: '2026-03-20',
});

// Enviar para assinatura
await client.documents.send(doc.id, {
  message: 'Por favor, assine o contrato.',
  reminderDays: 3,
});

// Consultar status
const status = await client.documents.get(doc.id);
console.log(status.signers[0].status); // 'signed'`}</pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
