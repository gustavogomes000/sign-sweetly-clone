import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { FileText, Plus, Search, MoreHorizontal, Download, Send, Copy, Trash2, ArrowUpDown, Grid3X3, List, FolderOpen, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { DocumentStatus } from '@/types/document';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useDocuments, useCancelDocument, useResendEmails, getDocumentPublicUrl } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';

const statusFilters: { label: string; value: DocumentStatus | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Rascunho', value: 'draft' },
  { label: 'Aguardando', value: 'pending' },
  { label: 'Assinados', value: 'signed' },
  { label: 'Cancelados', value: 'cancelled' },
  { label: 'Expirados', value: 'expired' },
];

export default function Documents() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useDocuments();
  const cancelDoc = useCancelDocument();
  const resendEmails = useResendEmails();

  const filteredDocs = documents
    .filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
        doc.signers.some(s => s.name.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const toggleSelect = (id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDocs.length === filteredDocs.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(filteredDocs.map((d) => d.id));
    }
  };

  const handleCancel = async (docId: string) => {
    try {
      await cancelDoc.mutateAsync(docId);
      toast({ title: 'Documento cancelado ✓' });
    } catch {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    }
  };

  const handleResend = async (doc: typeof documents[0]) => {
    try {
      const count = await resendEmails.mutateAsync({ documentId: doc.id, documentName: doc.name });
      toast({ title: `Lembrete enviado para ${count} signatário(s) ✓` });
    } catch (err) {
      toast({ title: 'Erro ao reenviar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const handleDownload = (filePath: string | null) => {
    const url = getDocumentPublicUrl(filePath);
    if (url) window.open(url, '_blank');
  };

  return (
    <>
      <AppHeader
        title="Documentos"
        subtitle={`${filteredDocs.length} de ${documents.length} documentos`}
      />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou signatário..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-72"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>
              <div className="flex border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn('p-2 transition-colors', viewMode === 'list' ? 'bg-secondary' : 'hover:bg-secondary/50')}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-secondary' : 'hover:bg-secondary/50')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
              <Link to="/documents/new">
                <Button size="sm" className="shadow-sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Novo documento
                </Button>
              </Link>
            </div>
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  statusFilter === filter.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {filter.label}
                {filter.value !== 'all' && (
                  <span className="ml-1 opacity-70">
                    ({documents.filter((d) => d.status === filter.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Bulk actions */}
          {selectedDocs.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20 animate-fade-in">
              <span className="text-sm font-medium text-primary">{selectedDocs.length} selecionado(s)</span>
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="outline" size="sm" onClick={() => {
                  selectedDocs.forEach((docId) => {
                    const doc = documents.find((d) => d.id === docId);
                    if (doc?.status === 'pending') handleResend(doc);
                  });
                }}><Send className="w-3 h-3 mr-1" />Reenviar</Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => {
                  selectedDocs.forEach((docId) => handleCancel(docId));
                  setSelectedDocs([]);
                }}><Trash2 className="w-3 h-3 mr-1" />Cancelar</Button>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Document List */}
        {!isLoading && viewMode === 'list' ? (
          <Card>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
              <Checkbox
                checked={selectedDocs.length === filteredDocs.length && filteredDocs.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs font-medium text-muted-foreground flex-1">DOCUMENTO</span>
              <span className="text-xs font-medium text-muted-foreground w-32 text-center hidden md:block">STATUS</span>
              <span className="text-xs font-medium text-muted-foreground w-32 text-center hidden lg:block">SIGNATÁRIOS</span>
              <span className="text-xs font-medium text-muted-foreground w-28 text-right hidden md:block">DATA</span>
              <span className="w-8" />
            </div>

            <div className="divide-y divide-border">
              {filteredDocs.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum documento encontrado</p>
                  <p className="text-xs mt-1">Tente ajustar os filtros ou crie um novo documento</p>
                </div>
              )}
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors',
                    selectedDocs.includes(doc.id) && 'bg-primary/5'
                  )}
                >
                  <Checkbox
                    checked={selectedDocs.includes(doc.id)}
                    onCheckedChange={() => toggleSelect(doc.id)}
                  />
                  <Link to={`/documents/${doc.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    </div>
                  </Link>
                  <div className="w-32 flex justify-center hidden md:flex">
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
                          {doc.signers.filter((s) => s.status === 'signed').length}/{doc.signers.length}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground w-28 text-right hidden md:block">
                    {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/documents/${doc.id}`}><FileText className="w-4 h-4 mr-2" />Visualizar</Link>
                      </DropdownMenuItem>
                      {doc.status === 'pending' && (
                        <DropdownMenuItem onClick={() => handleResend(doc)}>
                          <Send className="w-4 h-4 mr-2" />Reenviar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDownload(doc.file_path)}>
                        <Download className="w-4 h-4 mr-2" />Baixar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(doc.status === 'pending' || doc.status === 'draft') && (
                        <DropdownMenuItem className="text-destructive" onClick={() => handleCancel(doc.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />Cancelar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </Card>
        ) : !isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`}>
                <Card className="hover:shadow-md transition-all hover:border-primary/30 h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <StatusBadge status={doc.status as any} />
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">{doc.name}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      {doc.signers.length > 0 && (
                        <span>{doc.signers.filter(s => s.status === 'signed').length}/{doc.signers.length} assinaturas</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
