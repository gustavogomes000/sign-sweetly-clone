import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  LayoutDashboard,
  Users,
  FolderOpen,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Layers,
  BarChart3,
  Code2,
  FolderTree,
  Zap,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

const mainNav = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/documents', label: 'Documentos', icon: FileText },
  { to: '/folders', label: 'Pastas', icon: FolderTree },
  { to: '/templates', label: 'Modelos', icon: Layers },
  { to: '/contacts', label: 'Contatos', icon: Users },
  { to: '/bulk-send', label: 'Envio em massa', icon: Zap },
  { to: '/analytics', label: 'Relatórios', icon: BarChart3 },
];

const bottomNav = [
  { to: '/api-docs', label: 'API & Webhooks', icon: Code2 },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 relative shrink-0',
        collapsed ? 'w-[68px]' : 'w-[250px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
                SignFlow
              </span>
              <p className="text-[10px] text-sidebar-foreground/60 -mt-0.5">Assinatura Eletrônica</p>
            </div>
          )}
        </div>
      </div>

      {/* New Document Button */}
      <div className="px-3 pt-4 pb-2">
        <NavLink to="/documents/new">
          <Button
            className={cn(
              'w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground font-medium shadow-lg shadow-sidebar-primary/20',
              collapsed ? 'px-0 justify-center' : ''
            )}
            size={collapsed ? 'icon' : 'default'}
          >
            <Plus className="w-4 h-4" />
            {!collapsed && <span>Novo documento</span>}
          </Button>
        </NavLink>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 pt-2 pb-1", collapsed && "hidden")}>
          Principal
        </p>
        {mainNav.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="px-3 pb-3 space-y-0.5">
        <Separator className="bg-sidebar-border mb-2" />
        {bottomNav.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all duration-150 w-full">
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>

        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 mt-1 rounded-lg bg-sidebar-accent/30">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground">
              {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{company?.name || user.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
