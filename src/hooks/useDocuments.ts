import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DbDocument {
  id: string;
  nome: string;
  status: string;
  tipo_assinatura: string;
  caminho_arquivo: string | null;
  caminho_pdf_final: string | null;
  caminho_pdf_dossie: string | null;
  prazo: string | null;
  criado_em: string;
  atualizado_em: string;
  usuario_id: string;
}

export interface DbSigner {
  id: string;
  documento_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  funcao: string;
  ordem_assinatura: number;
  status: string;
  assinado_em: string | null;
  token_assinatura: string | null;
}

export interface DbAuditEntry {
  id: string;
  documento_id: string;
  acao: string;
  ator: string;
  detalhes: string | null;
  criado_em: string;
  signatario_id: string | null;
  endereco_ip: string | null;
}

export interface DbDocumentField {
  id: string;
  documento_id: string;
  signatario_id: string | null;
  tipo_campo: string;
  rotulo: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  pagina: number;
  obrigatorio: boolean;
  valor: string | null;
}

export interface DocumentWithRelations extends DbDocument {
  signers: DbSigner[];
  audit_trail: DbAuditEntry[];
  document_fields: DbDocumentField[];
}

// Fetch all documents for the current user with signers
export function useDocuments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['documents', user?.id],
    queryFn: async (): Promise<DocumentWithRelations[]> => {
      if (!user) return [];

      const { data: docs, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('usuario_id', user.id)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      if (!docs || docs.length === 0) return [];

      const docIds = docs.map((d: any) => d.id);

      const [signersRes, auditRes] = await Promise.all([
        supabase.from('signatarios').select('*').in('documento_id', docIds).order('ordem_assinatura'),
        supabase.from('trilha_auditoria').select('*').in('documento_id', docIds).order('criado_em', { ascending: true }),
      ]);

      const signersByDoc = new Map<string, DbSigner[]>();
      ((signersRes.data || []) as any[]).forEach((s: any) => {
        const list = signersByDoc.get(s.documento_id) || [];
        list.push(s as DbSigner);
        signersByDoc.set(s.documento_id, list);
      });

      const auditByDoc = new Map<string, DbAuditEntry[]>();
      ((auditRes.data || []) as any[]).forEach((a: any) => {
        const list = auditByDoc.get(a.documento_id) || [];
        list.push(a as DbAuditEntry);
        auditByDoc.set(a.documento_id, list);
      });

      return (docs as any[]).map((doc: any) => ({
        ...doc,
        signers: signersByDoc.get(doc.id) || [],
        audit_trail: auditByDoc.get(doc.id) || [],
        document_fields: [],
      })) as DocumentWithRelations[];
    },
    enabled: !!user,
  });
}

// Fetch a single document with all relations
export function useDocument(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['document', id],
    queryFn: async (): Promise<DocumentWithRelations | null> => {
      if (!id || !user) return null;

      const { data: doc, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !doc) return null;

      const [signersRes, auditRes, fieldsRes] = await Promise.all([
        supabase.from('signatarios').select('*').eq('documento_id', id).order('ordem_assinatura'),
        supabase.from('trilha_auditoria').select('*').eq('documento_id', id).order('criado_em', { ascending: true }),
        supabase.from('campos_documento').select('*').eq('documento_id', id),
      ]);

      return {
        ...(doc as any),
        signers: ((signersRes.data || []) as any[]) as DbSigner[],
        audit_trail: ((auditRes.data || []) as any[]) as DbAuditEntry[],
        document_fields: ((fieldsRes.data || []) as any[]) as DbDocumentField[],
      } as DocumentWithRelations;
    },
    enabled: !!id && !!user,
  });
}

