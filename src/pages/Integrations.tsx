import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/documents/StatusBadge';
import {
  FileText, Search, Plus, Trash2, Send, ArrowRight, ExternalLink,
  Loader2, Users, Pencil, RefreshCw, MoreHorizontal, Download, Settings2,
  Unplug, Clock, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface IntegrationDoc {
  id: string;
  name: string;
  status: string;
  origin: string;
  external_ref: string | null;
  source_system: string | null;
  created_at: string;
  file_path: string | null;
  signers: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    role: string;
    signed_at: string | null;
  }>;
}

const statusFilters = [
  { label: 'Todos', value: 'all' },
  { label: 'Rascunho', value: 'draft' },
  { label: 'Aguardando', value: 'pending' },
  { label: 'Assinados', value: 'signed' },
  { label: 'Cancelados', value: 'cancelled' },
];

function useIntegrationDocs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['integration-docs', user?.id],
    queryFn: async (): Promise<IntegrationDoc[]> => {
      if (!user) return [];

      const { data: docs, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('origin' as any, 'api')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!docs || docs.length === 0) return [];

      const docIds = docs.map((d) => d.id);
      const { data: signers } = await supabase
        .from('signers')
        .select('*')
        .in('document_id', docIds)
        .order('sign_order');

      const signersByDoc = new Map<string, any[]>();
      (signers || []).forEach((s) => {
        const list = signersByDoc.get(s.document_id) || [];
        list.push(s);
        signersByDoc.set(s.document_id, list);
      });

      return docs.map((d: any) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        origin: d.origin || 'api',
        external_ref: d.external_ref || null,
        source_system: d.source_system || null,
        created_at: d.created_at,
        file_path: d.file_path,
        signers: (signersByDoc.get(d.id) || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          status: s.status,
          role: s.role,
          signed_at: s.signed_at,
        })),
      }));
    },
    enabled: !!user,
  });
}

function useAddSigner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, name, email, role }: { documentId: string; name: string; email: string; role: string }) => {
      const { data, error } = await supabase.from('signers').insert({
        document_id: documentId,
        name,
        email,
        role: role || 'Signatário',
        status: 'pending',
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-docs'] });
    },
  });
}

function useSendDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, documentName }: { documentId: string; documentName: string }) => {
      // Update status to pending
      await supabase.from('documents').update({ status: 'pending' }).eq('id', documentId);

      // Get pending signers
      const { data: signers } = await supabase
        .from('signers')
        .select('*')
        .eq('document_id', documentId)
        .eq('status', 'pending');

      if (!signers || signers.length === 0) throw new Error('Nenhum signatário para enviar');

      // Send emails
      const results: { email: string; success: boolean }[] = [];
      for (const s of signers) {
        try {
          await supabase.functions.invoke('send-signing-email', {
            body: {
              signerName: s.name,
              signerEmail: s.email,
              documentName,
              signToken: s.sign_token,
            },
          });
          results.push({ email: s.email, success: true });
        } catch {
          results.push({ email: s.email, success: false });
        }
      }

      // Audit
      await supabase.from('audit_trail').insert({
        document_id: documentId,
        action: 'sent',
        actor: 'Sistema',
        details: `Documento enviado para ${results.filter(r => r.success).length} signatário(s)`,
      });

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-docs'] });
    },
  });
}

function useRemoveSigner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (signerId: string) => {
      const { error } = await supabase.from('signers').delete().eq('id', signerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-docs'] });
    },
  });
}

