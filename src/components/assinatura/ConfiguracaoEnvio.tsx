/**
 * Tela 1: Configuração de Envio — Workflow e Lote
 * Permite adicionar participantes, definir papel, ordem e tipo de autenticação.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, Users, Building2, GripVertical, ShieldCheck, Fingerprint, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { bluepointService, type ColaboradorDepartamento } from '@/services/bluepointService';
import { useToast } from '@/hooks/use-toast';

export interface Participante {
  id: string;
  nome: string;
  email: string;
  papel: 'ASSINANTE' | 'OBSERVADOR';
  ordemAssinatura: number;
  tipoAutenticacao: 'EXTERNA_KYC' | 'INTERNA_BLUEPOINT';
  bluepointId?: number;
}

interface ConfiguracaoEnvioProps {
  participantes: Participante[];
  onParticipantesChange: (participantes: Participante[]) => void;
  documentoId?: string;
}

let contadorId = 1;
const gerarId = () => `part_${contadorId++}`;

export function ConfiguracaoEnvio({ participantes, onParticipantesChange }: ConfiguracaoEnvioProps) {
  const [departamentos, setDepartamentos] = useState<Array<{ id: number; nome: string; totalColaboradores: number }>>([]);
  const [carregandoDepts, setCarregandoDepts] = useState(false);
  const [importandoDept, setImportandoDept] = useState(false);
  const [deptSelecionado, setDeptSelecionado] = useState<string>('');
  const [mostrarImportacao, setMostrarImportacao] = useState(false);
  const { toast } = useToast();

  // Carregar departamentos BluePoint
  useEffect(() => {
    if (!mostrarImportacao) return;
    setCarregandoDepts(true);
    bluepointService.listarDepartamentos()
      .then(setDepartamentos)
      .catch((err) => {
        console.warn('Erro ao carregar departamentos:', err);
        toast({ title: 'Aviso', description: 'Não foi possível carregar os departamentos. Adicione participantes manualmente.', variant: 'destructive' });
      })
      .finally(() => setCarregandoDepts(false));
  }, [mostrarImportacao, toast]);

  const adicionarParticipante = () => {
    const proximaOrdem = participantes.filter(p => p.papel === 'ASSINANTE').length + 1;
    onParticipantesChange([
      ...participantes,
      {
        id: gerarId(),
        nome: '',
        email: '',
        papel: 'ASSINANTE',
        ordemAssinatura: proximaOrdem,
        tipoAutenticacao: 'EXTERNA_KYC',
      },
    ]);
  };

  const removerParticipante = (indice: number) => {
    const novos = participantes.filter((_, i) => i !== indice);
    // Reordenar assinantes
    let ordem = 1;
    novos.forEach((p) => {
      if (p.papel === 'ASSINANTE') {
        p.ordemAssinatura = ordem++;
      }
    });
    onParticipantesChange(novos);
  };

  const atualizarParticipante = (indice: number, campo: keyof Participante, valor: string | number) => {
    const novos = [...participantes];
    (novos[indice] as any)[campo] = valor;

    // Se mudou papel para OBSERVADOR, remover da ordem
    if (campo === 'papel' && valor === 'OBSERVADOR') {
      novos[indice].ordemAssinatura = 0;
    } else if (campo === 'papel' && valor === 'ASSINANTE') {
      novos[indice].ordemAssinatura = participantes.filter(p => p.papel === 'ASSINANTE').length + 1;
    }

    onParticipantesChange(novos);
  };

  const importarDepartamento = async () => {
    if (!deptSelecionado) return;
    setImportandoDept(true);
    try {
      const colaboradores = await bluepointService.buscarColaboradoresPorDepartamento(Number(deptSelecionado));
      const novosParticipantes: Participante[] = colaboradores.map((colab, i) => ({
        id: gerarId(),
        nome: colab.nome,
        email: colab.email,
        papel: 'ASSINANTE' as const,
        ordemAssinatura: participantes.filter(p => p.papel === 'ASSINANTE').length + i + 1,
        tipoAutenticacao: 'INTERNA_BLUEPOINT' as const,
        bluepointId: colab.id,
      }));
      onParticipantesChange([...participantes, ...novosParticipantes]);
      toast({ title: `✅ ${novosParticipantes.length} colaborador(es) importados` });
      setMostrarImportacao(false);
    } catch (err) {
      toast({ title: 'Erro ao importar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    } finally {
      setImportandoDept(false);
    }
  };

  const totalAssinantes = participantes.filter(p => p.papel === 'ASSINANTE').length;
  const totalObservadores = participantes.filter(p => p.papel === 'OBSERVADOR').length;

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="gap-1.5 py-1">
          <Users className="w-3.5 h-3.5" />
          {totalAssinantes} assinante{totalAssinantes !== 1 ? 's' : ''}
        </Badge>
        {totalObservadores > 0 && (
          <Badge variant="secondary" className="gap-1.5 py-1">
            {totalObservadores} observador{totalObservadores !== 1 ? 'es' : ''}
          </Badge>
        )}
      </div>

      {/* Importação por departamento */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          {!mostrarImportacao ? (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setMostrarImportacao(true)}
            >
              <Building2 className="w-4 h-4" />
              Importar por Departamento (via BluePoint)
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Importar do BluePoint</Label>
                <Button variant="ghost" size="sm" onClick={() => setMostrarImportacao(false)}>
                  Cancelar
                </Button>
              </div>
              {carregandoDepts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={deptSelecionado} onValueChange={setDeptSelecionado}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione o departamento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departamentos.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.nome} ({dept.totalColaboradores} colaboradores)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={importarDepartamento} disabled={!deptSelecionado || importandoDept}>
                    {importandoDept ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Importar'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de participantes */}
      <div className="space-y-3">
        {participantes.map((participante, indice) => (
          <Card key={participante.id} className="game-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                <div className="mt-2 text-muted-foreground cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>

                <div className="flex-1 space-y-3">
                  {/* Nome e Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input
                        value={participante.nome}
                        onChange={(e) => atualizarParticipante(indice, 'nome', e.target.value)}
                        placeholder="Nome completo"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input
                        type="email"
                        value={participante.email}
                        onChange={(e) => atualizarParticipante(indice, 'email', e.target.value)}
                        placeholder="email@empresa.com"
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Papel, Ordem e Autenticação */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Papel</Label>
                      <Select
                        value={participante.papel}
                        onValueChange={(v) => atualizarParticipante(indice, 'papel', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ASSINANTE">✍️ Assinante</SelectItem>
                          <SelectItem value="OBSERVADOR">👁️ Observador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {participante.papel === 'ASSINANTE' && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Ordem de assinatura</Label>
                        <Input
                          type="number"
                          min={1}
                          value={participante.ordemAssinatura}
                          onChange={(e) => atualizarParticipante(indice, 'ordemAssinatura', Number(e.target.value))}
                          className="h-9"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Autenticação</Label>
                      <Select
                        value={participante.tipoAutenticacao}
                        onValueChange={(v) => atualizarParticipante(indice, 'tipoAutenticacao', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EXTERNA_KYC">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              KYC Completo (Selfie + CNH)
                            </span>
                          </SelectItem>
                          <SelectItem value="INTERNA_BLUEPOINT">
                            <span className="flex items-center gap-1.5">
                              <Fingerprint className="w-3.5 h-3.5" />
                              Biometria BluePoint
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Badge de tipo */}
                  {participante.bluepointId && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Fingerprint className="w-3 h-3" />
                      BluePoint #{participante.bluepointId}
                    </Badge>
                  )}
                </div>

                {/* Remover */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removerParticipante(indice)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Adicionar participante */}
      <Button variant="outline" className="w-full gap-2" onClick={adicionarParticipante}>
        <Plus className="w-4 h-4" />
        Adicionar participante
      </Button>
    </div>
  );
}
