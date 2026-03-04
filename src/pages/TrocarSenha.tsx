import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TrocarSenha = () => {
  const [step, setStep] = useState(1); // 1: Form, 2: Success
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);

    try {
      // Atualiza a senha e remove a flag must_change_password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });

      if (error) throw error;

      setStep(2);
    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err);
      setError(err.message || 'Erro ao atualizar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    // Força um refresh no estado de autenticação ou redireciona
    // O AuthContext deve pegar a atualização do metadata automaticamente no próximo fetch
    navigate('/');
    // Opcional: recarregar a página para garantir que o contexto atualize completamente
    window.location.reload(); 
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a1a] flex items-center justify-center p-4">
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-[#0a0a1a]/95 via-[#0a0a1a]/80 to-[#6366f1]/20"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card p-8 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
          {step === 1 ? (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
                  <Lock className="text-primary" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white">Primeiro Acesso</h1>
                <p className="text-gray-400 mt-2">Por segurança, você deve alterar sua senha temporária.</p>
              </div>

              <form onSubmit={handleUpdate} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nova Senha</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none" 
                    placeholder="••••••••" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none" 
                    placeholder="••••••••" 
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-primary hover:bg-secondary text-white rounded-lg shadow-lg shadow-primary/20 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                <CheckCircle className="text-green-500" size={40} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Sucesso!</h1>
              <p className="text-gray-400 mb-8">Sua senha foi alterada. Agora você pode acessar seu painel.</p>
              <button onClick={handleGoToDashboard} className="w-full py-3 bg-primary hover:bg-secondary text-white rounded-lg flex items-center justify-center space-x-2 transition-all font-bold">
                <span>Ir para o Painel</span>
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrocarSenha;
