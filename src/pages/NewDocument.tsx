import { useState, useRef, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Upload, Plus, Trash2, FileText, CheckCircle2, Users, Send, Settings2, Pencil, Camera, FileImage, UserCheck, GripVertical, Loader2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PostSignatureValidation, ValidationStep } from '@/types/document';
import { Badge } from '@/components/ui/badge';
import DocumentFieldEditor, { PlacedField, getSignerColor } from '@/components/documents/DocumentFieldEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { uploadDocumentFile, createDocument, createSigners, createDocumentFields, createValidationSteps } from '@/services/documentService';
import { supabase } from '@/integrations/supabase/client';

interface TemplateOption {
  id: string;
  nome: string;
  categoria: string | null;
  conteudo: string;
  caminho_arquivo: string | null;
}

interface TemplateVariable {
  key: string;
  label: string;
}

const templateVariables: TemplateVariable[] = [
  { key: 'document.name', label: 'Nome do documento' },
  { key: 'document.date', label: 'Data atual' },
  { key: 'signer.name', label: 'Nome do signatário' },
  { key: 'signer.email', label: 'Email do signatário' },
  { key: 'signer.phone', label: 'Telefone do signatário' },
];

type Step = 'upload' | 'signers' | 'fields' | 'configure' | 'review';

interface NewSigner {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  role: string;
  validationSteps: ValidationStep[];
}

const steps: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'upload', label: 'Documento', icon: Upload },
  { key: 'signers', label: 'Signatários', icon: Users },
  { key: 'fields', label: 'Campos', icon: Pencil },
  { key: 'configure', label: 'Configurar', icon: Settings2 },
  { key: 'review', label: 'Enviar', icon: Send },
];

const validationOptions: { type: PostSignatureValidation; label: string; description: string; icon: React.ElementType }[] = [
  { type: 'selfie', label: 'Selfie', description: 'Tirar foto do rosto', icon: Camera },
  { type: 'document_photo', label: 'Foto do documento', description: 'Fotografar RG/CNH/CPF', icon: FileImage },
  { type: 'selfie_with_document', label: 'Selfie com documento', description: 'Foto segurando o documento', icon: UserCheck },
];

let signerIdCounter = 1;
const genSignerId = () => `signer_${signerIdCounter++}`;
let validationIdCounter = 1;
const genValidationId = () => `val_${validationIdCounter++}`;

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'doc', 'docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const isFileAllowed = (f: File): boolean => {
  const ext = f.name.split('.').pop()?.toLowerCase() || '';
  const mime = (f.type || '').toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIME_TYPES.some((m) => mime.includes(m));
};

const getPreviewMimeType = (inputFile: File | null) => {
  if (!inputFile) return undefined;
  const normalizedType = (inputFile.type || '').toLowerCase();
  if (normalizedType.includes('pdf')) return 'application/pdf';
  if (normalizedType === 'image/png') return 'image/png';
  const extension = inputFile.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  return normalizedType || undefined;
};

