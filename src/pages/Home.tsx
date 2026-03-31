import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, Flame, Trophy, AlertCircle, Settings, Activity, Scale, Percent, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';

import { toast } from 'sonner';
 
function BodyAvatar({ user, onAvatarGenerated }: { user: any, onAvatarGenerated: () => void }) {
  const [generating, setGenerating] = useState(false);
 
  if (!user) return null;
 
  const handleGenerateAvatar = async () => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/users/${user.id}/avatar`, { method: 'POST' });
      if (res.ok) {
        toast.success('Avatar gerado com sucesso!');
        onAvatarGenerated();
      } else {
        const data = await res.json();
        if (res.status === 429) {
          toast.error(data.error || 'Limite de geração atingido.', {
            description: data.details || 'Você pode configurar sua própria chave de API no menu lateral para continuar gerando imagens em alta qualidade.',
            duration: 8000,
            action: {
              label: 'Tentar novamente',
              onClick: () => handleGenerateAvatar(),
            },
          });
        } else {
          toast.error(data.error || 'Erro ao gerar avatar');
        }
      }
    } catch (err) {
      toast.error('Erro de conexão ao gerar avatar');
    } finally {
      setGenerating(false);
    }
  };

  const bmi = user.weight / (user.height * user.height);
  
  let bodyType = 'médio';
  if (bmi < 18.5) bodyType = 'magro';
  else if (bmi >= 25) bodyType = 'gordo';
  
  if (user.goal === 'hypertrophy' && (user.experience === 'intermediate' || user.experience === 'advanced') && bmi >= 22) {
    bodyType = 'forte';
  }

  let heightType = 'médio';
  if (user.sex === 'male') {
    if (user.height > 1.80) heightType = 'alto';
    else if (user.height < 1.65) heightType = 'baixo';
  } else {
    if (user.height > 1.70) heightType = 'alto';
    else if (user.height < 1.55) heightType = 'baixo';
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-900 mb-4 w-full text-left">Seu Avatar</h3>
      <div className="relative w-32 h-48 flex items-end justify-center overflow-hidden bg-gray-50 rounded-xl border border-gray-200 mb-4">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full p-2 text-center">
            <span className="text-xs text-gray-400 mb-2">Sem avatar</span>
            <button 
              onClick={handleGenerateAvatar}
              disabled={generating}
              className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-lg font-semibold disabled:opacity-50"
            >
              {generating ? 'Gerando...' : 'Gerar com IA'}
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <span className="text-[10px] md:text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold uppercase">{user.sex === 'male' ? 'Homem' : 'Mulher'}</span>
        <span className="text-[10px] md:text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold uppercase">{heightType}</span>
        <span className="text-[10px] md:text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold uppercase">{bodyType}</span>
      </div>
      {user.avatar_url && (
        <button 
          onClick={handleGenerateAvatar}
          disabled={generating}
          className="mt-3 text-[10px] text-gray-500 underline disabled:opacity-50"
        >
          {generating ? 'Gerando novo...' : 'Gerar novo avatar'}
        </button>
      )}
    </div>
  );
}

function BodyMetrics({ user }: { user: any }) {
  if (!user) return null;

  // Calculate Age
  const birthDate = new Date(user.birth_date);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
  }

  // Calculate BMI (IMC)
  const bmi = user.weight / (user.height * user.height);
  let bmiStatus = 'Normal';
  let bmiColor = 'text-green-600';
  if (bmi < 18.5) { bmiStatus = 'Abaixo do peso'; bmiColor = 'text-blue-600'; }
  else if (bmi >= 25 && bmi < 30) { bmiStatus = 'Sobrepeso'; bmiColor = 'text-orange-600'; }
  else if (bmi >= 30) { bmiStatus = 'Obesidade'; bmiColor = 'text-red-600'; }
  
  // Calculate Body Fat % (Deurenberg formula)
  const sexFactor = user.sex === 'male' ? 1 : 0;
  const bodyFat = (1.20 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4;
  
  let fatRef = user.sex === 'male' ? '10% - 20%' : '20% - 30%';

  // Calculate Lean Mass (Muscle Mass approx)
  const leanMass = user.weight * (1 - (bodyFat / 100));
  const leanMassRef = (user.weight * (user.sex === 'male' ? 0.8 : 0.7)).toFixed(1) + 'kg+';

  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-900 mb-4">Análise Corporal</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Scale size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">IMC</div>
              <div className="text-[10px] text-gray-500">Ref: 18.5 - 24.9</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{bmi.toFixed(1)}</div>
            <div className={`text-[10px] font-semibold ${bmiColor}`}>{bmiStatus}</div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <Percent size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Gordura</div>
              <div className="text-[10px] text-gray-500">Ref: {fatRef}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{bodyFat.toFixed(1)}%</div>
            <div className="text-[10px] font-semibold text-gray-500">Estimada</div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Massa Magra</div>
              <div className="text-[10px] text-gray-500">Ref: {leanMassRef}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{leanMass.toFixed(1)} kg</div>
            <div className="text-[10px] font-semibold text-gray-500">Estimada</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage({ setUserId }: { setUserId: (id: string | null) => void }) {
  const [motivation, setMotivation] = useState('');
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ workoutsCompletedMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      try {
        // Fetch user
        const userRes = await fetch(`/api/users/${userId}`);
        if (!userRes.ok) throw new Error('Falha ao carregar perfil');
        const userData = await userRes.json();
        setUser(userData);

        // Fetch stats
        try {
            const statsRes = await fetch(`/api/stats/${userId}`);
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData);
            }
        } catch (e) {
            console.error("Stats error", e);
        }

        // Fetch motivation (non-blocking for UI, but we wait here for simplicity or use Promise.all)
        // We wrap motivation in its own try/catch so it doesn't block the whole page if AI fails
        try {
            const cachedMotiv = sessionStorage.getItem(`motivation_${userId}`);
            if (cachedMotiv) {
                setMotivation(cachedMotiv);
            } else {
                const motivRes = await fetch(`/api/motivation/${userId}`);
                if (motivRes.ok) {
                    const motivData = await motivRes.json();
                    setMotivation(motivData.message);
                    sessionStorage.setItem(`motivation_${userId}`, motivData.message);
                }
            }
        } catch (e) {
            console.error("Motivation error", e);
            setMotivation("Vamos treinar hoje!");
        }

      } catch (err) {
        console.error(err);
        setError('Não foi possível carregar seus dados. Tente recarregar.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  if (loading) return <LoadingScreen message="Preparando seu dashboard..." />;
  
  if (error || !user) return (
    <div className="p-6 flex flex-col items-center justify-center h-screen text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Ops! Algo deu errado.</h2>
        <p className="text-gray-500 mb-6">{error || 'Usuário não encontrado.'}</p>
        <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold"
        >
            Tentar Novamente
        </button>
    </div>
  );

  return (
    <div className="p-6 md:p-10 space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Olá, {user.name.split(' ')[0]}!</h1>
          <p className="text-gray-500 text-sm md:text-base mt-1">Sua Personal Trainer IA preparou seu dia.</p>
        </div>
        <div className="flex gap-2 md:gap-4">
            <button 
                onClick={() => navigate('/onboarding')}
                className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                title="Editar Perfil"
            >
                <Settings size={20} className="md:w-6 md:h-6" />
            </button>
            <button 
                onClick={() => {
                    if(confirm('Sair do aplicativo?')) {
                        localStorage.removeItem('userId');
                        setUserId(null);
                        navigate('/');
                    }
                }}
                className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Perfil e Logout"
            >
                <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg md:text-xl">
                    {user.name[0].toUpperCase()}
                </div>
            </button>
        </div>
      </header>

      {/* Motivation Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-blue-200"
      >
        <div className="flex items-start gap-3 md:gap-4">
            <Flame className="text-yellow-300 shrink-0 mt-1 md:w-8 md:h-8" fill="currentColor" />
            <div>
                <h3 className="font-semibold text-blue-100 text-xs md:text-sm uppercase tracking-wide mb-1 md:mb-2">Motivação da sua IA</h3>
                <p className="font-medium text-lg md:text-2xl leading-snug italic">"{motivation || 'Carregando...'}"</p>
            </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
              {/* Today's Workout Teaser */}
              <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 hover:border-blue-200 transition-colors cursor-pointer group flex flex-col justify-center" onClick={() => navigate('/workout')}>
                <div className="flex justify-between items-center mb-4 md:mb-6">
                    <h3 className="font-bold text-gray-900 text-lg md:text-xl group-hover:text-blue-600 transition-colors">Treino Gerado por IA</h3>
                    <span className="text-xs md:text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Pronto
                    </span>
                </div>
                <p className="text-gray-600 text-sm md:text-base mb-6 md:mb-8">Sua personal trainer IA analisou seu perfil e montou o treino ideal para hoje, respeitando seu tempo e limites.</p>
                <button className="w-full text-center bg-gray-900 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-medium md:font-bold md:text-lg group-hover:bg-blue-600 transition-colors mt-auto">
                    Iniciar Treino
                </button>
              </div>

              {/* Coach AI Teaser */}
              <div className="bg-zinc-950 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-800 hover:border-emerald-500/50 transition-colors cursor-pointer group flex flex-col justify-center relative overflow-hidden" onClick={() => navigate('/chat')}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="flex justify-between items-center mb-4 md:mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <h3 className="font-bold text-white text-lg md:text-xl group-hover:text-emerald-400 transition-colors">Falar com o Coach</h3>
                    </div>
                </div>
                <p className="text-zinc-400 text-sm md:text-base mb-6 md:mb-8 relative z-10">Precisa de motivação? Faltou no treino? Converse com seu Coach IA para ajustar sua rotina, receber dicas de esportes ao ar livre e manter o foco.</p>
                <button className="w-full text-center bg-emerald-500 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-medium md:font-bold md:text-lg group-hover:bg-emerald-600 transition-colors mt-auto relative z-10">
                    Abrir Chat
                </button>
              </div>

              {/* Body Profile Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <BodyAvatar user={user} onAvatarGenerated={async () => {
                    const userRes = await fetch(`/api/users/${userId}`);
                    if (userRes.ok) {
                      const userData = await userRes.json();
                      setUser(userData);
                    }
                  }} />
                  <BodyMetrics user={user} />
              </div>
          </div>

          <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-28 md:h-36">
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="p-2 md:p-3 bg-green-50 text-green-600 rounded-lg md:rounded-xl">
                            <Dumbbell size={18} className="md:w-6 md:h-6" />
                        </div>
                        <span className="text-xs md:text-sm font-bold uppercase tracking-wide">Treinos</span>
                    </div>
                    <div>
                        <div className="text-2xl md:text-4xl font-bold text-gray-900">{stats.workoutsCompletedMonth}</div>
                        <div className="text-xs md:text-sm text-gray-400 mt-1">Concluídos este mês</div>
                    </div>
                </div>
                <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-auto md:h-auto">
                    <div className="flex items-center gap-2 text-gray-500 mb-4">
                        <div className="p-2 md:p-3 bg-purple-50 text-purple-600 rounded-lg md:rounded-xl">
                            <Trophy size={18} className="md:w-6 md:h-6" />
                        </div>
                        <span className="text-xs md:text-sm font-bold uppercase tracking-wide">Progresso da Meta</span>
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <div className="text-2xl md:text-4xl font-bold text-gray-900">{user.weight} <span className="text-sm md:text-lg text-gray-500 font-normal">kg</span></div>
                                <div className="text-xs md:text-sm text-gray-400 mt-1">Atual</div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg md:text-2xl font-bold text-gray-400">{user.target_weight || '--'} <span className="text-xs md:text-sm font-normal">kg</span></div>
                                <div className="text-xs md:text-sm text-gray-400 mt-1">Meta</div>
                            </div>
                        </div>
                        
                        {user.target_weight && (
                            <div className="mt-4">
                                <div className="w-full bg-gray-100 h-2 md:h-3 rounded-full overflow-hidden">
                                    {/* Simple progress calculation: assuming starting weight is known, but we don't have it. 
                                        Let's just show a generic progress bar or a difference indicator. */}
                                    <div 
                                        className={`h-full rounded-full ${user.weight <= user.target_weight && user.goal === 'weight_loss' ? 'bg-green-500' : user.weight >= user.target_weight && user.goal === 'hypertrophy' ? 'bg-green-500' : 'bg-purple-500'}`}
                                        style={{ width: `${Math.min(100, Math.max(10, user.goal === 'weight_loss' ? (user.target_weight / user.weight) * 100 : (user.weight / user.target_weight) * 100))}%` }} 
                                    />
                                </div>
                                <div className="text-xs text-center mt-2 font-medium text-gray-500">
                                    {Math.abs(user.weight - user.target_weight).toFixed(1)} kg para o objetivo
                                </div>
                            </div>
                        )}
                    </div>
                </div>
              </div>
          </div>
      </div>
    </div>
  );
}
