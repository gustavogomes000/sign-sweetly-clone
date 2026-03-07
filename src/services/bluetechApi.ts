// BlueTech Sign API Client
// URLs are configurable - update for your environment

export interface BlueTechConfig {
  gatewayUrl: string;
  assinaturaUrl: string;
  documentoUrl: string;
  selfieDocumentoUrl: string;
  validatorWsUrl: string;
  serviceKey: string;
}

// Default config - reads from localStorage or falls back to localhost
export function getBlueTechConfig(): BlueTechConfig {
  const saved = localStorage.getItem('bluetech_config');
  if (saved) {
    try { return JSON.parse(saved); } catch { /* fall through */ }
  }
  return {
    gatewayUrl: 'http://localhost:33000',
    assinaturaUrl: 'http://localhost:33001',
    documentoUrl: 'http://localhost:33002',
    selfieDocumentoUrl: 'http://localhost:33004',
    validatorWsUrl: 'ws://localhost:38000',
    serviceKey: '',
  };
}

export function saveBlueTechConfig(config: BlueTechConfig) {
  localStorage.setItem('bluetech_config', JSON.stringify(config));
}

const jsonHeaders = (serviceKey: string) => ({
  'Content-Type': 'application/json',
  'x-service-key': serviceKey,
});

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`BlueTech API error (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

export function createBlueTechClient(config: BlueTechConfig) {
  return {
    // Bootstrap test IDs
    bootstrapTestIds: () =>
      request<{ data: { orgId?: string; documentId: string; signatoryId: string } }>(
        `${config.gatewayUrl}/api/v1/dev/bootstrap`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      ),

    // Create token
    createToken: (payload: { name: string; scopes: string[]; expiresInDays?: number }) =>
      request(`${config.gatewayUrl}/api/v1/tokens`, {
        method: 'POST',
        headers: jsonHeaders(config.serviceKey),
        body: JSON.stringify(payload),
      }),

    // Save drawn signature
    saveSignatureDrawn: (payload: {
      signatoryId: string;
      documentId: string;
      imageBase64: string;
      userAgent?: string;
    }) =>
      request(`${config.assinaturaUrl}/api/v1/assinatura/desenho`, {
        method: 'POST',
        headers: jsonHeaders(config.serviceKey),
        body: JSON.stringify(payload),
      }),

    // Save typed signature
    saveSignatureTyped: (payload: {
      signatoryId: string;
      documentId: string;
      text: string;
      userAgent?: string;
    }) =>
      request(`${config.assinaturaUrl}/api/v1/assinatura/tipografica`, {
        method: 'POST',
        headers: jsonHeaders(config.serviceKey),
        body: JSON.stringify(payload),
      }),

    // Upload document photo (KYC)
    uploadDocument: (payload: {
      signatoryId: string;
      documentId: string;
      type: 'rg' | 'cnh' | 'cnh_digital' | 'passport';
      side: 'front' | 'back' | 'single';
      imageBase64: string;
      userAgent?: string;
    }) =>
      request(`${config.documentoUrl}/api/v1/documento/upload`, {
        method: 'POST',
        headers: jsonHeaders(config.serviceKey),
        body: JSON.stringify(payload),
      }),

    // Selfie with document
    uploadSelfieDocument: (payload: {
      signatoryId: string;
      documentId: string;
      imageBase64: string;
      userAgent?: string;
    }) =>
      request(`${config.selfieDocumentoUrl}/api/v1/selfie-documento/capturar`, {
        method: 'POST',
        headers: jsonHeaders(config.serviceKey),
        body: JSON.stringify(payload),
      }),
  };
}
