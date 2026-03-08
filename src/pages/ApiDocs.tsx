import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Plus, Eye, EyeOff, Trash2, Code2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-gateway`;

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

// Generate API key
async function generateApiKey(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'sk_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ApiDocs() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['document.signed', 'document.completed']);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [keysRes, whRes] = await Promise.all([
      supabase.from('api_keys').select('id, name, key_prefix, scopes, active, last_used_at, created_at').order('created_at', { ascending: false }),
      supabase.from('webhooks').select('*').order('created_at', { ascending: false }),
    ]);
    setApiKeys((keysRes.data || []) as ApiKey[]);
    setWebhooks((whRes.data || []) as Webhook[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateKey = async () => {
    if (!user || !newKeyName.trim()) return;
    const rawKey = await generateApiKey();
    const keyHash = await hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10);

    const { error } = await supabase.from('api_keys').insert({
      user_id: user.id,
      name: newKeyName.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: ['documents:read', 'documents:write'],
    });

    if (error) {
      toast({ title: 'Erro ao criar chave', variant: 'destructive' });
      return;
    }

    setNewKeyRevealed(rawKey);
    setNewKeyName('');
    loadData();
    toast({ title: 'Chave criada com sucesso! ✓', description: 'Copie a chave agora — ela não será exibida novamente.' });
  };

  const handleDeleteKey = async (id: string) => {
    await supabase.from('api_keys').delete().eq('id', id);
    loadData();
    toast({ title: 'Chave removida ✓' });
  };

  const handleCreateWebhook = async () => {
    if (!user || !newWebhookUrl.trim()) return;
    const { error } = await supabase.from('webhooks').insert({
      user_id: user.id,
      url: newWebhookUrl.trim(),
      events: newWebhookEvents,
      secret: crypto.randomUUID(),
      active: true,
    });

    if (error) {
      toast({ title: 'Erro ao criar webhook', variant: 'destructive' });
      return;
    }

    setNewWebhookUrl('');
    setCreateWebhookOpen(false);
    loadData();
    toast({ title: 'Webhook registrado ✓' });
  };

  const handleDeleteWebhook = async (id: string) => {
    await supabase.from('webhooks').delete().eq('id', id);
    loadData();
    toast({ title: 'Webhook removido ✓' });
  };

  const handleToggleWebhook = async (id: string, active: boolean) => {
    await supabase.from('webhooks').update({ active }).eq('id', id);
    loadData();
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado! ✓' });
  };

  const allEvents = [
    'document.signed', 'document.completed', 'document.cancelled',
    'signer.signed', 'signer.refused', '*',
  ];

  const toggleEvent = (ev: string) => {
    setNewWebhookEvents(prev =>
      prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]
    );
  };

  const createDocExample = `curl -X POST ${API_BASE}/documents \\
  -H "x-api-key: sk_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Contrato de Prestação de Serviços",
    "signature_type": "electronic",
    "deadline": "2026-03-20T23:59:59Z",
    "callback_url": "https://meusite.com/webhook",
    "signers": [
      {
        "name": "João Silva",
        "email": "joao@email.com",
        "role": "Contratante"
      },
      {
        "name": "Maria Santos",
        "email": "maria@email.com",
        "role": "Contratada"
      }
    ],
    "fields": [
      {
        "signer_index": 0,
        "type": "signature",
        "page": 1,
        "x": 100,
        "y": 700,
        "width": 200,
        "height": 60
      }
    ]
  }'`;

  const listDocsExample = `curl -X GET "${API_BASE}/documents?status=pending&limit=10" \\
  -H "x-api-key: sk_sua_chave_aqui"`;

  const getStatusExample = `curl -X GET "${API_BASE}/documents/{document_id}/status" \\
  -H "x-api-key: sk_sua_chave_aqui"`;

  const cancelExample = `curl -X POST "${API_BASE}/documents/{document_id}/cancel" \\
  -H "x-api-key: sk_sua_chave_aqui"`;

  const resendExample = `curl -X POST "${API_BASE}/documents/{document_id}/resend" \\
  -H "x-api-key: sk_sua_chave_aqui"`;

  const webhookPayloadExample = `{
  "event": "document.completed",
  "document_id": "uuid-do-documento",
  "document_name": "Contrato de Serviço",
  "document_status": "signed",
  "signer_id": null,
  "data": {
    "total_signers": 2
  },
  "timestamp": "2026-03-08T14:30:00Z"
}`;

  const responseCreateExample = `{
  "id": "uuid-do-documento",
  "name": "Contrato de Prestação de Serviços",
  "status": "pending",
  "created_at": "2026-03-08T10:30:00Z",
  "signers": [
    {
      "id": "uuid-signatario-1",
      "name": "João Silva",
      "email": "joao@email.com",
      "sign_token": "token-unico",
      "sign_url": "https://app.lovable.app/sign/token-unico",
      "status": "pending"
    }
  ],
  "fields": [
    { "id": "uuid-campo", "type": "signature", "page": 1, "x": 100, "y": 700 }
  ],
  "emails": [
    { "email": "joao@email.com", "success": true }
  ]
}`;

  return (
    <>
      <AppHeader title="API & Integrações" subtitle="Integre com seus sistemas externos" />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="docs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="docs">Documentação</TabsTrigger>
            <TabsTrigger value="keys">Chaves de API ({apiKeys.length})</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks ({webhooks.length})</TabsTrigger>
          </TabsList>

          {/* ─── DOCUMENTATION ─────────────────────────────── */}
          <TabsContent value="docs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="w-5 h-5" />API REST — Referência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm font-medium text-foreground">Base URL</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono text-primary">{API_BASE}</code>
                    <button onClick={() => copyText(API_BASE)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Autenticação via header: <code className="bg-secondary px-1 rounded">x-api-key: sk_sua_chave</code></p>
                </div>

                {/* Endpoints */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Endpoints</p>
                  <div className="space-y-1.5">
                    {[
                      { method: 'POST', path: '/documents', desc: 'Criar documento + signatários + enviar emails automaticamente' },
                      { method: 'GET', path: '/documents', desc: 'Listar documentos (?status=pending&limit=50&offset=0)' },
                      { method: 'GET', path: '/documents/:id', desc: 'Detalhes com signatários, campos e audit trail' },
                      { method: 'GET', path: '/documents/:id/status', desc: 'Status resumido com progresso de assinaturas' },
                      { method: 'POST', path: '/documents/:id/cancel', desc: 'Cancelar documento pendente' },
                      { method: 'POST', path: '/documents/:id/resend', desc: 'Reenviar emails para signatários pendentes' },
                      { method: 'GET', path: '/webhooks', desc: 'Listar webhooks registrados' },
                      { method: 'POST', path: '/webhooks', desc: 'Registrar novo webhook' },
                      { method: 'DELETE', path: '/webhooks/:id', desc: 'Remover webhook' },
                    ].map((ep) => (
                      <div key={ep.method + ep.path} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={cn('font-mono text-[10px] w-16 justify-center',
                          ep.method === 'POST' ? 'text-success border-success/30' :
                          ep.method === 'GET' ? 'text-info border-info/30' :
                          'text-destructive border-destructive/30'
                        )}>{ep.method}</Badge>
                        <code className="font-mono text-foreground">{ep.path}</code>
                        <span className="text-muted-foreground">— {ep.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Flow explanation */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Fluxo automático de integração</p>
                  <div className="space-y-2">
                    {[
                      { step: '1', title: 'Sistema externo envia documento via API', desc: 'POST /documents com nome, signatários e campos' },
                      { step: '2', title: 'Emails enviados automaticamente', desc: 'Cada signatário recebe um link único de assinatura' },
                      { step: '3', title: 'Signatário assina no navegador', desc: 'Interface de assinatura com desenho ou digitação' },
                      { step: '4', title: 'Webhook notifica o sistema externo', desc: 'Eventos: signer.signed, document.completed' },
                      { step: '5', title: 'Sistema consulta status ou recebe callback', desc: 'GET /documents/:id/status para verificar progresso' },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">{item.step}</div>
                        <div>
                          <p className="text-xs font-medium text-foreground">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Criar documento e enviar para assinatura</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{createDocExample}</pre>
                  <p className="text-xs font-semibold text-muted-foreground mt-3">Resposta (201 Created):</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{responseCreateExample}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Listar documentos</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{listDocsExample}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Consultar status</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{getStatusExample}</pre>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Cancelar documento</p>
                    <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{cancelExample}</pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Reenviar lembretes</p>
                    <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{resendExample}</pre>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Payload do Webhook</p>
                  <p className="text-xs text-muted-foreground">Enviado via POST para a URL registrada com header <code className="bg-secondary px-1 rounded">X-Webhook-Secret</code> para validação.</p>
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{webhookPayloadExample}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Eventos disponíveis</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allEvents.map((ev) => (
                      <Badge key={ev} variant="secondary" className="text-xs font-mono">{ev}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── API KEYS ──────────────────────────────────── */}
          <TabsContent value="keys" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Gerencie suas chaves de acesso à API.</p>
              <Dialog open={createKeyOpen} onOpenChange={(open) => { setCreateKeyOpen(open); if (!open) setNewKeyRevealed(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova chave</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Criar chave de API</DialogTitle></DialogHeader>
                  {newKeyRevealed ? (
                    <div className="space-y-4 pt-2">
                      <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <p className="text-sm font-semibold text-success">Chave criada com sucesso!</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Copie agora — esta chave não será exibida novamente.</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-card px-2 py-1 rounded border flex-1 break-all">{newKeyRevealed}</code>
                          <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => copyText(newKeyRevealed)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Button className="w-full" onClick={() => { setCreateKeyOpen(false); setNewKeyRevealed(null); }}>Fechar</Button>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Nome da chave</Label>
                        <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Ex: Produção, Integração ERP..." />
                      </div>
                      <Button className="w-full" onClick={handleCreateKey} disabled={!newKeyName.trim()}>Gerar chave</Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : apiKeys.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm font-medium">Nenhuma chave de API criada</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie uma chave para integrar com sistemas externos</p>
                </CardContent>
              </Card>
            ) : (
              apiKeys.map((key) => (
                <Card key={key.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{key.name}</p>
                          <Badge variant={key.active ? 'default' : 'secondary'} className="text-[10px]">{key.active ? 'Ativa' : 'Inativa'}</Badge>
                        </div>
                        <code className="text-xs font-mono text-muted-foreground mt-1 block">{key.key_prefix}••••••••••••</code>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          <span>Criada: {new Date(key.created_at).toLocaleDateString('pt-BR')}</span>
                          {key.last_used_at && <span>Último uso: {new Date(key.last_used_at).toLocaleDateString('pt-BR')}</span>}
                          <span>Escopos: {key.scopes.join(', ')}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteKey(key.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ─── WEBHOOKS ──────────────────────────────────── */}
          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Receba notificações em tempo real sobre assinaturas.</p>
              <Dialog open={createWebhookOpen} onOpenChange={setCreateWebhookOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo webhook</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Registrar webhook</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>URL do endpoint</Label>
                      <Input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://meusite.com/webhook" />
                    </div>
                    <div className="space-y-2">
                      <Label>Eventos</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {allEvents.map((ev) => (
                          <button
                            key={ev}
                            onClick={() => toggleEvent(ev)}
                            className={cn(
                              'px-2 py-1 rounded text-xs font-mono transition-colors',
                              newWebhookEvents.includes(ev)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-muted-foreground hover:text-foreground'
                            )}
                          >{ev}</button>
                        ))}
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleCreateWebhook} disabled={!newWebhookUrl.trim()}>Registrar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : webhooks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm font-medium">Nenhum webhook registrado</p>
                  <p className="text-xs text-muted-foreground mt-1">Registre um endpoint para receber notificações de assinatura</p>
                </CardContent>
              </Card>
            ) : (
              webhooks.map((wh) => (
                <Card key={wh.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono truncate">{wh.url}</code>
                          <Switch checked={wh.active} onCheckedChange={(v) => handleToggleWebhook(wh.id, v)} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {wh.events.map((ev) => (
                            <Badge key={ev} variant="outline" className="text-[10px] font-mono">{ev}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          {wh.last_triggered_at && <span>Último disparo: {new Date(wh.last_triggered_at).toLocaleString('pt-BR')}</span>}
                          {wh.failure_count > 0 && <span className="text-destructive">Falhas: {wh.failure_count}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => handleDeleteWebhook(wh.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
