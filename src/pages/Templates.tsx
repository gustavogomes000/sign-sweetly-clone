import { useState, useEffect, useRef } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderOpen, Plus, Copy, MoreHorizontal, FileText, Trash2, Pencil, Loader2, Upload, File, X, ChevronLeft, ChevronRight, Save, Eye, Code } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import PdfPagePreview from '@/components/documents/PdfPagePreview';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TemplateRow {
  id: string;
  nome: string;
  descricao: string | null;
  conteudo: string;
  categoria: string | null;
  criado_em: string;
  atualizado_em: string;
  usuario_id: string;
  caminho_arquivo: string | null;
}

export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorFileRef = useRef<HTMLInputElement>(null);

  const [editorContent, setEditorContent] = useState('');
  const [editorPage, setEditorPage] = useState(1);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [editorName, setEditorName] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorCategory, setEditorCategory] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('modelos')
      .select('*')
      .order('criado_em', { ascending: false });
    if (!error && data) setTemplates(data as TemplateRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const filePath = `templates/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(filePath, file);
    if (error) { toast.error('Erro ao fazer upload'); return null; }
    return filePath;
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const isFileAllowed = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    return ['pdf', 'png', 'doc', 'docx'].includes(ext);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !user) return;
    setSaving(true);
    setUploading(!!formFile);
    let filePath: string | null = null;
    if (formFile) {
      filePath = await uploadFile(formFile);
      if (!filePath) { setSaving(false); setUploading(false); return; }
    }
    const { error } = await supabase.from('modelos').insert({
      nome: formName.trim(),
      descricao: formDescription.trim() || null,
      categoria: formCategory.trim() || null,
      conteudo: '',
      usuario_id: user.id,
      caminho_arquivo: filePath,
    });
    setSaving(false); setUploading(false);
    if (error) { toast.error('Erro ao criar modelo'); return; }
    toast.success('Modelo criado com sucesso');
    setCreateOpen(false);
    resetForm();
    fetchTemplates();
  };

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormCategory(''); setFormFile(null);
  };

  const handleDuplicate = async (t: TemplateRow) => {
    if (!user) return;
    const { error } = await supabase.from('modelos').insert({
      nome: `${t.nome} (cópia)`, descricao: t.descricao, categoria: t.categoria,
      conteudo: t.conteudo, usuario_id: user.id, caminho_arquivo: t.caminho_arquivo,
    });
    if (error) { toast.error('Erro ao duplicar'); return; }
    toast.success('Modelo duplicado');
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('modelos').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Modelo excluído');
    fetchTemplates();
  };

  const openEditor = (t: TemplateRow) => {
    setEditingTemplate(t);
    setEditorContent(t.conteudo);
    setEditorName(t.nome);
    setEditorDescription(t.descricao || '');
    setEditorCategory(t.categoria || '');
    setEditorPage(1);
    setEditorTab('edit');
    setDocumentUrl(t.caminho_arquivo ? getPublicUrl(t.caminho_arquivo) : null);
    setEditorOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    const { error } = await supabase.from('modelos').update({
      conteudo: editorContent,
      nome: editorName.trim() || editingTemplate.nome,
      descricao: editorDescription.trim() || null,
      categoria: editorCategory.trim() || null,
    }).eq('id', editingTemplate.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Modelo salvo com sucesso');
    setEditorOpen(false);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const handleReplaceFile = async (file: File) => {
    if (!editingTemplate || !isFileAllowed(file)) {
      toast.error('Formato não suportado');
      return;
    }
    setUploading(true);
    const filePath = await uploadFile(file);
    if (!filePath) { setUploading(false); return; }
    const { error } = await supabase.from('modelos').update({ caminho_arquivo: filePath }).eq('id', editingTemplate.id);
    setUploading(false);
    if (error) { toast.error('Erro ao vincular arquivo'); return; }
    setDocumentUrl(getPublicUrl(filePath));
    setEditingTemplate({ ...editingTemplate, caminho_arquivo: filePath });
    toast.success('Documento atualizado');
    fetchTemplates();
  };

  const insertAtCursor = (before: string, after = '') => {
    const textarea = document.getElementById('template-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editorContent.substring(start, end);
    const newContent = editorContent.substring(0, start) + before + selected + after + editorContent.substring(end);
    setEditorContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const renderPreview = (content: string) => {
    return content
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mb-2">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mb-2">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-medium mb-1">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
      .replace(/\{\{(.+?)\}\}/g, '<span class="bg-accent/20 text-accent-foreground px-1 rounded font-mono text-sm">{{$1}}</span>')
      .replace(/^---$/gm, '<hr class="my-3 border-border"/>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      <AppHeader title="Modelos" subtitle={`${templates.length} modelos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)} className="text-xs tracking-wider">
            <Plus className="w-4 h-4 mr-1" /> NOVO MODELO
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhum modelo cadastrado</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>Criar primeiro modelo</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template, i) => (
              <motion.div key={template.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4, scale: 1.02 }}>
                <Card className="border rounded-xl bg-card h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {template.caminho_arquivo ? <File className="w-5 h-5 text-primary" /> : <FolderOpen className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm tracking-wider truncate">{template.nome.toUpperCase()}</p>
                          {template.categoria && <Badge variant="outline" className="text-[10px] tracking-wider mt-0.5">{template.categoria}</Badge>}
                          {template.caminho_arquivo && <p className="text-xs text-muted-foreground mt-0.5">📎 Documento anexado</p>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditor(template)}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(template)}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(template.id)}><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {template.descricao && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{template.descricao}</p>}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{format(new Date(template.criado_em), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <Button variant="outline" size="sm" className="text-xs h-7 tracking-wider" onClick={() => openEditor(template)}>EDITAR</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-wider">Novo Modelo</DialogTitle>
            <DialogDescription>Crie um modelo reutilizável.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Contrato de Prestação de Serviços" /></div>
            <div><Label>Descrição</Label><Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descreva o modelo..." rows={2} /></div>
            <div><Label>Categoria</Label><Input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="Contratos, NDAs, RH" /></div>
            <div>
              <Label>Documento base (PDF)</Label>
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.doc,.docx" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && isFileAllowed(file)) setFormFile(file);
                else if (file) toast.error('Formato não suportado');
              }} />
              {formFile ? (
                <div className="flex items-center gap-2 mt-1.5 p-2.5 rounded-md border border-border bg-muted/30">
                  <File className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{formFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFormFile(null)}><X className="w-3.5 h-3.5" /></Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-1.5 w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1.5" /> Upload de documento
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Criar modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-[95vw] max-h-[92vh] flex flex-col p-0">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <Input value={editorName} onChange={(e) => setEditorName(e.target.value)} className="h-8 text-sm tracking-wider border-none bg-transparent focus-visible:ring-0 p-0 max-w-xs" placeholder="Nome do modelo" />
              <Input value={editorCategory} onChange={(e) => setEditorCategory(e.target.value)} className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0 max-w-[120px] text-muted-foreground" placeholder="Categoria" />
            </div>
            <div className="flex items-center gap-2">
              <input ref={editorFileRef} type="file" accept=".pdf,.png,.doc,.docx" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleReplaceFile(file); }} />
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => editorFileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                {documentUrl ? 'Trocar PDF' : 'Anexar PDF'}
              </Button>
              <Button size="sm" className="text-xs h-8 tracking-wider" onClick={handleSaveTemplate} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                SALVAR
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 px-6 py-1.5 border-b border-border bg-muted/20 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs font-bold" onClick={() => insertAtCursor('**', '**')}>N</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs italic" onClick={() => insertAtCursor('_', '_')}>I</Button>
            <div className="w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n# ')}>H1</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n## ')}>H2</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n### ')}>H3</Button>
            <div className="w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n- ')}>• Lista</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n1. ')}>1. Num</Button>
            <div className="w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('{{', '}}')}>{'{{var}}'}</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n---\n')}>Linha</Button>
            <div className="flex-1" />
            <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as 'edit' | 'preview')} className="h-7">
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="edit" className="h-6 text-[10px] px-2"><Code className="w-3 h-3 mr-1" />Editar</TabsTrigger>
                <TabsTrigger value="preview" className="h-6 text-[10px] px-2"><Eye className="w-3 h-3 mr-1" />Prévia</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              {editorTab === 'edit' ? (
                <Textarea id="template-editor" value={editorContent} onChange={(e) => setEditorContent(e.target.value)} className="flex-1 resize-none border-none rounded-none focus-visible:ring-0 font-mono text-sm p-6" placeholder="Digite o conteúdo do modelo aqui..." />
              ) : (
                <div className="flex-1 overflow-auto p-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderPreview(editorContent) }} />
              )}
            </div>
            {documentUrl && (
              <div className="w-[400px] border-l border-border bg-muted/10 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Documento</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditorPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-3 h-3" /></Button>
                    <span className="text-[10px] text-muted-foreground">Pág {editorPage}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditorPage(p => p + 1)}><ChevronRight className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-2">
                  <PdfPagePreview documentUrl={documentUrl} page={editorPage} className="w-full" />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}