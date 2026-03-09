import React, { useState } from 'react';

export interface VLDocumentoProps {
  apiKey: string;
  aoCompletar?: (dados: any) => void;
  onError?: (erro: any) => void;
}

export function VLDocumento({ apiKey, aoCompletar, onError }: VLDocumentoProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (data: any) => {
    try {
      setLoading(true);
      const endpoint = '/v2/documento/capturar';
      const response = await fetch(`https://api.valeris.com.br${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro na requisição');
      
      aoCompletar?.(result);
    } catch (err) {
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border border-border rounded-lg bg-card text-foreground">
      <h3 className="text-lg font-bold mb-4">VLDocumento</h3>
      {/* Implemente a UI de captura do componente aqui */}
      <button 
        onClick={() => handleAction({ /* dados de exemplo */ })} 
        disabled={loading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Processando...' : 'Testar Integração'}
      </button>
    </div>
  );
}