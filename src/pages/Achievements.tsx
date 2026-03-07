import { motion } from 'framer-motion';
import { Trophy, Star, Target, Clock, Users, Diamond, Lock, Shield, Award, Coins, ChevronRight, Sparkles } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const TRUST_LEVELS = [
  { level: 1, name: 'Iniciante', minXp: 0 },
  { level: 2, name: 'Confiável', minXp: 200 },
  { level: 3, name: 'Verificado', minXp: 500 },
  { level: 4, name: 'Especialista', minXp: 1000 },
  { level: 5, name: 'Mestre Assinante', minXp: 1450 },
  { level: 6, name: 'Legendário', minXp: 2000 },
];

const CURRENT_XP = 1450;
const NEXT_LEVEL_XP = 2000;
const SP_COINS = 250;
const CURRENT_LEVEL = 5;

const challenges = [
  { id: 1, title: 'Assinar 3 novos docs', progress: 0, total: 3, xpReward: 50, icon: Target },
  { id: 2, title: 'Aprovar em <1 hr', progress: 0, total: 1, xpReward: 30, icon: Clock },
  { id: 3, title: 'Convidar colega', progress: 0, total: 1, xpReward: 75, icon: Users },
];

const journeyMilestones = [
  { id: 1, title: 'Avatar Tier 1', unlocked: true, icon: Star },
  { id: 2, title: 'Novo Tema', unlocked: false, icon: Sparkles },
  { id: 3, title: 'Novo Tema', unlocked: false, icon: Sparkles },
];

interface Medal {
  id: string;
  name: string;
  description: string;
  date?: string;
  rarity: 'ouro' | 'prata' | 'bronze';
  unlocked: boolean;
  icon: typeof Trophy;
}

const medals: Medal[] = [
  { id: '1', name: 'Dedo de Ouro', description: 'Assine 50 documentos', date: '15/09/2023', rarity: 'ouro', unlocked: true, icon: Award },
  { id: '2', name: 'Primeiro de Muitos', description: 'Primeira assinatura', date: '15/09/2023', rarity: 'ouro', unlocked: true, icon: Star },
  { id: '3', name: 'Líder da Equipe', description: 'Adicione 5 membros', date: '15/09/2023', rarity: 'ouro', unlocked: true, icon: Users },
  { id: '4', name: 'Detetive de Segurança', description: 'Validação biométrica', rarity: 'prata', unlocked: false, icon: Shield },
  { id: '5', name: 'Embaixador do Mês', description: 'Convide 10 pessoas', rarity: 'prata', unlocked: false, icon: Trophy },
];

const rarityStyles: Record<string, string> = {
  ouro: 'border-accent bg-accent/10 text-accent',
  prata: 'border-medal-silver bg-muted text-muted-foreground',
  bronze: 'border-medal-bronze bg-medal-bronze/10 text-medal-bronze',
};

const weeklyChallenge = {
  title: 'Mestre da Colaboração',
  type: 'Semanal',
  tasks: [
    { label: 'Convide 2', done: false },
    { label: 'Complete 10 assinaturas', done: false },
    { label: 'Organize 5 pastas', done: false },
  ],
  reward: { sp: 100, xp: 200 },
};

