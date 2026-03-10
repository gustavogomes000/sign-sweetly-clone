/**
 * Client-side helper to call BlueTech microservices through our Edge Function proxy.
 * This avoids exposing microservice URLs or service keys in the browser.
 */
import { supabase } from '@/integrations/supabase/client';

async function callProxy<T = unknown>(service: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('bluetech-proxy', {
    body: { service, payload },
  });

  if (error) {
    throw new Error(`BlueTech proxy error: ${error.message}`);
  }

  return data as T;
}

export const bluetechProxy = {
  /** Save drawn signature → ms-assinatura */
  saveSignatureDrawn: (payload: {
    signatoryId: string;
    documentId: string;
    imageBase64: string;
    userAgent?: string;
    ip?: string;
    latitude?: number;
    longitude?: number;
  }) => callProxy('assinatura/desenho', payload),

  /** Save typed signature → ms-assinatura */
  saveSignatureTyped: (payload: {
    signatoryId: string;
    documentId: string;
    text: string;
    userAgent?: string;
    ip?: string;
    latitude?: number;
    longitude?: number;
  }) => callProxy('assinatura/tipografica', payload),

  /** Upload document photo (KYC) → ms-documento */
  uploadDocument: (payload: {
    signatoryId: string;
    documentId: string;
    type: string;
    side: string;
    imageBase64: string;
    userAgent?: string;
  }) => callProxy('documento/upload', payload),

  /** Selfie with document → ms-selfie-documento */
  captureSelfieDocument: (payload: {
    signatoryId: string;
    documentId: string;
    imageBase64: string;
    userAgent?: string;
  }) => callProxy('selfie-documento/capturar', payload),
};
