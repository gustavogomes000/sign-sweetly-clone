import { useParams, Link } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockDocuments } from '@/data/mockData';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { ArrowLeft, Download, Send, Clock, CheckCircle2, XCircle, FileText, User, Copy, Trash2, Mail, Phone, Shield, Eye, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function DocumentDetail() {
  const { id } = useParams();
  const doc = mockDocuments.find((d) => d.id === id);
  const { toast } = useToast();

  if (!doc) {
    return (
      <>
        <AppHeader title="Documento não encontrado" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-lg font-medium text-foreground">Documento não encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">O documento pode ter sido removido ou o link está incorreto.</p>
            <Link to="/documents">
              <Button variant="outline" className="mt-4">Voltar para documentos</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  const signerStatusIcon = {
    signed: <CheckCircle2 className="w-4 h-4 text-success" />,
    pending: <Clock className="w-4 h-4 text-warning" />,
    refused: <XCircle className="w-4 h-4 text-destructive" />,
  };

  const signerStatusLabel = {
    signed: 'Assinou',
    pending: 'Aguardando',
    refused: 'Recusou',
  };

  const authMethodLabel: Record<string, string> = {
    email: 'Email',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    pix: 'Pix',
    selfie: 'Selfie',
    token: 'Token',
  };

  const auditActionIcon: Record<string, React.ReactNode> = {
    created: <FileText className="w-3 h-3" />,
    sent: <Send className="w-3 h-3" />,
    viewed: <Eye className="w-3 h-3" />,
    signed: <CheckCircle2 className="w-3 h-3" />,
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
    refused: 'bg-destructive/20 text-destructive',
    expired: 'bg-warning/20 text-warning',
    cancelled: 'bg-destructive/20 text-destructive',
    completed: 'bg-success/20 text-success',
    reminder: 'bg-warning/20 text-warning',
  };

  const handleResend = () => {
    toast({ title: 'Reenvio realizado', description: 'Os signatários pendentes receberão uma nova notificação.' });
  };

  return (
    <>
      <AppHeader title={doc.name} actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(window.location.href)}>
            <Copy className="w-4 h-4 mr-1" />Copiar link
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />Baixar
          </Button>
          {doc.status === 'pending' && (
            <Button size="sm" onClick={handleResend}>
              <Send className="w-4 h-4 mr-1" />Reenviar
            </Button>
          )}
        </div>
      } />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Link to="/documents" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para documentos
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Informações do documento</CardTitle>
                  <StatusBadge status={doc.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Criado em</p>
                    <p className="font-medium">{format(new Date(doc.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Atualizado em</p>
                    <p className="font-medium">{format(new Date(doc.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  {doc.deadline && (
                    <div>
                      <p className="text-muted-foreground text-xs">Prazo</p>
                      <p className="font-medium">{format(new Date(doc.deadline), "dd/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground text-xs">Tipo de assinatura</p>
                    <p className="font-medium">{doc.signatureType === 'electronic' ? 'Eletrônica' : 'Digital (ICP-Brasil)'}</p>
                  </div>
                  {doc.folder && (
                    <div>
                      <p className="text-muted-foreground text-xs">Pasta</p>
                      <p className="font-medium">{doc.folder}</p>
                    </div>
                  )}
                  {doc.envelope && (
                    <div>
                      <p className="text-muted-foreground text-xs">Envelope</p>
                      <p className="font-medium font-mono text-xs">{doc.envelope}</p>
                    </div>
                  )}
                  {doc.notifyVia && (
                    <div>
                      <p className="text-muted-foreground text-xs">Notificação via</p>
                      <p className="font-medium capitalize">{doc.notifyVia}</p>
                    </div>
                  )}
                  {doc.reminderDays && (
                    <div>
                      <p className="text-muted-foreground text-xs">Lembrete automático</p>
                      <p className="font-medium">A cada {doc.reminderDays} dias</p>
                    </div>
                  )}
                </div>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="mt-4 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">Tags:</span>
                    {doc.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document preview */}
            <Card>
              <CardContent className="p-0">
                <div className="aspect-[3/4] bg-secondary/30 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-secondary/50" />
                  <div className="text-center text-muted-foreground z-10">
                    <FileText className="w-20 h-20 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">Pré-visualização do documento</p>
                    <p className="text-xs mt-1">O conteúdo do PDF será exibido aqui</p>
                    <Button variant="outline" size="sm" className="mt-4">
                      <Download className="w-4 h-4 mr-1" />Baixar PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Signers */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Signatários ({doc.signers.length})</CardTitle>
                  {doc.status === 'pending' && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleResend}>
                      <Send className="w-3 h-3 mr-1" />Reenviar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {doc.signers.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum signatário adicionado</p>
                )}
                {doc.signers.map((signer, i) => (
                  <div key={signer.id} className="p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                        signer.status === 'signed' ? 'bg-success/15 text-success' :
                        signer.status === 'refused' ? 'bg-destructive/15 text-destructive' :
                        'bg-warning/15 text-warning'
                      )}>
                        {signer.order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{signer.name}</p>
                          {signerStatusIcon[signer.status]}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />{signer.email}
                        </p>
                        {signer.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{signer.phone}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] h-5">{signer.role}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5">
                            <Shield className="w-2.5 h-2.5 mr-0.5" />
                            {authMethodLabel[signer.authMethod] || signer.authMethod}
                          </Badge>
                        </div>
                        <p className={cn("text-xs mt-1.5 font-medium",
                          signer.status === 'signed' && 'text-success',
                          signer.status === 'pending' && 'text-warning',
                          signer.status === 'refused' && 'text-destructive'
                        )}>
                          {signerStatusLabel[signer.status]}
                          {signer.signedAt && ` · ${format(new Date(signer.signedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Trilha de auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                {(!doc.auditTrail || doc.auditTrail.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem registros de atividade</p>
                ) : (
                  <div className="space-y-0 relative">
                    <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />
                    {doc.auditTrail.map((entry, i) => (
                      <div key={entry.id} className="flex gap-3 py-2 relative">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10',
                          auditActionColor[entry.action] || 'bg-muted text-muted-foreground'
                        )}>
                          {auditActionIcon[entry.action] || <FileText className="w-3 h-3" />}
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-xs font-medium text-foreground">{entry.details}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{entry.actor}</span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
