import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { UserRole, Company, CompanyUser } from '@/types/document';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string;
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  company: Company | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Mock companies
export const mockCompanies: Company[] = [
  {
    id: 'comp1',
    name: 'TechCorp Soluções',
    cnpj: '12.345.678/0001-90',
    email: 'admin@techcorp.com',
    phone: '(11) 3333-4444',
    plan: 'enterprise',
    status: 'active',
    createdAt: '2025-06-01T10:00:00Z',
    maxUsers: 50,
    maxDocumentsMonth: 1000,
    documentsUsed: 156,
    usersCount: 12,
  },
  {
    id: 'comp2',
    name: 'StartupXYZ',
    cnpj: '98.765.432/0001-10',
    email: 'admin@startupxyz.com',
    plan: 'professional',
    status: 'active',
    createdAt: '2025-09-15T10:00:00Z',
    maxUsers: 15,
    maxDocumentsMonth: 300,
    documentsUsed: 45,
    usersCount: 5,
  },
  {
    id: 'comp3',
    name: 'Jurídico & Associados',
    cnpj: '11.222.333/0001-44',
    email: 'contato@juridico.com',
    phone: '(21) 2222-5555',
    plan: 'starter',
    status: 'active',
    createdAt: '2026-01-10T10:00:00Z',
    maxUsers: 5,
    maxDocumentsMonth: 100,
    documentsUsed: 78,
    usersCount: 3,
  },
  {
    id: 'comp4',
    name: 'Imobiliária Central',
    cnpj: '55.666.777/0001-88',
    email: 'admin@imobcentral.com',
    plan: 'professional',
    status: 'suspended',
    createdAt: '2025-11-20T10:00:00Z',
    maxUsers: 20,
    maxDocumentsMonth: 500,
    documentsUsed: 0,
    usersCount: 8,
  },
];

export const mockCompanyUsers: CompanyUser[] = [
  { id: 'cu1', name: 'Usuário Silva', email: 'usuario@techcorp.com', role: 'company_admin', companyId: 'comp1', status: 'active', createdAt: '2025-06-01T10:00:00Z', lastLogin: '2026-03-06T08:00:00Z' },
  { id: 'cu2', name: 'Maria Santos', email: 'maria@techcorp.com', role: 'company_user', companyId: 'comp1', status: 'active', createdAt: '2025-07-15T10:00:00Z', lastLogin: '2026-03-05T14:00:00Z' },
  { id: 'cu3', name: 'Carlos Oliveira', email: 'carlos@techcorp.com', role: 'company_user', companyId: 'comp1', status: 'active', createdAt: '2025-08-01T10:00:00Z' },
  { id: 'cu4', name: 'Ana Pereira', email: 'ana@startupxyz.com', role: 'company_admin', companyId: 'comp2', status: 'active', createdAt: '2025-09-15T10:00:00Z' },
  { id: 'cu5', name: 'Roberto Lima', email: 'roberto@startupxyz.com', role: 'company_user', companyId: 'comp2', status: 'inactive', createdAt: '2025-10-01T10:00:00Z' },
];

function mapSessionUser(sessionUser: SupabaseUser): AuthUser {
  const fallbackName = sessionUser.email?.split('@')[0] || 'Usuário';
  const metadata = sessionUser.user_metadata as Record<string, unknown> | undefined;
  const metadataName = typeof metadata?.full_name === 'string'
    ? metadata.full_name
    : typeof metadata?.name === 'string'
    ? metadata.name
    : fallbackName;

  return {
    id: sessionUser.id,
    name: metadataName,
    email: sessionUser.email || '',
    role: 'company_admin',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLocalAdminSession, setIsLocalAdminSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted || isLocalAdminSession) return;

      if (data.session?.user) {
        setUser(mapSessionUser(data.session.user));
      } else {
        setUser(null);
        setCompany(null);
      }
    };

    syncInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isLocalAdminSession) return;

      if (session?.user) {
        setUser(mapSessionUser(session.user));
        setCompany(null);
      } else {
        setUser(null);
        setCompany(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isLocalAdminSession]);

  const loginAdmin = async (email: string, password: string): Promise<boolean> => {
    if (email === 'admin@valeris.com' && password === 'admin123') {
      await supabase.auth.signOut();
      setIsLocalAdminSession(true);
      setUser({ id: 'sa1', name: 'Super Admin', email, role: 'superadmin' });
      setCompany(null);
      return true;
    }
    return false;
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLocalAdminSession(false);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return false;

    setUser(mapSessionUser(data.user));
    setCompany(null);
    return true;
  };

  const loginWithGoogle = async () => {
    setIsLocalAdminSession(false);

    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const logout = () => {
    setIsLocalAdminSession(false);
    setUser(null);
    setCompany(null);
    void supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      company,
      login,
      loginAdmin,
      loginWithGoogle,
      logout,
      isAuthenticated: !!user,
      isSuperAdmin: user?.role === 'superadmin',
      isCompanyAdmin: user?.role === 'company_admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
