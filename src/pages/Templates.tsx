import { useState, useEffect } from 'react';
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
import { FolderOpen, Plus, Copy, MoreHorizontal, FileText, Trash2, Pencil, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');

  // Editor state
  const [editorContent, setEditorContent] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setTemplates(data as TemplateRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
    if (!formName.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('templates').insert({
      name: formName.trim(),
      description: formDescription.trim() || null,
      category: formCategory.trim() || null,
      content: '',
      user_id: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error('Erro ao criar modelo');
      return;
    }
    toast.success('Modelo criado com sucesso');
    setCreateOpen(false);
    setFormName(''); setFormDescription(''); setFormCategory('');
    fetchTemplates();
  };

  const handleDuplicate = async (t: TemplateRow) => {
    if (!user) return;
    const { error } = await supabase.from('templates').insert({
      name: `${t.name} (cópia)`,
      description: t.description,
      category: t.category,
      content: t.content,
      user_id: user.id,
    });
    if (error) { toast.error('Erro ao duplicar'); return; }
    toast.success('Modelo duplicado');
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Modelo excluído');
    fetchTemplates();
  };

  const openEditor = (t: TemplateRow) => {
    setEditingTemplate(t);
    setEditorContent(t.content);
    setEditorOpen(true);
  };

  const handleSaveContent = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    const { error } = await supabase
      .from('templates')
      .update({ content: editorContent })
      .eq('id', editingTemplate.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Conteúdo salvo com sucesso');
    setEditorOpen(false);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const handleUseTemplate = (t: TemplateRow) => {
    openEditor(t);
  };

  // Simple toolbar actions for the editor
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

  return (
    <>
      <AppHeader title="Modelos" subtitle={`${templates.length} modelos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Novo modelo
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3" />
            <p className="text-sm">Nenhum modelo cadastrado</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
              Criar primeiro modelo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow animate-fade-in">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <FolderOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
                        {template.category && (
                          <p className="text-xs text-primary mt-0.5">{template.category}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditor(template)}>
                          <Pencil className="w-4 h-4 mr-2" />Editar conteúdo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="w-4 h-4 mr-2" />Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(template.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{template.description}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(template.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleUseTemplate(template)}>
                      Usar modelo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Modelo</DialogTitle>
            <DialogDescription>Crie um modelo reutilizável para seus documentos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tpl-name">Nome *</Label>
              <Input id="tpl-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" />
            </div>
            <div>
              <Label htmlFor="tpl-desc">Descrição</Label>
              <Textarea id="tpl-desc" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descreva o modelo..." rows={2} />
            </div>
            <div>
              <Label htmlFor="tpl-cat">Categoria</Label>
              <Input id="tpl-cat" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="Ex: Contratos, NDAs, RH" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Criar modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Content Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {editingTemplate?.name}
              </div>
            </DialogTitle>
            <DialogDescription>Edite o conteúdo do modelo como um documento de texto.</DialogDescription>
          </DialogHeader>

          {/* Simple toolbar */}
          <div className="flex flex-wrap gap-1 border rounded-md p-1.5 bg-muted/30">
            <Button variant="ghost" size="sm" className="h-7 text-xs font-bold" onClick={() => insertAtCursor('**', '**')}>
              N
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs italic" onClick={() => insertAtCursor('_', '_')}>
              I
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n# ')}>
              Título
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n## ')}>
              Subtítulo
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n- ')}>
              • Lista
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n1. ')}>
              1. Numerada
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('\n---\n')}>
              Linha
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor('{{', '}}')}>
              {'{{Campo}}'}
            </Button>
          </div>

          {/* Editor area */}
          <div className="flex-1 min-h-0">
            <textarea
              id="template-editor"
              className="w-full h-[50vh] rounded-md border border-input bg-background px-4 py-3 text-sm font-mono leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              placeholder={`Escreva o conteúdo do seu modelo aqui...

Exemplo:

# CONTRATO DE PRESTAÇÃO DE SERVIÇOS

**CONTRATANTE**: {{nome_contratante}}
**CONTRATADA**: {{nome_contratada}}

## CLÁUSULA 1 - DO OBJETO

O presente contrato tem como objeto...

Use {{campo}} para criar campos variáveis que serão preenchidos ao usar o modelo.`}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveContent} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar conteúdo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
