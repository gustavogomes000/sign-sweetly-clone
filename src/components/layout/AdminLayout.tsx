import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, LayoutDashboard, Settings, LogOut, Shield, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Separator } from '@/components/ui/separator';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/companies', label: 'Empresas', icon: Building2 },
  { to: '/admin/settings', label: 'Configurações', icon: Settings },
];

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn(
        'flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 relative shrink-0',
        collapsed ? 'w-[68px]' : 'w-[250px]'
      )}>
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-destructive flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-destructive-foreground" />
            </div>
            {!collapsed && (
              <div>
                <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">SignFlow</span>
                <p className="text-[10px] text-sidebar-foreground/60 -mt-0.5">Painel Admin</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {adminNav.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to) && item.to !== '/admin';
            const isExactActive = location.pathname === item.to;
            const active = item.exact ? isExactActive : isActive;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px] shrink-0", active && "text-destructive")} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 pb-3 space-y-2">
          <Separator className="bg-sidebar-border" />
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-colors">
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30">
              <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center text-xs font-bold text-destructive-foreground">SA</div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{user?.name}</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{user?.email}</p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
