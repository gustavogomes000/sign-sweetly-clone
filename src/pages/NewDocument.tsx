import { useState, useRef, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Upload, Plus, Trash2, FileText, CheckCircle2, Users, Send, Settings2, Pencil, Camera, FileImage, UserCheck, GripVertical, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PostSignatureValidation, ValidationStep } from '@/types/document';
import { Badge } from '@/components/ui/badge';
import { mockTemplates } from '@/data/mockData';
import DocumentFieldEditor, { PlacedField, getSignerColor } from '@/components/documents/DocumentFieldEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { uploadDocumentFile, createDocument, createSigners, createDocumentFields, createValidationSteps } from '@/services/documentService';
import { supabase } from '@/integrations/supabase/client';

type Step = 'upload' | 'signers' | 'fields' | 'configure' | 'review';

interface NewSigner {
  id: string;
  name: string;
  email: string;
  phone: string;
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
  const [signers, setSigners] = useState<NewSigner[]>([
    { id: genSignerId(), name: '', email: '', phone: '', role: 'Signatário', validationSteps: [] },
  ]);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [signatureType, setSignatureType] = useState('electronic');
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

    if (filePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    const nextPreviewUrl = URL.createObjectURL(f);
    setFile(f);
    setFileName(f.name);
    setFilePreviewUrl(nextPreviewUrl);
    setEditorTotalPages(3);
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ''));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const addSigner = () => {
    setSigners([...signers, { id: genSignerId(), name: '', email: '', phone: '', role: 'Signatário', validationSteps: [] }]);
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
      // Reorder
      signer.validationSteps = signer.validationSteps.map((v, i) => ({ ...v, order: i + 1 }));
    } else {
      const opt = validationOptions.find(o => o.type === type)!;
      signer.validationSteps.push({
        id: genValidationId(),
        type,
        label: opt.label,
        order: signer.validationSteps.length + 1,
        required: true,
      });
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
      case 'upload': return !!fileName;
      case 'signers': return signers.length > 0 && signers.every((s) => s.name && s.email);
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
      if (!file || !user) return;
      setSending(true);
      try {
        // 1. Upload file to storage
        const { path } = await uploadDocumentFile(file, user.id);
        
        // 2. Create document record
        const doc = await createDocument({
          userId: user.id,
          name: docName || fileName,
          filePath: path,
          signatureType,
          deadline: hasDeadline ? deadline : undefined,
        });
        
        // 3. Create signers
        const dbSigners = await createSigners(
          doc.id,
          signers.map((s, i) => ({
            name: s.name,
            email: s.email,
            phone: s.phone || undefined,
            role: s.role,
            order: i + 1,
          }))
        );
        
        // 4. Map local signer IDs to DB IDs and create fields
        const signerIdMap = new Map<string, string>();
        signers.forEach((s, i) => {
          if (dbSigners[i]) signerIdMap.set(s.id, dbSigners[i].id);
        });
        
        const dbFields = placedFields.map((f) => ({
          signerId: signerIdMap.get(f.signerId) || f.signerId,
          fieldType: f.type,
          label: f.label,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          page: f.page,
          required: f.required,
        }));
        
        await createDocumentFields(doc.id, dbFields);
        
        // 5. Create validation steps for each signer
        for (const [localId, dbId] of signerIdMap.entries()) {
          const localSigner = signers.find((s) => s.id === localId);
          if (localSigner && localSigner.validationSteps.length > 0) {
            await createValidationSteps(
              doc.id,
              dbId,
              localSigner.validationSteps.map((v) => ({
                type: v.type,
                order: v.order,
                required: v.required,
              }))
            );
          }
        }
        
        // 6. Send email notifications via edge function
        for (const dbSigner of dbSigners) {
          try {
            await supabase.functions.invoke('send-signing-email', {
              body: {
                signerName: dbSigner.name,
                signerEmail: dbSigner.email,
                documentName: docName || fileName,
                signToken: dbSigner.sign_token,
                message,
              },
            });
          } catch (emailErr) {
            console.warn('Email send failed for', dbSigner.email, emailErr);
          }
        }
        
        toast({
          title: 'Documento enviado com sucesso! ✅',
          description: `${signers.length} signatário(s) receberão o link de assinatura.`,
        });
        navigate('/documents');
      } catch (err) {
        console.error('Error sending document:', err);
        toast({
          title: 'Erro ao enviar documento',
          description: err instanceof Error ? err.message : 'Tente novamente',
          variant: 'destructive',
        });
      } finally {
        setSending(false);
      }
      return;
    }
    if (currentStep === 'upload' && file) {
      const isVisualPreviewSupported = previewMimeType === 'application/pdf' || Boolean(previewMimeType?.startsWith('image/'));
      if (!isVisualPreviewSupported) {
        toast({
          title: 'Formato sem pré-visualização no editor',
          description: 'Para posicionar campos com precisão, use PDF ou imagem (JPG/PNG).',
          variant: 'destructive',
        });
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

  const editorSigners = signers.map((s, i) => ({
    id: s.id,
    name: s.name || `Signatário ${i + 1}`,
    color: getSignerColor(i),
  }));

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

        {/* Editor step */}
        {isEditorStep && (
          <div className="flex-1 flex flex-col min-h-0 px-6 pb-4">
            <div className="flex items-center justify-between py-3 gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Posicionar campos no documento</h2>
                <p className="text-xs text-muted-foreground">Navegue por todas as páginas e marque exatamente onde cada signatário deve assinar</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="total-pages" className="text-xs text-muted-foreground whitespace-nowrap">Total de páginas</Label>
                  <Input
                    id="total-pages"
                    type="number"
                    min={1}
                    max={200}
                    value={editorTotalPages}
                    onChange={(e) => handleEditorTotalPagesChange(e.target.value)}
                    className="h-8 w-24"
                  />
                </div>
                <Badge variant="secondary" className="text-xs">{placedFields.length} campo(s)</Badge>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <DocumentFieldEditor
                signers={editorSigners}
                fields={placedFields}
                onFieldsChange={setPlacedFields}
                totalPages={editorTotalPages}
                documentUrl={filePreviewUrl}
                documentMimeType={previewMimeType}
              />
            </div>
            <div className="flex items-center justify-between pt-3">
              <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Button onClick={handleNext}>Próximo <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {/* Non-editor steps */}
        {!isEditorStep && (
          <div className="flex-1 overflow-auto px-6 pb-6">
            <Card className="max-w-2xl mx-auto animate-fade-in mt-4">
              {currentStep === 'upload' && (
                <>
                  <CardHeader><CardTitle className="text-base">Enviar documento</CardTitle></CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label>Usar modelo (opcional)</Label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger><SelectValue placeholder="Selecionar modelo..." /></SelectTrigger>
                        <SelectContent>
                          {mockTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex items-center gap-2">
                                <span>{t.name}</span>
                                {t.category && <Badge variant="secondary" className="text-[10px] h-4">{t.category}</Badge>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><Separator /></div>
                      <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">ou faça upload</span></div>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                    <div
                      onClick={triggerFileInput}
                      className={cn(
                        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
                        fileName ? 'border-success bg-success/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'
                      )}
                    >
                      {fileName ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-success" />
                          </div>
                          <p className="text-sm font-medium text-foreground">{fileName}</p>
                          <p className="text-xs text-muted-foreground">Clique para trocar o arquivo</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
                            <Upload className="w-7 h-7 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground">Clique ou arraste seu documento</p>
                          <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPEG, PNG (máx. 20MB)</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do documento</Label>
                      <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" />
                    </div>
                  </CardContent>
                </>
              )}

              {currentStep === 'signers' && (
                <>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Signatários</CardTitle>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="order" className="text-xs text-muted-foreground">Ordem importa</Label>
                        <Switch id="order" checked={orderMatters} onCheckedChange={setOrderMatters} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {signers.map((signer, i) => (
                      <div key={signer.id} className="space-y-3 p-4 rounded-xl border border-border/50 relative" style={{ backgroundColor: `${getSignerColor(i)}08` }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${getSignerColor(i)}20` }}>
                              <span className="text-xs font-bold" style={{ color: getSignerColor(i) }}>{i + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">Signatário {i + 1}</span>
                          </div>
                          {signers.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSigner(i)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nome *</Label>
                            <Input value={signer.name} onChange={(e) => updateSigner(i, 'name', e.target.value)} placeholder="Nome completo" className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Email *</Label>
                            <Input type="email" value={signer.email} onChange={(e) => updateSigner(i, 'email', e.target.value)} placeholder="email@exemplo.com" className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Telefone</Label>
                            <Input value={signer.phone} onChange={(e) => updateSigner(i, 'phone', e.target.value)} placeholder="(11) 99999-0000" className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Papel</Label>
                            <Select value={signer.role} onValueChange={(v) => updateSigner(i, 'role', v)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Signatário">Signatário</SelectItem>
                                <SelectItem value="Contratante">Contratante</SelectItem>
                                <SelectItem value="Contratada">Contratada</SelectItem>
                                <SelectItem value="Testemunha">Testemunha</SelectItem>
                                <SelectItem value="Aprovador">Aprovador</SelectItem>
                                <SelectItem value="Fiador">Fiador</SelectItem>
                                <SelectItem value="Representante Legal">Representante Legal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Post-signature validation flow */}
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">Validações pós-assinatura</p>
                            <p className="text-[10px] text-muted-foreground">{signer.validationSteps.length} selecionada(s)</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Marque as etapas que o signatário deve completar após assinar. A ordem pode ser alterada.</p>
                          <div className="space-y-2">
                            {validationOptions.map((opt) => {
                              const isSelected = signer.validationSteps.some(v => v.type === opt.type);
                              return (
                                <div
                                  key={opt.type}
                                  onClick={() => toggleValidation(i, opt.type)}
                                  className={cn(
                                    'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
                                    isSelected ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30'
                                  )}
                                >
                                  <Checkbox checked={isSelected} className="pointer-events-none" />
                                  <opt.icon className={cn('w-4 h-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground">{opt.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Ordered list of selected validations */}
                          {signer.validationSteps.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ordem do fluxo</p>
                              {signer.validationSteps.sort((a, b) => a.order - b.order).map((step, vi) => (
                                <div key={step.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs font-bold text-primary w-4">{step.order}</span>
                                  <span className="text-xs text-foreground flex-1">{step.label}</span>
                                  <div className="flex gap-0.5">
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveValidation(i, vi, 'up'); }} disabled={vi === 0}>
                                      <ArrowLeft className="w-2.5 h-2.5 rotate-90" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveValidation(i, vi, 'down'); }} disabled={vi === signer.validationSteps.length - 1}>
                                      <ArrowRight className="w-2.5 h-2.5 rotate-90" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" onClick={addSigner} className="w-full border-dashed">
                      <Plus className="w-4 h-4 mr-1" />Adicionar signatário
                    </Button>
                  </CardContent>
                </>
              )}

              {currentStep === 'configure' && (
                <>
                  <CardHeader><CardTitle className="text-base">Configurações do envio</CardTitle></CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label>Tipo de assinatura</Label>
                      <RadioGroup value={signatureType} onValueChange={setSignatureType} className="grid grid-cols-2 gap-3">
                        <label className={cn(
                          'flex flex-col p-4 rounded-xl border cursor-pointer transition-all',
                          signatureType === 'electronic' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        )}>
                          <RadioGroupItem value="electronic" className="sr-only" />
                          <span className="text-sm font-medium">Eletrônica</span>
                          <span className="text-xs text-muted-foreground mt-1">Mais simples e rápida. Validade jurídica pela MP 2.200-2.</span>
                        </label>
                        <label className={cn(
                          'flex flex-col p-4 rounded-xl border cursor-pointer transition-all',
                          signatureType === 'digital' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        )}>
                          <RadioGroupItem value="digital" className="sr-only" />
                          <span className="text-sm font-medium">Digital (ICP-Brasil)</span>
                          <span className="text-xs text-muted-foreground mt-1">Certificado digital A1/A3. Máxima segurança jurídica.</span>
                        </label>
                      </RadioGroup>
                    </div>
                    <Separator />
                    <div className="rounded-lg bg-secondary/40 p-3">
                      <p className="text-xs font-medium text-foreground">📧 Notificação via Email</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Todos os signatários receberão o documento por email</p>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Prazo para assinatura</p>
                        <p className="text-xs text-muted-foreground">Defina uma data limite</p>
                      </div>
                      <Switch checked={hasDeadline} onCheckedChange={setHasDeadline} />
                    </div>
                    {hasDeadline && <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Lembretes automáticos</p>
                        <p className="text-xs text-muted-foreground">Enviar lembretes para pendentes</p>
                      </div>
                      <Switch checked={enableReminders} onCheckedChange={setEnableReminders} />
                    </div>
                    {enableReminders && (
                      <Select value={reminderDays} onValueChange={setReminderDays}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">A cada 1 dia</SelectItem>
                          <SelectItem value="2">A cada 2 dias</SelectItem>
                          <SelectItem value="3">A cada 3 dias</SelectItem>
                          <SelectItem value="5">A cada 5 dias</SelectItem>
                          <SelectItem value="7">A cada 7 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Separator />
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <Select value={locale} onValueChange={setLocale}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem personalizada (opcional)</Label>
                      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem que será enviada junto..." rows={3} />
                    </div>
                  </CardContent>
                </>
              )}

              {currentStep === 'review' && (
                <>
                  <CardHeader><CardTitle className="text-base">Revisar e enviar</CardTitle></CardHeader>
                  <CardContent className="space-y-5">
                    <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{docName || fileName}</p>
                          <p className="text-xs text-muted-foreground">{fileName}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{signatureType === 'electronic' ? 'Eletrônica' : 'Digital'}</span></div>
                        <div><span className="text-muted-foreground">Notificação:</span> <span className="font-medium">Email</span></div>
                        <div><span className="text-muted-foreground">Campos:</span> <span className="font-medium">{placedFields.length}</span></div>
                        {hasDeadline && deadline && <div><span className="text-muted-foreground">Prazo:</span> <span className="font-medium">{deadline}</span></div>}
                        {enableReminders && <div><span className="text-muted-foreground">Lembretes:</span> <span className="font-medium">A cada {reminderDays} dias</span></div>}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-3">Signatários ({signers.length})</p>
                      <div className="space-y-2">
                        {signers.map((s, i) => {
                          const signerFields = placedFields.filter((f) => f.signerId === s.id);
                          return (
                            <div key={s.id} className="p-3 rounded-lg bg-secondary/40 space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${getSignerColor(i)}20` }}>
                                  <span className="text-xs font-bold" style={{ color: getSignerColor(i) }}>{i + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{s.name}</p>
                                  <p className="text-xs text-muted-foreground">{s.email} · {signerFields.length} campo(s)</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] h-5">{s.role}</Badge>
                              </div>
                              {s.validationSteps.length > 0 && (
                                <div className="pl-11 flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">Pós-assinatura:</span>
                                  {s.validationSteps.sort((a, b) => a.order - b.order).map((v, vi) => (
                                    <Badge key={v.id} variant="secondary" className="text-[10px] h-4">
                                      {vi + 1}. {v.label}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {message && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                        <p className="text-sm bg-secondary/40 p-3 rounded-lg">{message}</p>
                      </div>
                    )}
                  </CardContent>
                </>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between p-6 pt-2">
                <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0}>
                  <ArrowLeft className="w-4 h-4 mr-1" />Voltar
                </Button>
                <Button onClick={handleNext} disabled={!canAdvance() || sending} className={currentStep === 'review' ? 'shadow-lg shadow-primary/20' : ''}>
                  {currentStep === 'review' ? (
                    sending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Enviando...</> : <><Send className="w-4 h-4 mr-1" />Enviar documento</>
                  ) : (
                    <>Próximo<ArrowRight className="w-4 h-4 ml-1" /></>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