export default function NewDocument() {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [docName, setDocName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateContent, setTemplateContent] = useState('');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [signers, setSigners] = useState<NewSigner[]>([
    { id: genSignerId(), name: '', email: '', phone: '', cpf: '', role: 'Signatário', validationSteps: [] },
  ]);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  const [enableReminders, setEnableReminders] = useState(true);
  const [reminderDays, setReminderDays] = useState('3');
  const [orderMatters, setOrderMatters] = useState(false);
  const [locale, setLocale] = useState('pt-BR');
  const [sending, setSending] = useState(false);
  const [editorTotalPages, setEditorTotalPages] = useState(3);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch templates from database
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('modelos')
        .select('id, nome, categoria, conteudo, caminho_arquivo')
        .order('nome');
      if (data) setTemplates(data as TemplateOption[]);
    };
    fetchTemplates();
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = templates.find(t => t.id === templateId);
    if (tpl) {
      setTemplateContent(tpl.conteudo || '');
      setShowTemplateEditor(true);
      if (!docName) setDocName(tpl.nome);
      if (tpl.caminho_arquivo) {
        const { data } = supabase.storage.from('documents').getPublicUrl(tpl.caminho_arquivo);
        setFilePreviewUrl(data.publicUrl);
        setFileName(tpl.nome + '.pdf');
      }
    }
  };

  const handleClearTemplate = () => {
    setSelectedTemplate('');
    setTemplateContent('');
    setShowTemplateEditor(false);
  };

  const insertTemplateText = (before: string, after = '') => {
    const textarea = document.getElementById('template-content-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = templateContent.substring(start, end);
    const newContent = templateContent.substring(0, start) + before + selected + after + templateContent.substring(end);
    setTemplateContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };
  const previewMimeType = getPreviewMimeType(file);
  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  useEffect(() => {
    return () => {
      if (filePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isFileAllowed(f)) {
      toast({ title: 'Formato não suportado', description: 'Apenas arquivos PDF, PNG e DOC/DOCX são aceitos.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    if (filePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(filePreviewUrl);
    const nextPreviewUrl = URL.createObjectURL(f);
    setFile(f);
    setFileName(f.name);
    setFilePreviewUrl(nextPreviewUrl);
    setEditorTotalPages(3);
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ''));
  };

  const triggerFileInput = () => { fileInputRef.current?.click(); };

  const addSigner = () => {
    setSigners([...signers, { id: genSignerId(), name: '', email: '', phone: '', cpf: '', role: 'Signatário', validationSteps: [] }]);
  };

  const removeSigner = (index: number) => {
    const removed = signers[index];
    setSigners(signers.filter((_, i) => i !== index));
    setPlacedFields(placedFields.filter((f) => f.signerId !== removed.id));
  };

  const updateSigner = (index: number, field: keyof NewSigner, value: string) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    setSigners(updated);
  };

  const toggleValidation = (signerIndex: number, type: PostSignatureValidation) => {
    const updated = [...signers];
    const signer = updated[signerIndex];
    const existing = signer.validationSteps.find(v => v.type === type);
    if (existing) {
      signer.validationSteps = signer.validationSteps.filter(v => v.type !== type);
      signer.validationSteps = signer.validationSteps.map((v, i) => ({ ...v, order: i + 1 }));
    } else {
      const opt = validationOptions.find(o => o.type === type)!;
      signer.validationSteps.push({ id: genValidationId(), type, label: opt.label, order: signer.validationSteps.length + 1, required: true });
    }
    setSigners(updated);
  };

  const moveValidation = (signerIndex: number, valIndex: number, direction: 'up' | 'down') => {
    const updated = [...signers];
    const steps = [...updated[signerIndex].validationSteps];
    const swapIndex = direction === 'up' ? valIndex - 1 : valIndex + 1;
    if (swapIndex < 0 || swapIndex >= steps.length) return;
    [steps[valIndex], steps[swapIndex]] = [steps[swapIndex], steps[valIndex]];
    steps.forEach((s, i) => s.order = i + 1);
    updated[signerIndex].validationSteps = steps;
    setSigners(updated);
  };

  const canAdvance = () => {
    switch (currentStep) {
      case 'upload': return !!fileName || showTemplateEditor;
      case 'signers': return signers.length > 0 && signers.every((s) => s.name && s.email && s.cpf.replace(/\D/g, '').length === 11);
      case 'fields': return true;
      case 'configure': return true;
      case 'review': return true;
    }
  };

  const handleEditorTotalPagesChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    setEditorTotalPages(Math.max(1, Math.min(200, parsed)));
  };

  const handleNext = async () => {
    if (currentStep === 'review') {
      if (!user) {
        toast({ title: 'Erro', description: 'Você precisa estar logado.', variant: 'destructive' });
        return;
      }
      const templateWithFile = templates.find(t => t.id === selectedTemplate && t.caminho_arquivo);
      if (!file && !templateWithFile) {
        toast({ title: 'Erro', description: 'Nenhum documento selecionado. Faça upload de um arquivo ou escolha um modelo.', variant: 'destructive' });
        return;
      }
      setSending(true);
      try {
        let filePath: string;
        if (file) {
          const { path } = await uploadDocumentFile(file, user.id);
          filePath = path;
        } else {
          filePath = templateWithFile!.caminho_arquivo!;
        }
        const doc = await createDocument({ userId: user.id, name: docName || fileName || 'Documento', filePath, signatureType: 'microservice', deadline: hasDeadline ? deadline : undefined, orderMatters });
        const dbSigners = await createSigners(doc.id, signers.map((s, i) => ({ name: s.name, email: s.email, phone: s.phone || undefined, cpf: s.cpf.replace(/\D/g, ''), role: s.role, order: i + 1 })));
        const signerIdMap = new Map<string, string>();
        signers.forEach((s, i) => { if (dbSigners[i]) signerIdMap.set(s.id, dbSigners[i].id); });
        const dbFields = placedFields.map((f) => ({ signerId: signerIdMap.get(f.signerId) || f.signerId, fieldType: f.type, label: f.label, x: f.x, y: f.y, width: f.width, height: f.height, page: f.page, required: f.required }));
        await createDocumentFields(doc.id, dbFields);
        for (const [localId, dbId] of signerIdMap.entries()) {
          const localSigner = signers.find((s) => s.id === localId);
          if (localSigner && localSigner.validationSteps.length > 0) {
            await createValidationSteps(doc.id, dbId, localSigner.validationSteps.map((v) => ({ type: v.type, order: v.order, required: v.required })));
          }
        }
        for (const dbSigner of dbSigners) {
          try {
            await supabase.functions.invoke('send-signing-email', {
              body: { signerName: dbSigner.nome, signerEmail: dbSigner.email, documentName: docName || fileName, signToken: dbSigner.token_assinatura, message },
            });
          } catch (emailErr) {
            console.warn('Email send failed for', dbSigner.email, emailErr);
          }
        }
        toast({ title: 'Documento enviado com sucesso! ✅', description: `${signers.length} signatário(s) receberão o link de assinatura.` });
        navigate('/documents');
      } catch (err) {
        console.error('Error sending document:', err);
        toast({ title: 'Erro ao enviar documento', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
      } finally {
        setSending(false);
      }
      return;
    }
    if (currentStep === 'upload' && file) {
      const isVisualPreviewSupported = previewMimeType === 'application/pdf' || Boolean(previewMimeType?.startsWith('image/'));
      if (!isVisualPreviewSupported) {
        toast({ title: 'Formato sem pré-visualização no editor', description: 'Para posicionar campos com precisão, use PDF ou imagem (JPG/PNG).', variant: 'destructive' });
        return;
      }
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) setCurrentStep(steps[nextIndex].key);
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].key);
  };

  const editorSigners = signers.map((s, i) => ({ id: s.id, name: s.name || `Signatário ${i + 1}`, color: getSignerColor(i) }));
  const isEditorStep = currentStep === 'fields';

  return (
    <>
      <AppHeader title="Novo documento" subtitle={`Passo ${currentStepIndex + 1} de ${steps.length}`} />
      <div className={cn("flex-1 flex flex-col overflow-hidden", !isEditorStep && "overflow-auto")}>
        <div className={cn("space-y-4 shrink-0", isEditorStep ? "px-6 pt-4 pb-2" : "px-6 pt-6")}>
          {!isEditorStep && (
            <Link to="/documents" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />Voltar
            </Link>
          )}

          {/* Stepper */}
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            {steps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => i <= currentStepIndex && setCurrentStep(step.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all',
                    currentStep === step.key
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : i < currentStepIndex
                        ? 'bg-success/10 text-success cursor-pointer hover:bg-success/20'
                        : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {i < currentStepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : <step.icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < steps.length - 1 && <div className={cn('w-4 sm:w-8 h-px', i < currentStepIndex ? 'bg-success' : 'bg-border')} />}
              </div>
            ))}
          </div>
        </div>

        {/* Editor step — fills all available height */}
        {isEditorStep && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden px-4">
              <DocumentFieldEditor
                signers={editorSigners}
                fields={placedFields}
                onFieldsChange={setPlacedFields}
                totalPages={editorTotalPages}
                documentUrl={filePreviewUrl}
              />
            </div>
            {/* Bottom navigation bar — always visible */}
            <div className="shrink-0 border-t border-border bg-card px-6 py-2.5 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-1" />Voltar
              </Button>
              <p className="text-xs text-muted-foreground">
                {placedFields.length} campo(s) posicionado(s)
              </p>
              <Button size="sm" onClick={handleNext}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Non-editor steps content area */}
        {!isEditorStep && (
          <div className="px-6 pb-6 space-y-6">
            {/* Upload step */}
            {currentStep === 'upload' && (
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label>Nome do documento</Label>
                    <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" />
                  </div>

                  <div className="space-y-3">
                    <Label>Arquivo do documento</Label>
                    <input ref={fileInputRef} type="file" accept=".pdf,.png,.doc,.docx" className="hidden" onChange={handleFileChange} />
                    {file ? (
                      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30">
                        <FileText className="w-8 h-8 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fileName}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={triggerFileInput}>Trocar</Button>
                      </div>
                    ) : (
                      <div
                        onClick={triggerFileInput}
                        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-foreground">Clique ou arraste o arquivo</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF, PNG, DOC ou DOCX</p>
                      </div>
                    )}
                  </div>

                  {templates.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <Label>Ou escolha um modelo</Label>
                        <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                          <SelectTrigger><SelectValue placeholder="Selecionar modelo..." /></SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome} {t.categoria ? `(${t.categoria})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {showTemplateEditor && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-xs">Conteúdo do modelo</Label>
                              <Button variant="ghost" size="sm" onClick={handleClearTemplate} className="text-xs h-7">Limpar</Button>
                            </div>
                            <Textarea id="template-content-editor" value={templateContent} onChange={(e) => setTemplateContent(e.target.value)} rows={8} className="font-mono text-xs" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Signers step */}
            {currentStep === 'signers' && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-foreground">Signatários ({signers.length})</h2>
                    <Button size="sm" variant="outline" onClick={addSigner}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
                  </div>
                  {signers.map((s, i) => (
                    <div key={s.id} className="space-y-3 p-4 rounded-lg border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: getSignerColor(i) }}>{i + 1}</div>
                          <span className="text-sm font-medium">Signatário {i + 1}</span>
                        </div>
                        {signers.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSigner(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={s.name} onChange={(e) => updateSigner(i, 'name', e.target.value)} placeholder="Nome completo" /></div>
                        <div className="space-y-1"><Label className="text-xs">Email *</Label><Input type="email" value={s.email} onChange={(e) => updateSigner(i, 'email', e.target.value)} placeholder="email@exemplo.com" /></div>
                        <div className="space-y-1"><Label className="text-xs">CPF *</Label><Input value={s.cpf} onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                          const formatted = digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                          updateSigner(i, 'cpf', formatted);
                        }} placeholder="000.000.000-00" maxLength={14} /></div>
                        <div className="space-y-1"><Label className="text-xs">Telefone</Label><Input value={s.phone} onChange={(e) => updateSigner(i, 'phone', e.target.value)} placeholder="(11) 99999-0000" /></div>
                        <div className="space-y-1">
                          <Label className="text-xs">Papel</Label>
                          <Select value={s.role} onValueChange={(v) => updateSigner(i, 'role', v)}>
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
                      </div>
                      {/* Validations */}
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-semibold text-muted-foreground">Verificação pós-assinatura</p>
                        <div className="flex flex-wrap gap-2">
                          {validationOptions.map((opt) => {
                            const active = s.validationSteps.some(v => v.type === opt.type);
                            return (
                              <button key={opt.type} onClick={() => toggleValidation(i, opt.type)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all', active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:border-primary/50')}>
                                <opt.icon className="w-3.5 h-3.5" />{opt.label}
                              </button>
                            );
                          })}
                        </div>
                        {s.validationSteps.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {s.validationSteps.map((v, vi) => (
                              <div key={v.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-secondary/50">
                                <GripVertical className="w-3 h-3 text-muted-foreground" />
                                <span className="flex-1">{vi + 1}. {v.label}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveValidation(i, vi, 'up')} disabled={vi === 0}><ArrowLeft className="w-3 h-3 rotate-90" /></Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveValidation(i, vi, 'down')} disabled={vi === s.validationSteps.length - 1}><ArrowRight className="w-3 h-3 rotate-90" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Configure step */}
            {currentStep === 'configure' && (
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div><Label>Prazo para assinatura</Label><p className="text-xs text-muted-foreground">Definir uma data limite</p></div>
                    <Switch checked={hasDeadline} onCheckedChange={setHasDeadline} />
                  </div>
                  {hasDeadline && <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
                  <Separator />
                  <div className="space-y-2"><Label>Mensagem para os signatários</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem opcional que aparecerá no email..." rows={3} /></div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div><Label>Ordem de assinatura</Label><p className="text-xs text-muted-foreground">Signatários devem assinar na ordem definida</p></div>
                    <Switch checked={orderMatters} onCheckedChange={setOrderMatters} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Review step */}
            {currentStep === 'review' && (
              <Card>
                <CardContent className="p-6 space-y-6">
                  <h2 className="text-lg font-semibold text-foreground">Revisar e enviar</h2>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">DOCUMENTO</p>
                      <p className="text-sm font-medium">{docName || fileName || 'Sem nome'}</p>
                      {file && <p className="text-xs text-muted-foreground">{fileName} — {(file.size / 1024).toFixed(0)} KB</p>}
                      {placedFields.length > 0 && <p className="text-xs text-muted-foreground">{placedFields.length} campo(s) posicionado(s)</p>}
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">SIGNATÁRIOS ({signers.length})</p>
                      {signers.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2 text-sm">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: getSignerColor(i) }}>{i + 1}</div>
                          <span>{s.name}</span>
                          <span className="text-muted-foreground text-xs">({s.email})</span>
                          {s.cpf && <span className="text-muted-foreground text-xs">CPF: {s.cpf}</span>}
                          {s.validationSteps.length > 0 && <Badge variant="outline" className="text-[10px]">{s.validationSteps.length} verificação(ões)</Badge>}
                        </div>
                      ))}
                    </div>
                    {hasDeadline && deadline && (
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">PRAZO</p>
                        <p className="text-sm">{new Date(deadline).toLocaleString('pt-BR')}</p>
                      </div>
                    )}
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">CONFIGURAÇÕES</p>
                      <p className="text-sm">Ordem de assinatura: {orderMatters ? 'Sequencial' : 'Livre'}</p>
                      {message && <p className="text-sm text-muted-foreground">Mensagem: {message}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Button onClick={handleNext} disabled={!canAdvance() || sending}>
                {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : currentStep === 'review' ? <Send className="w-4 h-4 mr-1" /> : null}
                {currentStep === 'review' ? 'Enviar documento' : 'Próximo'}
                {currentStep !== 'review' && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
