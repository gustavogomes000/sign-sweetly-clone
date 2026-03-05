import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import DocumentDetail from "@/pages/DocumentDetail";
import NewDocument from "@/pages/NewDocument";
import Contacts from "@/pages/Contacts";
import Templates from "@/pages/Templates";
import Folders from "@/pages/Folders";
import BulkSend from "@/pages/BulkSend";
import Analytics from "@/pages/Analytics";
import ApiDocs from "@/pages/ApiDocs";
import SettingsPage from "@/pages/Settings";
import SignPage from "@/pages/SignPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/sign/:token" element={<SignPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/new" element={<NewDocument />} />
            <Route path="/documents/:id" element={<DocumentDetail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/folders" element={<Folders />} />
            <Route path="/bulk-send" element={<BulkSend />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
