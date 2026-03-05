import { Bell, Search, Moon, Sun } from 'lucide-react';
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
import { mockNotifications } from '@/data/mockData';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Eye, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const notifIcon = {
  signed: CheckCircle2,
  viewed: Eye,
  expired: AlertTriangle,
  completed: CheckCircle2,
  refused: XCircle,
  reminder: Clock,
};

const notifColor = {
  signed: 'text-success',
  viewed: 'text-info',
  expired: 'text-warning',
  completed: 'text-success',
  refused: 'text-destructive',
  reminder: 'text-warning',
};

export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground -mt-0.5">{subtitle}</p>}
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
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold">Notificações</p>
            </div>
            {mockNotifications.slice(0, 5).map((n) => {
              const Icon = notifIcon[n.type];
              return (
                <DropdownMenuItem key={n.id} className="flex items-start gap-3 py-3 cursor-pointer">
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', notifColor[n.type])} />
                  <div className="min-w-0">
                    <p className={cn('text-sm', !n.read && 'font-medium')}>{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                </DropdownMenuItem>
              );
            })}
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
                  US
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">Usuário Silva</p>
              <p className="text-xs text-muted-foreground">usuario@empresa.com</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Meu perfil</DropdownMenuItem>
            <DropdownMenuItem>Minha conta</DropdownMenuItem>
            <DropdownMenuItem>Planos & faturamento</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
