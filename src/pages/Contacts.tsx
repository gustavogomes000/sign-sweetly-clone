import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Search, Mail, Phone, Loader2, Plus, Building2, Trash2, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DbContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
}

function useContactsCRUD() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const contacts = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      return (data || []) as DbContact[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (contact: { name: string; email: string; phone?: string; company?: string; role?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('contacts').insert({
        user_id: user.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone || null,
        company: contact.company || null,
        role: contact.role || 'signer',
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...contact }: { id: string; name: string; email: string; phone?: string; company?: string; role?: string }) => {
      const { error } = await supabase.from('contacts').update({
        name: contact.name,
        email: contact.email,
        phone: contact.phone || null,
        company: contact.company || null,
        role: contact.role || 'signer',
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  return { contacts, create, update, remove };
}

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<DbContact | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const { contacts, create, update, remove } = useContactsCRUD();

  const filtered = (contacts.data || []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingContact(null);
    setFormName(''); setFormEmail(''); setFormPhone(''); setFormCompany('');
    setDialogOpen(true);
  };

  const openEdit = (contact: DbContact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormEmail(contact.email);
    setFormPhone(contact.phone || '');
    setFormCompany(contact.company || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) return;
    try {
      if (editingContact) {
        await update.mutateAsync({ id: editingContact.id, name: formName, email: formEmail, phone: formPhone, company: formCompany });
        toast.success('Contato atualizado');
      } else {
        await create.mutateAsync({ name: formName, email: formEmail, phone: formPhone, company: formCompany });
        toast.success('Contato criado');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message?.includes('duplicate') ? 'Este e-mail já está cadastrado' : 'Erro ao salvar contato');
    }
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast.success('Contato removido');
  };

  return (
    <>
      <AppHeader title="Contatos" subtitle={`${contacts.data?.length || 0} contatos salvos`} />
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
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Novo contato
          </Button>
        </div>

        {contacts.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
            <p className="text-xs mt-1">Adicione contatos para importá-los rapidamente como signatários</p>
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
                        {contact.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contact.company}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(contact)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(contact.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
            <DialogDescription>Salve contatos frequentes para importar como signatários.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do contato" />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="Nome da empresa" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || !formEmail.trim() || create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editingContact ? 'Salvar' : 'Criar contato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
