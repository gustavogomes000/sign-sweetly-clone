import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Login from "@/pages/auth/Login";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import DocumentDetail from "@/pages/DocumentDetail";
import NewDocument from "@/pages/NewDocument";
import Contacts from "@/pages/Contacts";
import Templates from "@/pages/Templates";
import Folders from "@/pages/Folders";
import TeamUsers from "@/pages/TeamUsers";
import Departments from "@/pages/Departments";
import BulkSend from "@/pages/BulkSend";
import Analytics from "@/pages/Analytics";

import ApiDocs from "@/pages/ApiDocs";
import Integrations from "@/pages/Integrations";
import SettingsPage from "@/pages/Settings";
import SignPage from "@/pages/SignPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCompanies from "@/pages/admin/AdminCompanies";
import AdminCompanyDetail from "@/pages/admin/AdminCompanyDetail";
import AdminSettings from "@/pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'superadmin' | 'company' }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole === 'superadmin' && !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (requiredRole === 'company' && isSuperAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isSuperAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={isSuperAdmin ? "/admin" : "/dashboard"} replace /> : <Login />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? (isSuperAdmin ? "/admin" : "/dashboard") : "/login"} replace />} />
      <Route path="/sign/:token" element={<SignPage />} />

      {/* Admin routes */}
      <Route element={<ProtectedRoute requiredRole="superadmin"><AdminLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/companies" element={<AdminCompanies />} />
        <Route path="/admin/companies/:id" element={<AdminCompanyDetail />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      {/* Company routes */}
      <Route element={<ProtectedRoute requiredRole="company"><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/new" element={<NewDocument />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/folders" element={<Folders />} />
        <Route path="/bulk-send" element={<BulkSend />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
