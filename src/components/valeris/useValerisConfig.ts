/**
 * Hook centralizador da integração Valeris.
 * A API key é lida da variável de ambiente VITE_VALERIS_API_KEY.
 *
 * ⚠️ Nota de segurança: para produção, considere proxiar as chamadas
 * via edge function para não expor a chave no bundle do cliente.
 */
export function useValerisConfig() {
  const apiKey = import.meta.env.VITE_VALERIS_API_KEY as string | undefined;

  if (!apiKey) {
    console.warn('[Valeris] VITE_VALERIS_API_KEY não configurada.');
  }

  return { apiKey: apiKey ?? '' };
}