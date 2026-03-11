/**
 * Serviço de download seguro com validação de integridade SHA-256.
 * Todos os downloads passam pela edge function validar-download que:
 * 1. Verifica cabeçalho PDF (Magic Number)
 * 2. Valida tamanho mínimo
 * 3. Recalcula e compara hash SHA-256 com o armazenado
 * 4. Verifica trailer %%EOF
 * 5. Registra na trilha de auditoria
 */
import { supabase } from '@/integrations/supabase/client';

export type TipoDownload = 'assinado' | 'dossie' | 'original';

interface DownloadResult {
  sucesso: boolean;
  erro?: string;
  detalhe?: string;
}

/**
 * Realiza download validado de um documento.
 * A edge function verifica a integridade SHA-256 antes de servir o arquivo.
 */
export async function downloadValidado(
  documentoId: string,
  tipo: TipoDownload
): Promise<DownloadResult> {
  try {
    const { data, error } = await supabase.functions.invoke('validar-download', {
      body: { documentoId, tipo },
    });

    if (error) {
      // Se retornou JSON de erro (integridade comprometida)
      const errorMsg = error.message || 'Erro ao validar download';
      return { sucesso: false, erro: errorMsg };
    }

    // Se a resposta é um Blob/ArrayBuffer (PDF binário)
    if (data instanceof Blob) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documento_${tipo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { sucesso: true };
    }

    // Se retornou JSON, pode ser erro de validação
    if (data && typeof data === 'object' && data.error) {
      return {
        sucesso: false,
        erro: data.error,
        detalhe: data.detalhe || '',
      };
    }

    return { sucesso: false, erro: 'Resposta inesperada do servidor' };
  } catch (err) {
    console.error('[downloadValidado] Erro:', err);
    return {
      sucesso: false,
      erro: err instanceof Error ? err.message : 'Erro desconhecido',
    };
  }
}

/**
 * Wrapper que tenta download validado e mostra feedback via toast.
 */
export async function downloadComFeedback(
  documentoId: string,
  tipo: TipoDownload,
  toast: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
): Promise<void> {
  const labels: Record<TipoDownload, string> = {
    assinado: 'PDF Assinado',
    dossie: 'Dossiê de Auditoria',
    original: 'Original',
  };

  toast({ title: `Validando integridade do ${labels[tipo]}...` });

  const result = await downloadValidado(documentoId, tipo);

  if (result.sucesso) {
    toast({ title: `✅ ${labels[tipo]} baixado com integridade verificada` });
  } else {
    toast({
      title: `🚫 Download bloqueado — ${result.erro}`,
      description: result.detalhe || 'O arquivo não passou na validação de segurança SHA-256.',
      variant: 'destructive',
    });
  }
}
