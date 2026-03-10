import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Building2, Users, RefreshCw, ChevronRight, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function Departments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: departments = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*, profiles(id)')
        .order('name');
      if (error) throw error;
      return data.map(d => ({
        ...d,
        memberCount: (d.profiles as unknown[])?.length || 0,
      }));
    },
    staleTime: 30_000,
  });

  const totalMembers = departments.reduce((sum, d) => sum + d.memberCount, 0);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('departments').insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        owner_id: user.id,
      });
      if (error) throw error;
      toast({ title: 'Departamento criado ✅' });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      refetch();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <AppHeader title="Departamentos" subtitle={`${departments.length} departamentos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
            <Card className="game-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10"><Building2 className="w-4 h-4 text-primary" /></div>
                <span className="text-xs font-game tracking-wider text-muted-foreground">DEPARTAMENTOS</span>
                <span className="text-lg font-game font-bold stat-number">{departments.length}</span>
              </div>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} whileHover={{ y: -2 }}>
            <Card className="game-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent/10"><Users className="w-4 h-4 text-accent" /></div>
                <span className="text-xs font-game tracking-wider text-muted-foreground">MEMBROS</span>
                <span className="text-lg font-game font-bold stat-number">{totalMembers}</span>
              </div>
            </Card>
          </motion.div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="font-game text-xs tracking-wider">
              <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> ATUALIZAR
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="font-game text-xs tracking-wider">
              <Plus className="w-4 h-4 mr-1" /> NOVO
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept, i) => (
              <motion.div key={dept.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4, scale: 1.02 }}>
                <Card
                  className="game-card h-full cursor-pointer group"
                  onClick={() => navigate(`/departments/${dept.id}`)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-game tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                        <span className="truncate">{dept.name.toUpperCase()}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                      <Users className="w-4 h-4" />
                      <span>{dept.memberCount} membro{dept.memberCount !== 1 ? 's' : ''}</span>
                    </div>
                    {dept.description && <p className="text-xs text-muted-foreground mt-2 font-body line-clamp-2">{dept.description}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create department dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-game tracking-wider">NOVO DEPARTAMENTO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Recursos Humanos" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descreva o departamento..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
