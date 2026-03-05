export type DocumentStatus = 'draft' | 'pending' | 'signed' | 'cancelled' | 'expired';

export type SignerStatus = 'pending' | 'signed' | 'refused';

export type SignatureType = 'electronic' | 'digital';

export type AuthMethod = 'email' | 'sms' | 'whatsapp' | 'pix' | 'selfie' | 'token';

export type NotifyVia = 'email' | 'sms' | 'whatsapp';

export type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'dropdown' | 'image' | 'stamp';

export interface AuditEntry {
  id: string;
  action: string;
  timestamp: string;
  actor: string;
  details: string;
}

export interface Signer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: SignerStatus;
  signedAt?: string;
  role: string;
  order: number;
  authMethod: AuthMethod;
}

export interface DocumentField {
  id: string;
  type: FieldType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  signerId?: string;
  required: boolean;
  value?: string;
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
  envelope?: string;
  notifyVia?: NotifyVia;
  reminderDays?: number;
  auditTrail?: AuditEntry[];
  fields?: DocumentField[];
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
  fields?: string[];
  category?: string;
}

export interface DashboardStats {
  totalDocuments: number;
  pendingSignatures: number;
  signedDocuments: number;
  expiredDocuments: number;
  cancelledDocuments?: number;
  drafts?: number;
  avgSignTime?: string;
  completionRate?: number;
  monthlyData?: { month: string; sent: number; signed: number }[];
}

export interface Folder {
  id: string;
  name: string;
  count: number;
  color: string;
}

export interface Notification {
  id: string;
  type: 'signed' | 'viewed' | 'expired' | 'completed' | 'refused' | 'reminder';
  title: string;
  description: string;
  time: string;
  read: boolean;
}
