import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Eye, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const notifIcon: Record<string, typeof CheckCircle2> = {
  signed: CheckCircle2,
  viewed: Eye,
  expired: AlertTriangle,
  completed: CheckCircle2,
  refused: XCircle,
  reminder: Clock,
  created: Clock,
  sent: Clock,
  cancelled: XCircle,
};

const notifColor: Record<string, string> = {
  signed: 'text-success',
  viewed: 'text-info',
  expired: 'text-warning',
  completed: 'text-success',
  refused: 'text-destructive',
  reminder: 'text-warning',
  created: 'text-muted-foreground',
  sent: 'text-info',
  cancelled: 'text-destructive',
};

export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, logout } = useAuth();

  // Fetch recent audit trail entries as notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('audit_trail')
        .select('id, action, actor, details, created_at, document_id')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []).map(n => ({
        id: n.id,
        type: n.action,
        title: `${n.actor} — ${n.action}`,
        description: n.details || '',
        time: format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR }),
        read: true, // All read by default for now
      }));
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'US';

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 relative z-10">
      <div className="animate-fade-in">
        <h1 className="text-lg font-game font-semibold text-foreground tracking-wide">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground -mt-0.5 font-body">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {actions}

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar documentos, contatos..."
            className="pl-9 w-72 h-9 bg-secondary border-none focus-visible:ring-1"
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold">Notificações</p>
            </div>
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-muted-foreground text-sm">
                Nenhuma notificação
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => {
                const Icon = notifIcon[n.type] || Clock;
                return (
                  <DropdownMenuItem key={n.id} className="flex items-start gap-3 py-3 cursor-pointer">
                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', notifColor[n.type] || 'text-muted-foreground')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center justify-center text-primary text-sm font-medium cursor-pointer">
              Ver todas as notificações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Meu perfil</DropdownMenuItem>
            <DropdownMenuItem>Configurações</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={logout}>Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
