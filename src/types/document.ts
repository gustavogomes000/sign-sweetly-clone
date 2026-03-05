export type DocumentStatus = 'draft' | 'pending' | 'signed' | 'cancelled' | 'expired';

export type SignerStatus = 'pending' | 'signed' | 'refused';

export type SignatureType = 'electronic' | 'digital';

export interface Signer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: SignerStatus;
  signedAt?: string;
  role: string;
  order: number;
}

export interface Document {
  id: string;
  name: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  signers: Signer[];
  signatureType: SignatureType;
  folder?: string;
  tags?: string[];
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: string;
  documentsCount: number;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  usageCount: number;
}

export interface DashboardStats {
  totalDocuments: number;
  pendingSignatures: number;
  signedDocuments: number;
  expiredDocuments: number;
}
