import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Dumbbell, ArrowRight } from 'lucide-react';
import { supabase } from '../db';

export default function LoginPage({ setUserId }: { setUserId: (id: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        setUserId(data.user.id);
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      let message = '';
      if (typeof err === 'string') {
        message = err;
      } else if (err && err.message) {
        message = err.message;
      } else if (err && err.error_description) {
        message = err.error_description;
      } else {
        message = JSON.stringify(err);
      }
      
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('invalid login credentials')) {
        message = 'E-mail ou senha incorretos. Verifique e tente novamente ou crie uma nova conta.';
      } else if (lowerMessage.includes('email not confirmed')) {
        message = 'Por favor, confirme seu e-mail antes de entrar.';
      } else if (lowerMessage.includes('user not found')) {
        message = 'Usuário não encontrado. Verifique o e-mail ou crie uma nova conta.';
      } else if (lowerMessage.includes('provider is not enabled')) {
        message = 'Este método de login não está ativado no Supabase.';
      }
      setError(message || 'Erro ao entrar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-4">
            <Dumbbell size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">FitAI</h1>
          <p className="text-gray-500 mt-2 text-center">Seu treinador pessoal com inteligência artificial.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between items-center">
              Senha
              <button 
                type="button"
                onClick={async () => {
                  if (!email.trim()) {
                    setError('Por favor, digite seu e-mail para recuperar a senha.');
                    return;
                  }
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: `${window.location.origin}/login`,
                  });
                  if (error) {
                    setError(error.message);
                  } else {
                    setError('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
                  }
                }}
                className="text-xs text-blue-600 hover:underline font-normal"
              >
                Esqueceu a senha?
              </button>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-70"
          >
            {loading ? 'Entrando...' : 'Entrar'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-600 mb-4">Ainda não tem uma conta?</p>
          <button 
            type="button"
            onClick={() => navigate('/onboarding')}
            className="inline-block w-full p-4 bg-gray-50 text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
          >
            Criar Nova Conta
          </button>
        </div>
      </motion.div>
    </div>
  );
}