export default function Achievements() {
  const { user } = useAuth();
  const xpProgress = (CURRENT_XP / NEXT_LEVEL_XP) * 100;

  return (
    <div className="hex-pattern min-h-screen">
      <AppHeader title="Centro de Conquistas" subtitle="Sua jornada gamificada" />

      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-game font-bold text-foreground">
            Olá, <span className="text-gradient-gold">{user?.name || 'Usuário'}</span>
          </h2>
        </motion.div>

        {/* Trust Level & Coins Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="game-card-gold p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Seu Nível de Confiabilidade</span>
          </div>

          <p className="text-xs text-muted-foreground mb-1 font-semibold">
            Nível {CURRENT_LEVEL}: {TRUST_LEVELS[CURRENT_LEVEL - 1]?.name} — {CURRENT_XP} / {NEXT_LEVEL_XP} XP
          </p>

          <div className="game-progress mb-4">
            <motion.div
              className="game-progress-bar"
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 w-fit">
            <Diamond className="w-5 h-5 text-accent animate-float" />
            <span className="font-game font-bold text-accent text-lg">{SP_COINS}</span>
            <span className="text-sm font-semibold text-accent-foreground/70">SP-Coins</span>
          </div>
        </motion.div>

        {/* Journey Trail */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h3 className="text-lg font-game font-bold text-foreground mb-3">Trilha da Jornada</h3>
          <div className="flex items-center gap-4">
            {journeyMilestones.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all',
                    m.unlocked
                      ? 'gradient-teal-gold border-accent/30 glow-gold text-primary-foreground'
                      : 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {m.unlocked ? (
                    <m.icon className="w-6 h-6" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div className="text-xs font-semibold text-muted-foreground max-w-[60px]">
                  {m.title}
                </div>
                {i < journeyMilestones.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-border" />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Current Challenges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-game font-bold text-foreground mb-3">Desafios Atuais</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {challenges.map((c) => (
              <div key={c.id} className="game-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <c.icon className="w-5 h-5 text-primary" />
                  <span className="game-badge bg-accent/15 text-accent border-accent/30 text-[10px]">
                    +{c.xpReward} XP
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{c.title}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <Progress value={(c.progress / c.total) * 100} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground font-mono">{c.progress}/{c.total}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Weekly Challenge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="game-card-gold p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-game font-bold text-foreground">{weeklyChallenge.title}</h4>
              <span className="text-xs text-muted-foreground font-semibold">({weeklyChallenge.type})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="game-badge bg-primary/15 text-primary border-primary/30 text-[10px]">
                <Coins className="w-3 h-3" /> {weeklyChallenge.reward.sp} SP
              </span>
              <span className="game-badge bg-accent/15 text-accent border-accent/30 text-[10px]">
                +{weeklyChallenge.reward.xp} XP
              </span>
            </div>
          </div>
          <ul className="space-y-2">
            {weeklyChallenge.tasks.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                  t.done ? 'bg-success border-success' : 'border-border'
                )}>
                  {t.done && <span className="text-[8px] text-success-foreground">✓</span>}
                </div>
                {t.label}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Medals & Distinctions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-game font-bold text-foreground mb-3">Suas Medalhas e Distinções</h3>

          <Tabs defaultValue="unlocked">
            <TabsList className="mb-4">
              <TabsTrigger value="unlocked" className="font-semibold">Conquistadas</TabsTrigger>
              <TabsTrigger value="locked" className="font-semibold">Pendente</TabsTrigger>
            </TabsList>

            <TabsContent value="unlocked">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {medals.filter(m => m.unlocked).map((m) => (
                  <div key={m.id} className={cn('rounded-xl border-2 p-4 text-center transition-all hover:scale-105', rarityStyles[m.rarity])}>
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-accent/20 flex items-center justify-center">
                      <m.icon className="w-6 h-6 text-accent" />
                    </div>
                    <p className="text-sm font-bold text-foreground">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.date}</p>
                    <span className="text-[9px] font-game uppercase tracking-wider text-accent">
                      {m.rarity}
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="locked">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {medals.filter(m => !m.unlocked).map((m) => (
                  <div key={m.id} className="rounded-xl border-2 border-border p-4 text-center opacity-60">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-bold text-foreground">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.description}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Rewards Shop CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-center"
        >
          <button className="gradient-gold text-accent-foreground font-game font-bold px-8 py-3 rounded-xl glow-gold hover:opacity-90 transition-opacity text-sm tracking-wide">
            Loja de Recompensas
          </button>
        </motion.div>
      </div>
    </div>
  );
}
