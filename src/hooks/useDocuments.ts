import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DbDocument {
  id: string;
  name: string;
  status: string;
  signature_type: string;
  file_path: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface DbSigner {
  id: string;
  document_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  sign_order: number;
  status: string;
  signed_at: string | null;
  sign_token: string | null;
}

export interface DbAuditEntry {
  id: string;
  document_id: string;
  action: string;
  actor: string;
  details: string | null;
  created_at: string;
  signer_id: string | null;
  ip_address: string | null;
}

export interface DbDocumentField {
  id: string;
  document_id: string;
  signer_id: string | null;
  field_type: string;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  value: string | null;
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
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!docs || docs.length === 0) return [];

      const docIds = docs.map((d) => d.id);

      // Fetch signers for all docs in parallel
      const [signersRes, auditRes] = await Promise.all([
        supabase.from('signers').select('*').in('document_id', docIds).order('sign_order'),
        supabase.from('audit_trail').select('*').in('document_id', docIds).order('created_at', { ascending: true }),
      ]);

      const signersByDoc = new Map<string, DbSigner[]>();
      (signersRes.data || []).forEach((s) => {
        const list = signersByDoc.get(s.document_id) || [];
        list.push(s as DbSigner);
        signersByDoc.set(s.document_id, list);
      });

      const auditByDoc = new Map<string, DbAuditEntry[]>();
      (auditRes.data || []).forEach((a) => {
        const list = auditByDoc.get(a.document_id) || [];
        list.push(a as DbAuditEntry);
        auditByDoc.set(a.document_id, list);
      });

      return docs.map((doc) => ({
        ...doc,
        signers: signersByDoc.get(doc.id) || [],
        audit_trail: auditByDoc.get(doc.id) || [],
        document_fields: [],
      }));
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
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !doc) return null;

      const [signersRes, auditRes, fieldsRes] = await Promise.all([
        supabase.from('signers').select('*').eq('document_id', id).order('sign_order'),
        supabase.from('audit_trail').select('*').eq('document_id', id).order('created_at', { ascending: true }),
        supabase.from('document_fields').select('*').eq('document_id', id),
      ]);

      return {
        ...doc,
        signers: (signersRes.data || []) as DbSigner[],
        audit_trail: (auditRes.data || []) as DbAuditEntry[],
        document_fields: (fieldsRes.data || []) as DbDocumentField[],
      };
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
        .from('documents')
        .select('id, status, created_at')
        .eq('user_id', user.id);

      if (error) throw error;
      const allDocs = docs || [];

      const total = allDocs.length;
      const pending = allDocs.filter((d) => d.status === 'pending').length;
      const signed = allDocs.filter((d) => d.status === 'signed').length;
      const expired = allDocs.filter((d) => d.status === 'expired').length;
      const cancelled = allDocs.filter((d) => d.status === 'cancelled').length;
      const drafts = allDocs.filter((d) => d.status === 'draft').length;
      const completionRate = total > 0 ? Math.round((signed / total) * 100) : 0;

      // Monthly data (last 7 months)
      const now = new Date();
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthlyData: { month: string; sent: number; signed: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = d.toISOString();
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const monthDocs = allDocs.filter((doc) => doc.created_at >= monthStart && doc.created_at <= monthEnd);
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
        .from('documents')
        .update({ status: 'cancelled' })
        .eq('id', documentId);
      if (error) throw error;

      // Add audit entry
      await supabase.from('audit_trail').insert({
        document_id: documentId,
        action: 'cancelled',
        actor: 'Você',
        details: 'Documento cancelado pelo remetente',
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
        .from('signers')
        .select('*')
        .eq('document_id', documentId)
        .eq('status', 'pending');

      if (!signers || signers.length === 0) throw new Error('Nenhum signatário pendente');

      for (const signer of signers) {
        await supabase.functions.invoke('send-signing-email', {
          body: {
            signerName: signer.name,
            signerEmail: signer.email,
            documentName,
            signToken: signer.sign_token,
            message: 'Lembrete: você possui um documento pendente de assinatura.',
          },
        });
      }

      // Add audit entry
      await supabase.from('audit_trail').insert({
        document_id: documentId,
        action: 'reminder',
        actor: 'Você',
        details: `Lembrete reenviado para ${signers.length} signatário(s) pendente(s)`,
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

      // Get all signers from user's documents
      const { data: docs } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', user.id);

      if (!docs || docs.length === 0) return [];

      const docIds = docs.map((d) => d.id);
      const { data: signers } = await supabase
        .from('signers')
        .select('*')
        .in('document_id', docIds);

      if (!signers) return [];

      // Group by email to get unique contacts
      const contactMap = new Map<string, {
        name: string;
        email: string;
        phone: string | null;
        documentsCount: number;
        lastSeen: string;
      }>();

      signers.forEach((s) => {
        const existing = contactMap.get(s.email);
        if (existing) {
          existing.documentsCount++;
          if (s.created_at > existing.lastSeen) {
            existing.lastSeen = s.created_at;
            existing.name = s.name;
            if (s.phone) existing.phone = s.phone;
          }
        } else {
          contactMap.set(s.email, {
            name: s.name,
            email: s.email,
            phone: s.phone,
            documentsCount: 1,
            lastSeen: s.created_at,
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
