export type DocumentStatus = 'draft' | 'pending' | 'signed' | 'cancelled' | 'expired';

export type SignerStatus = 'pending' | 'signed' | 'refused';

export type SignatureType = 'electronic' | 'digital';

export type AuthMethod = 'email';

export type NotifyVia = 'email';

export type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'dropdown' | 'image' | 'stamp';

export type PostSignatureValidation = 'selfie' | 'document_photo' | 'selfie_with_document';

export interface ValidationStep {
  id: string;
  type: PostSignatureValidation;
  label: string;
  order: number;
  required: boolean;
}

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
  validationSteps?: ValidationStep[];
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
  companyId?: string;
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

// SaaS Multi-tenant types
export type UserRole = 'superadmin' | 'company_admin' | 'company_user';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
  logo?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  maxUsers: number;
  maxDocumentsMonth: number;
  documentsUsed: number;
  usersCount: number;
}

export interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: 'company_admin' | 'company_user';
  companyId: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
  avatar?: string;
}

export interface ApiIntegration {
  id: string;
  name: string;
  apiKey: string;
  webhookUrl?: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastUsed?: string;
  companyId: string;
  rateLimit: number;
  callsToday: number;
}

export interface MicroserviceConfig {
  signatureUrl: string;
  documentCollectionUrl: string;
  selfieUrl: string;
  selfieWithDocumentUrl: string;
}
