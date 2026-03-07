import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import valerisLogo from '@/assets/valeris-logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const { login, loginAdmin, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = isAdminMode
      ? await loginAdmin(email, password)
      : await login(email, password);

    if (success) {
      navigate(isAdminMode ? '/admin' : '/dashboard');
    } else {
      toast({ title: 'Erro ao entrar', description: 'Email ou senha incorretos.', variant: 'destructive' });
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const result = await loginWithGoogle();

    if (!result.success) {
      toast({
        title: 'Falha ao conectar com Google',
        description: result.error || 'Tente novamente.',
        variant: 'destructive',
      });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <img src={valerisLogo} alt="Valeris" className="w-20 h-20 mx-auto object-contain" />
          <h1 className="text-3xl font-game font-bold text-foreground tracking-wider">VALERIS</h1>
          <p className="text-sm text-muted-foreground font-body">
            {isAdminMode ? 'Painel Administrativo' : 'Plataforma de assinatura eletrônica'}
          </p>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-game">by DNA do Software</p>
        </div>

        {/* Toggle admin/company */}
        <div className="flex bg-secondary rounded-xl p-1">
          <button
            onClick={() => setIsAdminMode(false)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              !isAdminMode ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            Empresa
          </button>
          <button
            onClick={() => setIsAdminMode(true)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
              isAdminMode ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin
          </button>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-foreground">
              {isAdminMode ? 'Acesso administrativo' : 'Entre na sua conta'}
            </h2>
          </CardHeader>
          <CardContent>
            {!isAdminMode && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading || loading}
                >
                  {googleLoading ? 'Conectando Google...' : 'Entrar com Google'}
                </Button>
                <div className="relative my-4">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    ou
                  </span>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAdminMode ? 'admin@valeris.com' : 'usuario@empresa.com'}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Senha</Label>
                  <button type="button" className="text-xs text-primary hover:underline">Esqueceu a senha?</button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full shadow-lg shadow-primary/20" disabled={loading || googleLoading}>
                {loading ? 'Entrando...' : 'Entrar'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo credentials */}
        <Card className="bg-secondary/50 border-border/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-foreground mb-2">Credenciais de demonstração:</p>
            {isAdminMode ? (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p><span className="font-mono bg-secondary px-1 rounded">admin@valeris.com</span> / <span className="font-mono bg-secondary px-1 rounded">admin123</span></p>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Use sua conta real (email/senha) ou entre com Google para enviar documentos.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
