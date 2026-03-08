import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Mail, Phone, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useContacts } from '@/hooks/useDocuments';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const { data: contacts = [], isLoading } = useContacts();

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <AppHeader title="Contatos" subtitle={`${contacts.length} contatos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-64"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
            <p className="text-xs mt-1">Contatos são extraídos automaticamente dos signatários dos seus documentos</p>
          </div>
        ) : (
          <Card>
            <div className="divide-y divide-border">
              {filtered.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{contact.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</span>
                        {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contact.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{contact.documentsCount} doc(s)</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
