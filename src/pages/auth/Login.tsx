import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowRight, Shield, Hexagon, Zap, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import signproofLogo from '@/assets/signproof-logo.png';

function HexParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 20 + Math.random() * 40,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 5,
      opacity: 0.03 + Math.random() * 0.06,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{ y: [0, -30, 0], x: [0, 10, -10, 0], rotate: [0, 60, 0], opacity: [p.opacity, p.opacity * 2, p.opacity] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        >
          <Hexagon className="text-primary" style={{ width: p.size, height: p.size, opacity: p.opacity }} strokeWidth={1} />
        </motion.div>
      ))}
    </div>
  );
}

function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.15), transparent)' }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-primary/20 rounded-tl-lg" />
      <div className="absolute top-6 right-6 w-12 h-12 border-r-2 border-t-2 border-primary/20 rounded-tr-lg" />
      <div className="absolute bottom-6 left-6 w-12 h-12 border-l-2 border-b-2 border-primary/20 rounded-bl-lg" />
      <div className="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-primary/20 rounded-br-lg" />
    </div>
  );
}

type AuthMode = 'login' | 'admin';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [glowPulse, setGlowPulse] = useState(false);
  const { login, loginAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => setGlowPulse((prev) => !prev), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'admin') {
        const success = await loginAdmin(email, password);
        if (success) navigate('/admin');
        else toast({ title: 'Erro ao entrar', description: 'Credenciais de admin incorretas.', variant: 'destructive' });
      } else {
        const success = await login(email, password);
        if (success) navigate('/dashboard');
        else toast({ title: 'Erro ao entrar', description: 'Email ou senha incorretos.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Algo deu errado.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const isAdmin = mode === 'admin';

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-6 hex-pattern overflow-hidden">
      <HexParticles />
      <GridOverlay />
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo */}
        <motion.div className="text-center space-y-2" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
          <motion.div className="relative mx-auto w-16 h-16" animate={{ rotateY: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ perspective: 600 }}>
            <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden transition-shadow duration-1000', glowPulse ? 'glow-primary' : 'shadow-xl')} style={{ background: 'linear-gradient(145deg, hsl(var(--primary) / 0.15), hsl(var(--card)))', border: '1px solid hsl(var(--primary) / 0.3)' }}>
              <img src={signproofLogo} alt="SignProof" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -inset-1 rounded-xl bg-primary/10 blur-md -z-10" />
          </motion.div>
          <h1 className="text-2xl font-game font-bold tracking-wider"><span className="stat-number">SIGNPROOF</span></h1>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.3em] font-game">by Valeris</p>
        </motion.div>

        {/* Mode toggle */}
        <motion.div className="flex rounded-xl overflow-hidden border border-border" style={{ background: 'linear-gradient(145deg, hsl(var(--secondary)), hsl(var(--card)))' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <button onClick={() => setMode('login')} className={cn('flex-1 py-2.5 text-xs font-game font-medium transition-all duration-300 flex items-center justify-center gap-1.5', mode === 'login' ? 'bg-primary text-primary-foreground shadow-lg glow-primary' : 'text-muted-foreground hover:text-foreground')}>
            <Lock className="w-3.5 h-3.5" />Empresa
          </button>
          <button onClick={() => setMode('admin')} className={cn('flex-1 py-2.5 text-xs font-game font-medium transition-all duration-300 flex items-center justify-center gap-1.5', mode === 'admin' ? 'bg-accent text-accent-foreground shadow-lg glow-accent' : 'text-muted-foreground hover:text-foreground')}>
            <Shield className="w-3.5 h-3.5" />Admin
          </button>
        </motion.div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 20, rotateX: -5 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.4, duration: 0.5 }} style={{ perspective: 1000 }}>
          <Card className="game-card overflow-hidden" style={{ boxShadow: '0 0 0 1px hsl(var(--border)), 0 10px 40px -10px hsl(var(--primary) / 0.15), 0 20px 60px -15px hsl(0 0% 0% / 0.15)' }}>
            <CardContent className="p-6">
              <AnimatePresence mode="wait">
                <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  <div className="flex items-center gap-2 mb-5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isAdmin ? 'bg-accent/15' : 'bg-primary/15')}>
                      {isAdmin ? <Shield className="w-4 h-4 text-accent" /> : <Zap className="w-4 h-4 text-primary" />}
                    </div>
                    <h2 className="text-sm font-game font-semibold text-foreground tracking-wide">{isAdmin ? 'ACESSO ADMIN' : 'LOGIN'}</h2>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-game text-muted-foreground tracking-wider">EMAIL</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isAdmin ? 'admin@valeris.com' : 'usuario@empresa.com'} required className="bg-secondary/50 border-border/50 focus:border-primary transition-all" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-game text-muted-foreground tracking-wider">SENHA</Label>
                        {!isAdmin && <button type="button" className="text-[10px] font-game text-primary hover:underline tracking-wider">RECUPERAR</button>}
                      </div>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-secondary/50 border-border/50 focus:border-primary transition-all pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button type="submit" className={cn('w-full font-game font-bold tracking-wider text-sm h-11', isAdmin ? 'gradient-gold text-accent-foreground glow-accent' : 'gradient-teal-gold text-primary-foreground glow-primary')} disabled={loading}>
                        {loading ? (
                          <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>CONECTANDO...</motion.span>
                        ) : (
                          <>ENTRAR <ArrowRight className="w-4 h-4 ml-2" /></>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {isAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }}>
            <div className="rounded-xl p-4 border border-primary/10" style={{ background: 'linear-gradient(145deg, hsl(var(--primary) / 0.05), hsl(var(--card) / 0.8))' }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-accent" />
                <p className="text-[10px] font-game font-bold text-accent tracking-wider">CREDENCIAIS DEMO</p>
              </div>
              <p className="text-xs text-muted-foreground font-body">
                <span className="font-mono bg-secondary/80 px-1.5 py-0.5 rounded text-foreground">admin@valeris.com</span> / <span className="font-mono bg-secondary/80 px-1.5 py-0.5 rounded text-foreground">admin123</span>
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
