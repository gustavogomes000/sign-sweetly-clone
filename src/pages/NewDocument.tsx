import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Upload, Plus, Trash2, FileText, CheckCircle2, Users, Send, Settings2, Pencil } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AuthMethod, NotifyVia } from '@/types/document';
import { Badge } from '@/components/ui/badge';
import { mockTemplates } from '@/data/mockData';
import DocumentFieldEditor, { PlacedField, getSignerColor } from '@/components/documents/DocumentFieldEditor';

type Step = 'upload' | 'signers' | 'fields' | 'configure' | 'review';

interface NewSigner {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  authMethod: AuthMethod;
}

const steps: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'upload', label: 'Documento', icon: Upload },
  { key: 'signers', label: 'Signatários', icon: Users },
  { key: 'fields', label: 'Campos', icon: Pencil },
  { key: 'configure', label: 'Configurar', icon: Settings2 },
  { key: 'review', label: 'Enviar', icon: Send },
];

const authMethods: { value: AuthMethod; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'pix', label: 'Pix' },
  { value: 'selfie', label: 'Selfie' },
  { value: 'token', label: 'Token' },
];

let signerIdCounter = 1;
const genSignerId = () => `signer_${signerIdCounter++}`;

export default function NewDocument() {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [docName, setDocName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [signers, setSigners] = useState<NewSigner[]>([
    { id: genSignerId(), name: '', email: '', phone: '', role: 'Signatário', authMethod: 'email' },
  ]);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [signatureType, setSignatureType] = useState('electronic');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  const [notifyVia, setNotifyVia] = useState<NotifyVia>('email');
  const [enableReminders, setEnableReminders] = useState(true);
  const [reminderDays, setReminderDays] = useState('3');
  const [orderMatters, setOrderMatters] = useState(false);
  const [locale, setLocale] = useState('pt-BR');
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  const handleFileUpload = () => {
    setFileName('contrato-servicos.pdf');
    if (!docName) setDocName('Contrato de Serviços');
  };

  const addSigner = () => {
    setSigners([...signers, { id: genSignerId(), name: '', email: '', phone: '', role: 'Signatário', authMethod: 'email' }]);
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

  const canAdvance = () => {
    switch (currentStep) {
      case 'upload': return !!fileName;
      case 'signers': return signers.length > 0 && signers.every((s) => s.name && s.email);
      case 'fields': return true;
      case 'configure': return true;
      case 'review': return true;
    }
  };

  const handleNext = () => {
    if (currentStep === 'review') {
      toast({ title: 'Documento enviado com sucesso! ✅', description: `${signers.length} signatário(s) receberão o documento via ${notifyVia}.` });
      navigate('/documents');
      return;
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
              <ArrowLeft className="w-4 h-4" />
              Voltar
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
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <step.icon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={cn('w-4 sm:w-8 h-px', i < currentStepIndex ? 'bg-success' : 'bg-border')} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Editor step - full height */}
        {isEditorStep && (
          <div className="flex-1 flex flex-col min-h-0 px-6 pb-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Posicionar campos no documento</h2>
                <p className="text-xs text-muted-foreground">Arraste campos da barra lateral e posicione-os onde os signatários devem preencher</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{placedFields.length} campo(s)</Badge>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <DocumentFieldEditor
                signers={editorSigners}
                fields={placedFields}
                onFieldsChange={setPlacedFields}
                totalPages={3}
              />
            </div>
            <div className="flex items-center justify-between pt-3">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-1" />Voltar
              </Button>
              <Button onClick={handleNext}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
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

                    <div
                      onClick={handleFileUpload}
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
                        <div className="space-y-1">
                          <Label className="text-xs">Método de autenticação</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {authMethods.map((method) => (
                              <button
                                key={method.value}
                                onClick={() => updateSigner(i, 'authMethod', method.value)}
                                className={cn(
                                  'p-2 rounded-lg border text-center transition-all text-xs',
                                  signer.authMethod === method.value
                                    ? 'border-primary bg-primary/5 text-primary font-medium'
                                    : 'border-border hover:border-primary/30 text-muted-foreground'
                                )}
                              >
                                {method.label}
                              </button>
                            ))}
                          </div>
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
                    <div className="space-y-2">
                      <Label>Canal de notificação</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['email', 'whatsapp', 'sms'] as NotifyVia[]).map((ch) => (
                          <button
                            key={ch}
                            onClick={() => setNotifyVia(ch)}
                            className={cn(
                              'p-3 rounded-xl border text-center transition-all',
                              notifyVia === ch ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/30'
                            )}
                          >
                            <span className="text-sm capitalize">{ch}</span>
                          </button>
                        ))}
                      </div>
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
                        <div><span className="text-muted-foreground">Notificação:</span> <span className="font-medium capitalize">{notifyVia}</span></div>
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
                            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${getSignerColor(i)}20` }}>
                                <span className="text-xs font-bold" style={{ color: getSignerColor(i) }}>{i + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.email} · {signerFields.length} campo(s)</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] h-5">{s.role}</Badge>
                                <Badge variant="secondary" className="text-[10px] h-5 capitalize">{s.authMethod}</Badge>
                              </div>
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
                <Button onClick={handleNext} disabled={!canAdvance()} className={currentStep === 'review' ? 'shadow-lg shadow-primary/20' : ''}>
                  {currentStep === 'review' ? (
                    <><Send className="w-4 h-4 mr-1" />Enviar documento</>
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
