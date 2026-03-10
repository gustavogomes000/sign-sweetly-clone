import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Search, Mail, Phone, Loader2, Plus, Building2, Trash2, Pencil, Camera, FileImage, UserCheck, Hexagon, Zap } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const VALIDATION_OPTIONS = [
  { value: 'selfie', label: 'Selfie', icon: Camera, description: 'Captura facial para prova de vida' },
  { value: 'document_photo', label: 'Foto de Documento', icon: FileImage, description: 'Foto do documento de identidade' },
  { value: 'selfie_with_document', label: 'Selfie com Documento', icon: UserCheck, description: 'Selfie segurando o documento' },
];

interface DbContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  default_validations: string[];
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
      return (data || []).map(c => ({ ...c, default_validations: (c as any).default_validations || [] })) as DbContact[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (contact: { name: string; email: string; phone?: string; company?: string; default_validations?: string[] }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('contacts').insert({ user_id: user.id, name: contact.name, email: contact.email, phone: contact.phone || null, company: contact.company || null, role: 'signer', default_validations: contact.default_validations || [] } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...contact }: { id: string; name: string; email: string; phone?: string; company?: string; default_validations?: string[] }) => {
      const { error } = await supabase.from('contacts').update({ name: contact.name, email: contact.email, phone: contact.phone || null, company: contact.company || null, default_validations: contact.default_validations || [] } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('contacts').delete().eq('id', id); if (error) throw error; },
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
  const [formValidations, setFormValidations] = useState<string[]>([]);
  const { contacts, create, update, remove } = useContactsCRUD();

  const filtered = (contacts.data || []).filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setEditingContact(null); setFormName(''); setFormEmail(''); setFormPhone(''); setFormCompany(''); setFormValidations([]); setDialogOpen(true); };
  const openEdit = (contact: DbContact) => { setEditingContact(contact); setFormName(contact.name); setFormEmail(contact.email); setFormPhone(contact.phone || ''); setFormCompany(contact.company || ''); setFormValidations(contact.default_validations || []); setDialogOpen(true); };
  const toggleValidation = (val: string) => setFormValidations(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) return;
    try {
      if (editingContact) { await update.mutateAsync({ id: editingContact.id, name: formName, email: formEmail, phone: formPhone, company: formCompany, default_validations: formValidations }); toast.success('Contato atualizado'); }
      else { await create.mutateAsync({ name: formName, email: formEmail, phone: formPhone, company: formCompany, default_validations: formValidations }); toast.success('Contato criado'); }
      setDialogOpen(false);
    } catch (err: any) { toast.error(err?.message?.includes('duplicate') ? 'Este e-mail já está cadastrado' : 'Erro ao salvar contato'); }
  };

  return (
    <>
      <AppHeader title="Contatos" subtitle={`${contacts.data?.length || 0} contatos salvos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar contatos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-64 bg-secondary/50 border-border/50" />
          </div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button size="sm" className="gradient-teal-gold text-primary-foreground glow-primary font-game text-xs tracking-wider" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> NOVO CONTATO
            </Button>
          </motion.div>
        </div>

        {contacts.isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-game tracking-wider">NENHUM CONTATO</p>
            <p className="text-xs mt-1 font-body">Adicione contatos para importá-los como signatários</p>
          </div>
        ) : (
          <Card className="game-card">
            <div className="divide-y divide-border/50">
              {filtered.map((contact, i) => (
                <motion.div key={contact.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-border/50">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-game font-bold">
                        {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-body font-semibold text-foreground group-hover:text-primary transition-colors">{contact.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</span>
                        {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contact.phone}</span>}
                        {contact.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contact.company}</span>}
                      </div>
                      {contact.default_validations.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {contact.default_validations.map(v => {
                            const opt = VALIDATION_OPTIONS.find(o => o.value === v);
                            return opt ? <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0 font-game tracking-wider">{opt.label}</Badge> : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(contact)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => { await remove.mutateAsync(contact.id); toast.success('Removido'); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15"><Zap className="w-4 h-4 text-primary" /></div>
              <div>
                <DialogTitle className="font-game text-sm tracking-wider">{editingContact ? 'EDITAR CONTATO' : 'NOVO CONTATO'}</DialogTitle>
                <DialogDescription className="text-xs font-body">Salve contatos frequentes para importar como signatários.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-game text-muted-foreground tracking-wider">NOME COMPLETO *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do contato" className="bg-secondary/50 border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-game text-muted-foreground tracking-wider">E-MAIL *</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-secondary/50 border-border/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-game text-muted-foreground tracking-wider">TELEFONE</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(11) 99999-9999" className="bg-secondary/50 border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-game text-muted-foreground tracking-wider">EMPRESA</Label>
                <Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="Nome da empresa" className="bg-secondary/50 border-border/50" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hexagon className="w-4 h-4 text-accent" strokeWidth={1.5} />
                <Label className="text-xs font-game text-muted-foreground tracking-wider">VALIDAÇÕES PÓS-ASSINATURA</Label>
              </div>
              <p className="text-[11px] text-muted-foreground font-body mb-3">Microsserviços de verificação aplicados quando este contato assinar.</p>
              <div className="space-y-2">
                {VALIDATION_OPTIONS.map(opt => {
                  const isSelected = formValidations.includes(opt.value);
                  return (
                    <div key={opt.value} onClick={() => toggleValidation(opt.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-secondary/30 hover:border-primary/20'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary/20' : 'bg-secondary'}`}>
                        <opt.icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-body font-semibold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                      </div>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleValidation(opt.value)} className="shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || !formEmail.trim() || create.isPending || update.isPending} className="gradient-teal-gold text-primary-foreground glow-primary font-game text-xs tracking-wider">
              {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editingContact ? 'SALVAR' : 'CRIAR CONTATO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