// Dashboard stats
export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: docs, error } = await supabase
        .from('documentos')
        .select('id, status, criado_em')
        .eq('usuario_id', user.id);

      if (error) throw error;
      const allDocs = (docs || []) as any[];

      const total = allDocs.length;
      const pending = allDocs.filter((d) => d.status === 'pending').length;
      const signed = allDocs.filter((d) => d.status === 'signed' || d.status === 'FINALIZADO_COM_SUCESSO').length;
      const expired = allDocs.filter((d) => d.status === 'expired').length;
      const cancelled = allDocs.filter((d) => d.status === 'cancelled').length;
      const drafts = allDocs.filter((d) => d.status === 'draft').length;
      const completionRate = total > 0 ? Math.round((signed / total) * 100) : 0;

      const now = new Date();
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthlyData: { month: string; sent: number; signed: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = d.toISOString();
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const monthDocs = allDocs.filter((doc) => doc.criado_em >= monthStart && doc.criado_em <= monthEnd);
        monthlyData.push({
          month: monthNames[d.getMonth()],
          sent: monthDocs.length,
          signed: monthDocs.filter((doc) => doc.status === 'signed').length,
        });
      }

      return {
        totalDocuments: total,
        pendingSignatures: pending,
        signedDocuments: signed,
        expiredDocuments: expired,
        cancelledDocuments: cancelled,
        drafts,
        avgSignTime: total > 0 ? '—' : '—',
        completionRate,
        monthlyData,
      };
    },
    enabled: !!user,
  });
}

// Cancel document
export function useCancelDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('documentos')
        .update({ status: 'cancelled' })
        .eq('id', documentId);
      if (error) throw error;

      await supabase.from('trilha_auditoria').insert({
        documento_id: documentId,
        acao: 'cancelled',
        ator: 'Você',
        detalhes: 'Documento cancelado pelo remetente',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Resend emails to pending signers
export function useResendEmails() {
  return useMutation({
    mutationFn: async ({ documentId, documentName }: { documentId: string; documentName: string }) => {
      const { data: signers } = await supabase
        .from('signatarios')
        .select('*')
        .eq('documento_id', documentId)
        .eq('status', 'pending');

      if (!signers || signers.length === 0) throw new Error('Nenhum signatário pendente');

      for (const signer of signers) {
        await supabase.functions.invoke('send-signing-email', {
          body: {
            signerName: (signer as any).nome,
            signerEmail: signer.email,
            documentName,
            signToken: (signer as any).token_assinatura,
            message: 'Lembrete: você possui um documento pendente de assinatura.',
          },
        });
      }

      await supabase.from('trilha_auditoria').insert({
        documento_id: documentId,
        acao: 'reminder',
        ator: 'Você',
        detalhes: `Lembrete reenviado para ${signers.length} signatário(s) pendente(s)`,
      });

      return signers.length;
    },
  });
}

// Get unique contacts from signers table
export function useContacts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: docs } = await supabase
        .from('documentos')
        .select('id')
        .eq('usuario_id', user.id);

      if (!docs || docs.length === 0) return [];

      const docIds = docs.map((d: any) => d.id);
      const { data: signers } = await supabase
        .from('signatarios')
        .select('*')
        .in('documento_id', docIds);

      if (!signers) return [];

      const contactMap = new Map<string, {
        name: string;
        email: string;
        phone: string | null;
        documentsCount: number;
        lastSeen: string;
      }>();

      (signers as any[]).forEach((s: any) => {
        const existing = contactMap.get(s.email);
        if (existing) {
          existing.documentsCount++;
          if (s.criado_em > existing.lastSeen) {
            existing.lastSeen = s.criado_em;
            existing.name = s.nome;
            if (s.telefone) existing.phone = s.telefone;
          }
        } else {
          contactMap.set(s.email, {
            name: s.nome,
            email: s.email,
            phone: s.telefone,
            documentsCount: 1,
            lastSeen: s.criado_em,
          });
        }
      });

      return Array.from(contactMap.entries()).map(([email, data]) => ({
        id: email,
        ...data,
      }));
    },
    enabled: !!user,
  });
}

// Get document public URL
export function getDocumentPublicUrl(filePath: string | null): string {
  if (!filePath) return '';
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${filePath}`;
}
