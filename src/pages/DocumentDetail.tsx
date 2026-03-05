import { useParams, Link } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockDocuments } from '@/data/mockData';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { ArrowLeft, Download, Send, Clock, CheckCircle2, XCircle, FileText, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function DocumentDetail() {
  const { id } = useParams();
  const doc = mockDocuments.find((d) => d.id === id);

  if (!doc) {
    return (
      <>
        <AppHeader title="Documento não encontrado" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Documento não encontrado</p>
            <Link to="/documents">
              <Button variant="outline" className="mt-4">Voltar</Button>
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

  return (
    <>
      <AppHeader title={doc.name} />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/documents" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar para documentos
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Baixar
            </Button>
            {doc.status === 'pending' && (
              <Button size="sm">
                <Send className="w-4 h-4 mr-1" />
                Reenviar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Informações do documento</CardTitle>
                  <StatusBadge status={doc.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-medium">{format(new Date(doc.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Atualizado em</p>
                    <p className="font-medium">{format(new Date(doc.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  {doc.deadline && (
                    <div>
                      <p className="text-muted-foreground">Prazo</p>
                      <p className="font-medium">{format(new Date(doc.deadline), "dd/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Tipo de assinatura</p>
                    <p className="font-medium capitalize">{doc.signatureType === 'electronic' ? 'Eletrônica' : 'Digital (ICP-Brasil)'}</p>
                  </div>
                  {doc.folder && (
                    <div>
                      <p className="text-muted-foreground">Pasta</p>
                      <p className="font-medium">{doc.folder}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Document preview placeholder */}
            <Card>
              <CardContent className="p-0">
                <div className="aspect-[3/4] bg-secondary/50 rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Pré-visualização do documento</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Signers sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signatários ({doc.signers.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {doc.signers.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum signatário adicionado</p>
                )}
                {doc.signers.map((signer, i) => (
                  <div key={signer.id}>
                    {i > 0 && <Separator className="mb-3" />}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{signer.name}</p>
                          {signerStatusIcon[signer.status]}
                        </div>
                        <p className="text-xs text-muted-foreground">{signer.email}</p>
                        <p className="text-xs text-muted-foreground">{signer.role}</p>
                        <p className={cn("text-xs mt-1", 
                          signer.status === 'signed' && 'text-success',
                          signer.status === 'pending' && 'text-warning',
                          signer.status === 'refused' && 'text-destructive'
                        )}>
                          {signerStatusLabel[signer.status]}
                          {signer.signedAt && ` em ${format(new Date(signer.signedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Activity log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Atividade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs text-foreground">Documento criado</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(doc.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                  {doc.signers.filter(s => s.signedAt).map(s => (
                    <div key={s.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-success mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs text-foreground">{s.name} assinou</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(s.signedAt!), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
