import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Upload, Plus, Trash2, FileText, CheckCircle2, Users, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type Step = 'upload' | 'signers' | 'configure' | 'review';

interface NewSigner {
  name: string;
  email: string;
  role: string;
}

const steps: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'upload', label: 'Documento', icon: Upload },
  { key: 'signers', label: 'Signatários', icon: Users },
  { key: 'configure', label: 'Configurar', icon: FileText },
  { key: 'review', label: 'Revisar e enviar', icon: Send },
];

export default function NewDocument() {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [docName, setDocName] = useState('');
  const [signers, setSigners] = useState<NewSigner[]>([{ name: '', email: '', role: 'Signatário' }]);
  const [signatureType, setSignatureType] = useState('electronic');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  const handleFileUpload = () => {
    setFileName('documento-exemplo.pdf');
    if (!docName) setDocName('documento-exemplo');
  };

  const addSigner = () => {
    setSigners([...signers, { name: '', email: '', role: 'Signatário' }]);
  };

  const removeSigner = (index: number) => {
    setSigners(signers.filter((_, i) => i !== index));
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
      case 'configure': return true;
      case 'review': return true;
    }
  };

  const handleNext = () => {
    if (currentStep === 'review') {
      toast({ title: 'Documento enviado!', description: 'Os signatários receberão o documento por email.' });
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

  return (
    <>
      <AppHeader title="Novo documento" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Link to="/documents" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              <button
                onClick={() => i <= currentStepIndex && setCurrentStep(step.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  currentStep === step.key
                    ? 'bg-primary text-primary-foreground'
                    : i < currentStepIndex
                    ? 'bg-success/15 text-success cursor-pointer'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {i < currentStepIndex ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <step.icon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card className="max-w-2xl mx-auto animate-fade-in">
          {currentStep === 'upload' && (
            <>
              <CardHeader>
                <CardTitle className="text-base">Enviar documento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onClick={handleFileUpload}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
                    fileName
                      ? 'border-success bg-success/5'
                      : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                  )}
                >
                  {fileName ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-10 h-10 text-success" />
                      <p className="text-sm font-medium text-foreground">{fileName}</p>
                      <p className="text-xs text-muted-foreground">Clique para trocar o arquivo</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Clique para enviar seu documento</p>
                      <p className="text-xs text-muted-foreground">PDF, DOCX ou imagem (máx. 20MB)</p>
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
                <CardTitle className="text-base">Adicionar signatários</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {signers.map((signer, i) => (
                  <div key={i} className="space-y-3 p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Signatário {i + 1}</span>
                      {signers.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSigner(i)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input value={signer.name} onChange={(e) => updateSigner(i, 'name', e.target.value)} placeholder="Nome completo" className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={signer.email} onChange={(e) => updateSigner(i, 'email', e.target.value)} placeholder="email@exemplo.com" className="h-9" />
                      </div>
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
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addSigner} className="w-full">
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar signatário
                </Button>
              </CardContent>
            </>
          )}

          {currentStep === 'configure' && (
            <>
              <CardHeader>
                <CardTitle className="text-base">Configurações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de assinatura</Label>
                  <Select value={signatureType} onValueChange={setSignatureType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronic">Assinatura Eletrônica</SelectItem>
                      <SelectItem value="digital">Assinatura Digital (ICP-Brasil)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Prazo para assinatura</p>
                    <p className="text-xs text-muted-foreground">Defina uma data limite</p>
                  </div>
                  <Switch checked={hasDeadline} onCheckedChange={setHasDeadline} />
                </div>
                {hasDeadline && (
                  <div className="space-y-2">
                    <Label>Data limite</Label>
                    <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Mensagem para os signatários (opcional)</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva uma mensagem que será enviada junto com o documento..." rows={3} />
                </div>
              </CardContent>
            </>
          )}

          {currentStep === 'review' && (
            <>
              <CardHeader>
                <CardTitle className="text-base">Revisar e enviar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Documento</p>
                    <p className="text-sm font-medium">{docName || fileName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Arquivo</p>
                    <p className="text-sm">{fileName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo de assinatura</p>
                    <p className="text-sm">{signatureType === 'electronic' ? 'Eletrônica' : 'Digital (ICP-Brasil)'}</p>
                  </div>
                  {hasDeadline && deadline && (
                    <div>
                      <p className="text-xs text-muted-foreground">Prazo</p>
                      <p className="text-sm">{deadline}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Signatários ({signers.length})</p>
                  {signers.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs text-primary font-medium">{i + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email} · {s.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {message && (
                  <div>
                    <p className="text-xs text-muted-foreground">Mensagem</p>
                    <p className="text-sm">{message}</p>
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between p-6 pt-0">
            <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={handleNext} disabled={!canAdvance()}>
              {currentStep === 'review' ? (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Enviar documento
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
