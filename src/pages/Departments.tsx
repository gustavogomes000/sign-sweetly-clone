import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Building2, Users, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { bluepointApi } from '@/services/bluepointApi';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Departments() {
  const navigate = useNavigate();
  const { data: departamentos = [], isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['bluepoint-departamentos'],
    queryFn: async () => {
      const result = await bluepointApi.listarDepartamentos();
      // Ensure we always return an array
      if (Array.isArray(result)) return result;
      return [];
    },
    staleTime: 5 * 60_000,
    retry: 2,
  });

  const totalColaboradores = departamentos.reduce((sum, d) => sum + (d.totalColaboradores || 0), 0);
  const activeDepts = departamentos.filter(d => d.status === 'ativo').length;

  return (
    <>
      <AppHeader title="Departamentos" subtitle={`${departamentos.length} departamentos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
            <Card className="border rounded-xl bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10"><Building2 className="w-4 h-4 text-primary" /></div>
                <span className="text-xs tracking-wider text-muted-foreground">ATIVOS</span>
                <span className="text-lg font-bold text-primary font-bold">{activeDepts}</span>
              </div>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} whileHover={{ y: -2 }}>
            <Card className="border rounded-xl bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent/10"><Users className="w-4 h-4 text-accent" /></div>
                <span className="text-xs tracking-wider text-muted-foreground">COLABORADORES</span>
                <span className="text-lg font-bold text-primary font-bold">{totalColaboradores}</span>
              </div>
            </Card>
          </motion.div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="text-xs tracking-wider ml-auto">
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> ATUALIZAR
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Erro ao carregar departamentos</p>
                <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Tente novamente'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto shrink-0">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : departamentos.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum departamento encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departamentos.map((dept, i) => (
              <motion.div key={dept.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4, scale: 1.02 }}>
                <Card
                  className="border rounded-xl bg-card h-full cursor-pointer group"
                  onClick={() => navigate(`/departments/${dept.id}`)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm tracking-wider flex items-center justify-between">
                      <span className="truncate">{(dept.nome || 'Sem nome').toUpperCase()}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={dept.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] shrink-0 tracking-wider">{(dept.status || 'N/A').toUpperCase()}</Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{dept.totalColaboradores || 0} colaborador{(dept.totalColaboradores || 0) !== 1 ? 'es' : ''}</span>
                    </div>
                    {dept.descricao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{dept.descricao}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
