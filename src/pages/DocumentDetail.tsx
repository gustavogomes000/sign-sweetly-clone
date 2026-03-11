import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { ArrowLeft, Download, Send, Clock, CheckCircle2, XCircle, FileText, Copy, Trash2, Mail, Phone, Shield, Eye, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDocument, useCancelDocument, useResendEmails, getDocumentPublicUrl } from '@/hooks/useDocuments';
import PdfPagePreview from '@/components/documents/PdfPagePreview';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: doc, isLoading } = useDocument(id);
  const cancelDoc = useCancelDocument();
  const resendEmails = useResendEmails();
  const [previewPage, setPreviewPage] = useState(1);

  if (isLoading) {
    return (
      <>
        <AppHeader title="Carregando..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!doc) {
    return (
      <>
        <AppHeader title="Documento não encontrado" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-lg font-medium text-foreground">Documento não encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">O documento pode ter sido removido ou o link está incorreto.</p>
            <Link to="/documents"><Button variant="outline" className="mt-4">Voltar para documentos</Button></Link>
          </div>
        </div>
      </>
    );
  }

  const publicUrl = getDocumentPublicUrl(doc.caminho_arquivo);
  const isPdf = doc.caminho_arquivo?.endsWith('.pdf');

  const signerStatusIcon: Record<string, React.ReactNode> = {
    signed: <CheckCircle2 className="w-4 h-4 text-success" />,
    pending: <Clock className="w-4 h-4 text-warning" />,
    refused: <XCircle className="w-4 h-4 text-destructive" />,
  };

  const signerStatusLabel: Record<string, string> = {
    signed: 'Assinou',
    pending: 'Aguardando',
    refused: 'Recusou',
  };

  const auditActionIcon: Record<string, React.ReactNode> = {
    created: <FileText className="w-3 h-3" />,
    sent: <Send className="w-3 h-3" />,
    viewed: <Eye className="w-3 h-3" />,
    signed: <CheckCircle2 className="w-3 h-3" />,
    signature: <CheckCircle2 className="w-3 h-3" />,
    refused: <XCircle className="w-3 h-3" />,
    expired: <Clock className="w-3 h-3" />,
    cancelled: <Trash2 className="w-3 h-3" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
    reminder: <Mail className="w-3 h-3" />,
  };

  const auditActionColor: Record<string, string> = {
    created: 'bg-info/20 text-info',
    sent: 'bg-info/20 text-info',
    viewed: 'bg-muted text-muted-foreground',
    signed: 'bg-success/20 text-success',
    signature: 'bg-success/20 text-success',
    refused: 'bg-destructive/20 text-destructive',
    expired: 'bg-warning/20 text-warning',
    cancelled: 'bg-destructive/20 text-destructive',
    completed: 'bg-success/20 text-success',
    reminder: 'bg-warning/20 text-warning',
  };

  const handleResend = async () => {
    try {
      const count = await resendEmails.mutateAsync({ documentId: doc.id, documentName: doc.nome });
      toast({ title: `Lembrete enviado para ${count} signatário(s) ✓` });
    } catch (err) {
      toast({ title: 'Erro ao reenviar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelDoc.mutateAsync(doc.id);
      toast({ title: 'Documento cancelado ✓' });
      navigate('/documents');
    } catch {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    if (publicUrl) window.open(publicUrl, '_blank');
  };

  const handleDownloadFinal = () => {
    if (doc.caminho_pdf_final) {
      const url = getDocumentPublicUrl(doc.caminho_pdf_final);
      window.open(url, '_blank');
    }
  };

  const handleDownloadDossie = () => {
    if (doc.caminho_pdf_dossie) {
      const url = getDocumentPublicUrl(doc.caminho_pdf_dossie);
      window.open(url, '_blank');
    }
  };

  const handleGeneratePdfs = async () => {
    try {
      toast({ title: 'Gerando PDFs...' });
      const { error } = await supabase.functions.invoke('gerar-documento-final', {
        body: { documentoId: doc.id },
      });
      if (error) throw error;
      toast({ title: 'PDFs gerados com sucesso! ✅', description: 'Recarregue para baixar.' });
      // Force refetch
      window.location.reload();
    } catch (err) {
      toast({ title: 'Erro ao gerar PDFs', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  return (
    <>
      <AppHeader title={doc.nome} actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast({ title: 'Link copiado ✓' }))}>
            <Copy className="w-4 h-4 mr-1" />Copiar link
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!publicUrl}>
            <Download className="w-4 h-4 mr-1" />Baixar
          </Button>
          {doc.status === 'pending' && (
            <Button size="sm" onClick={handleResend} disabled={resendEmails.isPending}>
              <Send className="w-4 h-4 mr-1" />Reenviar
            </Button>
          )}
          {(doc.status === 'pending' || doc.status === 'draft') && (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelDoc.isPending}>
              <Trash2 className="w-4 h-4 mr-1" />Cancelar
            </Button>
          )}
        </div>
      } />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Link to="/documents" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />Voltar para documentos
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Informações do documento</CardTitle>
                  <StatusBadge status={doc.status as any} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Criado em</p>
                    <p className="font-medium">{format(new Date(doc.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Atualizado em</p>
                    <p className="font-medium">{format(new Date(doc.atualizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  {doc.prazo && (
                    <div>
                      <p className="text-muted-foreground text-xs">Prazo</p>
                      <p className="font-medium">{format(new Date(doc.prazo), "dd/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground text-xs">Tipo de assinatura</p>
                    <p className="font-medium">{doc.tipo_assinatura === 'electronic' ? 'Eletrônica' : 'Digital (ICP-Brasil)'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Signatários</p>
                    <p className="font-medium">{doc.signers.filter(s => s.status === 'signed').length} de {doc.signers.length} assinaram</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                {isPdf && publicUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPreviewPage((p) => Math.max(1, p - 1))} disabled={previewPage <= 1}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium">Página {previewPage}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPreviewPage((p) => p + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="relative w-full" style={{ aspectRatio: '595/842' }}>
                      <PdfPagePreview documentUrl={publicUrl} page={previewPage} className="rounded-lg" />
                      {doc.document_fields.filter(f => f.pagina === previewPage).map((field) => (
                        <div
                          key={field.id}
                          className={cn(
                            'absolute border-2 rounded flex items-center justify-center text-[10px] font-medium z-10',
                            field.valor
                              ? 'border-success/50 bg-success/10 text-success'
                              : 'border-primary/50 bg-primary/5 text-primary border-dashed'
                          )}
                          style={{
                            left: `${(field.x / 595) * 100}%`,
                            top: `${(field.y / 842) * 100}%`,
                            width: `${(field.width / 595) * 100}%`,
                            height: `${(field.height / 842) * 100}%`,
                          }}
                        >
                          {field.valor ? '✓' : field.tipo_campo}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : publicUrl ? (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">Pré-visualização não disponível para este formato</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={handleDownload}><Download className="w-4 h-4 mr-1" />Baixar arquivo</Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">Nenhum arquivo associado a este documento</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Signatários ({doc.signers.length})</CardTitle>
                  {doc.status === 'pending' && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleResend} disabled={resendEmails.isPending}>
                      <Send className="w-3 h-3 mr-1" />Reenviar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {doc.signers.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum signatário adicionado</p>
                )}
                {doc.signers.map((signer) => (
                  <div key={signer.id} className="p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                        signer.status === 'signed' ? 'bg-success/15 text-success' :
                        signer.status === 'refused' ? 'bg-destructive/15 text-destructive' :
                        'bg-warning/15 text-warning'
                      )}>
                        {signer.ordem_assinatura}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{signer.nome}</p>
                          {signerStatusIcon[signer.status]}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />{signer.email}
                        </p>
                        {signer.telefone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{signer.telefone}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] h-5">{signer.funcao}</Badge>
                        </div>
                        <p className={cn("text-xs mt-1.5 font-medium",
                          signer.status === 'signed' && 'text-success',
                          signer.status === 'pending' && 'text-warning',
                          signer.status === 'refused' && 'text-destructive'
                        )}>
                          {signerStatusLabel[signer.status] || signer.status}
                          {signer.assinado_em && ` · ${format(new Date(signer.assinado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Trilha de auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                {doc.audit_trail.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem registros de atividade</p>
                ) : (
                  <div className="space-y-0 relative">
                    <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />
                    {doc.audit_trail.map((entry) => (
                      <div key={entry.id} className="flex gap-3 py-2 relative">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10',
                          auditActionColor[entry.acao] || 'bg-muted text-muted-foreground'
                        )}>
                          {auditActionIcon[entry.acao] || <FileText className="w-3 h-3" />}
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-xs font-medium text-foreground">{entry.detalhes || entry.acao}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{entry.ator}</span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(entry.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
