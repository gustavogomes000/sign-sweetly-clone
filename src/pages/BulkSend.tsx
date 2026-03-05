import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Upload, Plus, Trash2, FileText, Send } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function BulkSend() {
  const [csvUploaded, setCsvUploaded] = useState(false);
  const [templateSelected, setTemplateSelected] = useState(false);
  const { toast } = useToast();

  const handleSend = () => {
    toast({ title: 'Envio em massa iniciado! 🚀', description: '150 documentos serão enviados nas próximas horas.' });
  };

  return (
    <>
      <AppHeader title="Envio em massa" subtitle="Envie documentos para múltiplos signatários de uma vez" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Step 1: Template */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                Selecionar modelo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onClick={() => setTemplateSelected(true)}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                  templateSelected ? 'border-success bg-success/5' : 'border-border hover:border-primary/50'
                )}
              >
                {templateSelected ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-success" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Contrato de Prestação de Serviços</p>
                      <p className="text-xs text-muted-foreground">Modelo com 4 campos configurados</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Clique para selecionar um modelo</p>
                    <p className="text-xs text-muted-foreground mt-1">O modelo será usado como base para todos os envios</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: CSV */}
          <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
                Importar lista de signatários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onClick={() => setCsvUploaded(true)}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                  csvUploaded ? 'border-success bg-success/5' : 'border-border hover:border-primary/50'
                )}
              >
                {csvUploaded ? (
                  <div>
                    <p className="text-sm font-medium text-success">signatarios.csv carregado ✓</p>
                    <p className="text-xs text-muted-foreground mt-1">150 signatários encontrados</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Faça upload de um CSV</p>
                    <p className="text-xs text-muted-foreground mt-1">Colunas: nome, email, telefone (opcional)</p>
                  </>
                )}
              </div>
              <Button variant="link" className="text-xs p-0 h-auto">
                ↓ Baixar modelo de CSV
              </Button>
            </CardContent>
          </Card>

          {/* Step 3: Preview & Send */}
          {csvUploaded && templateSelected && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
                  Confirmar e enviar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Modelo:</span><span className="font-medium">Contrato de Prestação de Serviços</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Signatários:</span><span className="font-medium">150</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Documentos a criar:</span><span className="font-medium">150</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Notificação:</span><span className="font-medium">Email</span></div>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem personalizada (opcional)</Label>
                  <Textarea placeholder="Mensagem para todos os signatários..." rows={3} />
                </div>
                <Button className="w-full shadow-lg shadow-primary/20" onClick={handleSend}>
                  <Send className="w-4 h-4 mr-1" />
                  Enviar 150 documentos
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
