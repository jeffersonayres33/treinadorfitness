import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, Flame, Trophy, AlertCircle, Settings, Activity, Scale, Percent, User, Camera, X, Image as ImageIcon, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';
import { supabase } from '../db';

import { toast } from 'sonner';

const MOTIVATIONAL_QUOTES = [
  "O único treino ruim é aquele que não aconteceu.",
  "A dor de hoje é a força de amanhã.",
  "Não pare quando estiver cansado, pare quando terminar.",
  "Disciplina é escolher entre o que você quer agora e o que você mais quer.",
  "Seu corpo pode suportar quase tudo. É a sua mente que você precisa convencer.",
  "O sucesso começa onde a sua zona de conforto termina.",
  "Pequenos progressos diários levam a grandes resultados.",
  "Você não precisa ser extremo, apenas consistente.",
  "Lembre-se de por que você começou.",
  "Acredite em si mesmo e você será imparável."
];

function BodyAvatar({ user, onUpdateUser }: { user: any, onUpdateUser: (updatedUser: any) => void }) {
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const bmi = user.weight / (user.height * user.height);
  
  let bodyType = 'Peso Normal';
  if (bmi < 18.5) bodyType = 'Abaixo do Peso';
  else if (bmi >= 25) bodyType = 'Acima do Peso';
  
  if (user.goal === 'hypertrophy' && (user.experience === 'intermediate' || user.experience === 'advanced') && bmi >= 22) {
    bodyType = 'Atlético';
  }

  let heightType = 'Estatura Média';
  if (user.sex === 'male') {
    if (user.height > 1.80) heightType = 'Estatura Alta';
    else if (user.height < 1.65) heightType = 'Estatura Baixa';
  } else {
    if (user.height > 1.70) heightType = 'Estatura Alta';
    else if (user.height < 1.55) heightType = 'Estatura Baixa';
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const { error } = await supabase.from('users').update({
          avatar_url: base64String
        }).eq('id', user.id);

        if (error) throw error;

        onUpdateUser({ ...user, avatar_url: base64String });
        setShowAvatarModal(false);
        toast.success("Foto de perfil atualizada!");
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao atualizar foto de perfil.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4 w-full text-left">Seu Perfil</h3>
        <div className="relative w-32 h-32 flex items-center justify-center overflow-hidden bg-blue-50 rounded-full border-4 border-white shadow-md mb-4 group">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={64} className="text-blue-300" />
          )}
          <button 
            onClick={() => setShowAvatarModal(true)}
            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Camera size={24} className="text-white" />
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-[10px] md:text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold uppercase">{user.sex === 'male' ? 'Homem' : 'Mulher'}</span>
          <span className="text-[10px] md:text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold uppercase">{heightType}</span>
          <span className="text-[10px] md:text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold uppercase">{bodyType}</span>
        </div>
      </div>

      {/* Avatar Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
          >
            <button 
              onClick={() => setShowAvatarModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-xl text-gray-900 mb-6 text-center">Foto de Perfil</h3>
            
            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-blue-200 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors text-blue-600 font-semibold">
                <ImageIcon size={24} />
                {uploading ? 'Carregando...' : 'Escolher da Galeria'}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
              
              {user.avatar_url && (
                <button 
                  onClick={async () => {
                    setUploading(true);
                    try {
                      await supabase.from('users').update({ avatar_url: null }).eq('id', user.id);
                      onUpdateUser({ ...user, avatar_url: null });
                      setShowAvatarModal(false);
                      toast.success("Foto removida!");
                    } catch (e) {
                      toast.error("Erro ao remover foto.");
                    } finally {
                      setUploading(false);
                    }
                  }}
                  disabled={uploading}
                  className="p-4 text-red-600 font-semibold hover:bg-red-50 rounded-2xl transition-colors"
                >
                  Remover Foto Atual
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
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

function calculateMonthlyTarget(availabilityData: any) {
  let availability: string[] = [];
  if (typeof availabilityData === 'string') {
    try {
      availability = JSON.parse(availabilityData);
    } catch (e) {
      availability = [];
    }
  } else if (Array.isArray(availabilityData)) {
    availability = availabilityData;
  }

  if (!availability || availability.length === 0) return 0;

  const dayMap: Record<string, number> = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };

  const targetDays = availability.map(day => dayMap[day]).filter(d => d !== undefined);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let count = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    if (targetDays.includes(date.getDay())) {
      count++;
    }
  }

  return count;
}

export default function HomePage({ setUserId }: { setUserId: (id: string | null) => void }) {
  const [motivation, setMotivation] = useState('');
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ workoutsCompletedMonth: 0, monthlyTarget: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        
        if (!currentUserId) return;

        // Fetch user
        const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', currentUserId).maybeSingle();
        if (userError) throw new Error('Falha ao carregar perfil');
        if (!userData) {
          navigate('/onboarding');
          return;
        }
        setUser(userData);

        // Fetch stats
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
            
            const { count } = await supabase.from('workout_history')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUserId)
                .gte('completed_at', startOfMonth)
                .lte('completed_at', endOfMonth);
            
            const monthlyTarget = calculateMonthlyTarget(userData.availability);

            setStats({ 
              workoutsCompletedMonth: count || 0,
              monthlyTarget 
            });
        } catch (e) {
            console.error("Stats error", e);
        }

        // Fetch motivation (Static)
        const todayIndex = new Date().getDate() % MOTIVATIONAL_QUOTES.length;
        setMotivation(MOTIVATIONAL_QUOTES[todayIndex]);

      } catch (err) {
        console.error(err);
        setError('Não foi possível carregar seus dados. Tente recarregar.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

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
                onClick={async () => {
                    if(confirm('Sair do aplicativo?')) {
                        await supabase.auth.signOut();
                        setUserId(null);
                        navigate('/login');
                    }
                }}
                className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Perfil e Logout"
            >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg md:text-xl">
                      {user.name[0].toUpperCase()}
                  </div>
                )}
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

              {/* Nutrition Teaser */}
              <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 hover:border-green-200 transition-colors cursor-pointer group flex flex-col justify-center" onClick={() => navigate('/nutrition')}>
                <div className="flex justify-between items-center mb-4 md:mb-6">
                    <h3 className="font-bold text-gray-900 text-lg md:text-xl group-hover:text-green-600 transition-colors">Nutricionista IA</h3>
                    <span className="text-xs md:text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium flex items-center gap-2">
                        Novo
                    </span>
                </div>
                <p className="text-gray-600 text-sm md:text-base mb-6 md:mb-8">Gere cardápios personalizados, marmitas congeladas e listas de compras com a nossa inteligência artificial.</p>
                <button className="w-full text-center bg-green-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-medium md:font-bold md:text-lg hover:bg-green-700 transition-colors mt-auto">
                    Acessar Nutrição
                </button>
              </div>

              {/* Body Profile Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <BodyAvatar user={user} onUpdateUser={setUser} />
                  <BodyMetrics user={user} />
              </div>
          </div>

          <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
                
                {/* Monthly Goal Card */}
                <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 text-gray-500 mb-4">
                        <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-lg md:rounded-xl">
                            <Target size={18} className="md:w-6 md:h-6" />
                        </div>
                        <span className="text-xs md:text-sm font-bold uppercase tracking-wide">Meta do Mês</span>
                    </div>
                    
                    {stats.monthlyTarget > 0 ? (
                      <div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <div className="text-2xl md:text-4xl font-bold text-gray-900">{stats.workoutsCompletedMonth}</div>
                                <div className="text-xs md:text-sm text-gray-400 mt-1">Concluídos</div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg md:text-2xl font-bold text-gray-400">{stats.monthlyTarget}</div>
                                <div className="text-xs md:text-sm text-gray-400 mt-1">Meta</div>
                            </div>
                        </div>
                        
                        <div className="mt-4">
                            <div className="w-full bg-gray-100 h-2 md:h-3 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${stats.workoutsCompletedMonth >= stats.monthlyTarget ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(100, (stats.workoutsCompletedMonth / stats.monthlyTarget) * 100)}%` }} 
                                />
                            </div>
                            <div className="text-xs text-center mt-3 font-medium">
                                {stats.workoutsCompletedMonth >= stats.monthlyTarget ? (
                                  <span className="text-green-600 font-bold flex items-center justify-center gap-1">
                                    <Trophy size={14} /> Meta batida! Você é incrível!
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    Faltam {stats.monthlyTarget - stats.workoutsCompletedMonth} treinos para bater a meta
                                  </span>
                                )}
                            </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Defina seus dias de treino no perfil para ver sua meta.
                      </div>
                    )}
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
