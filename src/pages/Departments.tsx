import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Plus, MoreHorizontal, Pencil, Trash2, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  owner_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  department_id: string | null;
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function Departments() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState(COLORS[0]);

  const fetchData = async () => {
    setLoading(true);
    const [deptsRes, profilesRes] = await Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, department_id'),
    ]);
    if (deptsRes.data) setDepartments(deptsRes.data as unknown as Department[]);
    if (profilesRes.data) setProfiles(profilesRes.data as unknown as Profile[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName(''); setFormDesc(''); setFormColor(COLORS[0]);
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setFormName(dept.name);
    setFormDesc(dept.description || '');
    setFormColor(dept.color);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !user) return;
    setSaving(true);

    if (editing) {
      const { error } = await supabase.from('departments').update({
        name: formName.trim(),
        description: formDesc.trim() || null,
        color: formColor,
      }).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar'); setSaving(false); return; }
      toast.success('Departamento atualizado');
    } else {
      const { error } = await supabase.from('departments').insert({
        name: formName.trim(),
        description: formDesc.trim() || null,
        color: formColor,
        owner_id: user.id,
      });
      if (error) { toast.error('Erro ao criar'); setSaving(false); return; }
      toast.success('Departamento criado');
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Departamento excluído');
    fetchData();
  };

  const getMemberCount = (deptId: string) => profiles.filter(p => p.department_id === deptId).length;
  const getMembers = (deptId: string) => profiles.filter(p => p.department_id === deptId);

  return (
    <>
      <AppHeader title="Departamentos" subtitle={`${departments.length} departamentos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Novo departamento
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Building2 className="w-12 h-12 mb-3" />
            <p className="text-sm">Nenhum departamento criado</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
              Criar primeiro departamento
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => {
              const members = getMembers(dept.id);
              return (
                <Card key={dept.id} className="hover:shadow-md transition-shadow animate-fade-in">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: dept.color + '20' }}
                        >
                          <Building2 className="w-5 h-5" style={{ color: dept.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{dept.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{members.length} membros</span>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(dept)}>
                            <Pencil className="w-4 h-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(dept.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {dept.description && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{dept.description}</p>
                    )}

                    {members.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {members.slice(0, 5).map(m => (
                          <Badge key={m.id} variant="secondary" className="text-[10px]">
                            {m.full_name.split(' ')[0]}
                          </Badge>
                        ))}
                        {members.length > 5 && (
                          <Badge variant="outline" className="text-[10px]">+{members.length - 5}</Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize as informações do departamento.' : 'Crie um departamento para organizar sua equipe.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Jurídico, RH, Financeiro" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Descrição do departamento" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${formColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