export default function Integrations() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState<IntegrationDoc | null>(null);
  const [addSignerOpen, setAddSignerOpen] = useState(false);
  const [newSignerName, setNewSignerName] = useState('');
  const [newSignerEmail, setNewSignerEmail] = useState('');
  const [newSignerRole, setNewSignerRole] = useState('Signatário');
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: docs = [], isLoading, refetch } = useIntegrationDocs();
  const addSigner = useAddSigner();
  const sendDoc = useSendDocument();
  const removeSigner = useRemoveSigner();

  const filtered = docs
    .filter((d) => {
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.external_ref?.toLowerCase().includes(search.toLowerCase()) ||
        d.source_system?.toLowerCase().includes(search.toLowerCase()) ||
        d.signers.some(s => s.name.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchSearch && matchStatus;
    });

  const stats = {
    total: docs.length,
    draft: docs.filter(d => d.status === 'draft').length,
    pending: docs.filter(d => d.status === 'pending').length,
    signed: docs.filter(d => d.status === 'signed').length,
  };

  const handleAddSigner = async () => {
    if (!selectedDoc || !newSignerName.trim() || !newSignerEmail.trim()) return;
    try {
      await addSigner.mutateAsync({
        documentId: selectedDoc.id,
        name: newSignerName.trim(),
        email: newSignerEmail.trim(),
        role: newSignerRole,
      });
      toast({ title: 'Signatário adicionado ✓' });
      setNewSignerName('');
      setNewSignerEmail('');
      setAddSignerOpen(false);
      // Refresh selected doc
      const updated = docs.find(d => d.id === selectedDoc.id);
      if (updated) setSelectedDoc(updated);
    } catch {
      toast({ title: 'Erro ao adicionar signatário', variant: 'destructive' });
    }
  };

  const handleSendDoc = async (doc: IntegrationDoc) => {
    if (doc.signers.length === 0) {
      toast({ title: 'Adicione ao menos um signatário antes de enviar', variant: 'destructive' });
      return;
    }
    try {
      const results = await sendDoc.mutateAsync({ documentId: doc.id, documentName: doc.name });
      const success = results.filter(r => r.success).length;
      toast({ title: `Documento enviado para ${success} signatário(s) ✓` });
      setSelectedDoc(null);
    } catch (err) {
      toast({ title: 'Erro ao enviar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const handleRemoveSigner = async (signerId: string) => {
    try {
      await removeSigner.mutateAsync(signerId);
      toast({ title: 'Signatário removido ✓' });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  return (
    <>
      <AppHeader title="Integrações" subtitle="Documentos recebidos via API de sistemas externos" />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total recebidos', value: stats.total, icon: Unplug, color: 'text-primary' },
            { label: 'Aguardando config', value: stats.draft, icon: Settings2, color: 'text-warning' },
            { label: 'Em assinatura', value: stats.pending, icon: Clock, color: 'text-info' },
            { label: 'Concluídos', value: stats.signed, icon: CheckCircle2, color: 'text-success' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg bg-secondary flex items-center justify-center', s.color)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, referência ou sistema..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-80"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-1" />Atualizar
              </Button>
              <Link to="/api-docs">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-1" />Documentação API
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  statusFilter === f.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Unplug className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">Nenhum documento de integração</p>
              <p className="text-xs text-muted-foreground mt-1">
                Documentos enviados via API aparecerão aqui. Configure suas chaves em{' '}
                <Link to="/api-docs" className="text-primary hover:underline">API & Webhooks</Link>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Document list */}
        {!isLoading && filtered.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
              <span className="text-xs font-medium text-muted-foreground flex-1">DOCUMENTO</span>
              <span className="text-xs font-medium text-muted-foreground w-24 text-center hidden md:block">ORIGEM</span>
              <span className="text-xs font-medium text-muted-foreground w-28 text-center hidden md:block">STATUS</span>
              <span className="text-xs font-medium text-muted-foreground w-32 text-center hidden lg:block">SIGNATÁRIOS</span>
              <span className="text-xs font-medium text-muted-foreground w-28 text-right hidden md:block">DATA</span>
              <span className="w-8" />
            </div>
            <div className="divide-y divide-border">
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedDoc(doc)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Unplug className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      {doc.external_ref && (
                        <p className="text-[10px] text-muted-foreground truncate">Ref: {doc.external_ref}</p>
                      )}
                    </div>
                  </div>
                  <div className="w-24 text-center hidden md:block">
                    <Badge variant="outline" className="text-[10px]">
                      {doc.source_system || 'API'}
                    </Badge>
                  </div>
                  <div className="w-28 flex justify-center hidden md:flex">
                    <StatusBadge status={doc.status as any} />
                  </div>
                  <div className="w-32 text-center hidden lg:block">
                    {doc.signers.length > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <div className="flex -space-x-1.5">
                          {doc.signers.slice(0, 3).map((s) => (
                            <div
                              key={s.id}
                              className={cn(
                                'w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[9px] font-bold',
                                s.status === 'signed' ? 'bg-success/20 text-success' :
                                s.status === 'refused' ? 'bg-destructive/20 text-destructive' :
                                'bg-warning/20 text-warning'
                              )}
                            >
                              {s.name.charAt(0)}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground ml-1">
                          {doc.signers.filter(s => s.status === 'signed').length}/{doc.signers.length}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-warning flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" />Sem signatários
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground w-28 text-right hidden md:block">
                    {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); }}>
                        <Settings2 className="w-4 h-4 mr-2" />Configurar
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/documents/${doc.id}`}><FileText className="w-4 h-4 mr-2" />Detalhes</Link>
                      </DropdownMenuItem>
                      {(doc.status === 'draft') && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSendDoc(doc); }}>
                          <Send className="w-4 h-4 mr-2" />Enviar para assinatura
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Document Config Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => { if (!open) setSelectedDoc(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="w-5 h-5 text-primary" />
              Configurar documento
            </DialogTitle>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-4">
              {/* Doc info */}
              <div className="rounded-lg bg-secondary/30 p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{selectedDoc.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={selectedDoc.status as any} />
                  {selectedDoc.source_system && (
                    <Badge variant="outline" className="text-[10px]">{selectedDoc.source_system}</Badge>
                  )}
                  {selectedDoc.external_ref && (
                    <span>Ref: {selectedDoc.external_ref}</span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Signers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4" />Signatários ({selectedDoc.signers.length})
                  </p>
                  {(selectedDoc.status === 'draft' || selectedDoc.status === 'pending') && (
                    <Button size="sm" variant="outline" onClick={() => setAddSignerOpen(true)}>
                      <Plus className="w-3 h-3 mr-1" />Adicionar
                    </Button>
                  )}
                </div>

                {selectedDoc.signers.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Nenhum signatário. Adicione para seguir o fluxo.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDoc.signers.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20 border border-border">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                          s.status === 'signed' ? 'bg-success/20 text-success' :
                          s.status === 'refused' ? 'bg-destructive/20 text-destructive' :
                          'bg-warning/20 text-warning'
                        )}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{s.email} · {s.role}</p>
                        </div>
                        <Badge variant={s.status === 'signed' ? 'default' : 'secondary'} className="text-[10px]">
                          {s.status === 'signed' ? 'Assinado' : s.status === 'refused' ? 'Recusado' : 'Pendente'}
                        </Badge>
                        {s.status === 'pending' && selectedDoc.status !== 'signed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveSigner(s.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" asChild>
                  <Link to={`/documents/${selectedDoc.id}`}>
                    <FileText className="w-4 h-4 mr-1" />Ver detalhes
                  </Link>
                </Button>
                {(selectedDoc.status === 'draft') && (
                  <Button
                    onClick={() => handleSendDoc(selectedDoc)}
                    disabled={selectedDoc.signers.length === 0 || sendDoc.isPending}
                  >
                    {sendDoc.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                    Enviar para assinatura
                  </Button>
                )}
                {selectedDoc.status === 'pending' && (
                  <Button
                    variant="outline"
                    onClick={() => handleSendDoc(selectedDoc)}
                    disabled={sendDoc.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />Reenviar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Signer Dialog */}
      <Dialog open={addSignerOpen} onOpenChange={setAddSignerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar signatário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Nome completo"
                value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={newSignerEmail}
                onChange={(e) => setNewSignerEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Papel</Label>
              <Select value={newSignerRole} onValueChange={setNewSignerRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Signatário">Signatário</SelectItem>
                  <SelectItem value="Testemunha">Testemunha</SelectItem>
                  <SelectItem value="Aprovador">Aprovador</SelectItem>
                  <SelectItem value="Contratante">Contratante</SelectItem>
                  <SelectItem value="Contratada">Contratada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleAddSigner}
              disabled={!newSignerName.trim() || !newSignerEmail.trim() || addSigner.isPending}
            >
              {addSigner.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
