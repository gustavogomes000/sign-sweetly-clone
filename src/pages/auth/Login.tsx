import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowRight, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import signproofLogo from '@/assets/signproof-logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('perfis')
            .select('trocar_senha')
            .eq('id', user.id)
            .single();

          if (profile?.trocar_senha) {
            setMustChangePassword(true);
            setLoading(false);
            return;
          }
        }
        navigate('/dashboard');
      } else {
        toast({ title: 'Erro ao entrar', description: 'Email ou senha incorretos.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Algo deu errado.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo de 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Senhas não conferem', description: 'Digite a mesma senha nos dois campos.', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('perfis').update({ trocar_senha: false }).eq('id', user.id);
      }
      toast({ title: '✅ Senha alterada!', description: 'Sua nova senha foi salva com sucesso.' });
      setMustChangePassword(false);
      navigate('/dashboard');
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Erro ao alterar senha.', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Lado esquerdo — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(145deg, hsl(var(--primary)) 0%, hsl(180 30% 12%) 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, hsl(var(--accent) / 0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, hsl(var(--primary) / 0.2) 0%, transparent 50%)' }} />
        <div className="relative z-10 text-center space-y-6 px-12 max-w-lg">
          <div className="w-20 h-20 rounded-2xl mx-auto overflow-hidden shadow-2xl border border-white/10">
            <img src={signproofLogo} alt="SignProof" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SignProof</h1>
          <p className="text-sm text-white/50">by Valeris</p>
          <div className="space-y-4 pt-4">
            <p className="text-white/80 text-sm leading-relaxed">
              Plataforma de assinatura eletrônica avançada com validade jurídica, 
              verificação biométrica e trilha de auditoria completa.
            </p>
            <div className="flex items-center justify-center gap-6 text-white/50 text-xs">
              <span>🔐 ICP-Brasil</span>
              <span>📍 Geolocalização</span>
              <span>🪪 KYC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo mobile */}
          <div className="lg:hidden text-center space-y-2">
            <div className="w-14 h-14 rounded-xl mx-auto overflow-hidden shadow-lg border border-border">
              <img src={signproofLogo} alt="SignProof" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl font-bold text-foreground">SignProof</h1>
            <p className="text-[10px] text-muted-foreground">by Valeris</p>
          </div>

          <Card className="shadow-sm border-border">
            <CardContent className="p-6">
              {mustChangePassword ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent/15">
                      <Lock className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Primeiro acesso</h2>
                      <p className="text-xs text-muted-foreground">Defina sua nova senha</p>
                    </div>
                  </div>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nova senha</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          required
                          minLength={6}
                          className="pr-10"
                        />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Confirmar senha</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        required
                        minLength={6}
                      />
                    </div>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-destructive">As senhas não conferem</p>
                    )}
                    <Button type="submit" className="w-full" disabled={changingPassword}>
                      {changingPassword ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Salvar nova senha <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Entrar</h2>
                    <p className="text-xs text-muted-foreground mt-1">Acesse sua conta SignProof</p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Senha</Label>
                        <button type="button" className="text-xs text-primary hover:underline">
                          Esqueceu a senha?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={6}
                          className="pr-10"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Entrar <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-[10px] text-muted-foreground">
            Acesso restrito a usuários autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
