import { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { supabase } from '../db';
import { generateWorkout } from '../lib/gemini';

export default function OnboardingPage({ setUserId }: { setUserId: (id: string) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    birth_date: '',
    weight: '',
    target_weight: '',
    height: '',
    sex: 'male',
    goal: 'hypertrophy',
    experience: 'beginner',
    constraints: '',
    availability: ['monday', 'wednesday', 'friday'], // Default
    workout_duration: 60,
    equipment: 'gym',
    focus_areas: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

  // Load existing data if editing
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
        try {
          const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
          if (data) {
            setIsEditing(true);
            const loadedData = {
              email: session.user.email || '',
              password: '', // Don't load password
              name: data.name || '',
              birth_date: data.birth_date || '',
              weight: data.weight || '',
              target_weight: data.target_weight || '',
              height: data.height || '',
              sex: data.sex || 'male',
              goal: data.goal || 'hypertrophy',
              experience: data.experience || 'beginner',
              constraints: data.constraints || '',
              availability: typeof data.availability === 'string' ? JSON.parse(data.availability) : data.availability || [],
              workout_duration: data.workout_duration || 60,
              equipment: data.equipment || 'gym',
              focus_areas: typeof data.focus_areas === 'string' ? JSON.parse(data.focus_areas) : data.focus_areas || [],
            };
            setFormData(loadedData);
            setInitialData(loadedData);
          } else {
            setIsEditing(false);
          }
        } catch (err) {
          console.error("Failed to load user data", err);
          setIsEditing(false);
        }
      }
    };
    checkSession();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAvailability = (day: string) => {
    setFormData(prev => {
      const days = prev.availability.includes(day)
        ? prev.availability.filter(d => d !== day)
        : [...prev.availability, day];
      return { ...prev, availability: days };
    });
  };

  const handleFocusArea = (area: string) => {
    setFormData(prev => {
      const areas = prev.focus_areas.includes(area)
        ? prev.focus_areas.filter((a: string) => a !== area)
        : [...prev.focus_areas, area];
      return { ...prev, focus_areas: areas };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let userId = '';
      
      if (!isAuthenticated) {
        if (!formData.email || !formData.password) {
          toast.error('E-mail e senha são obrigatórios para criar uma conta.');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });
        
        let finalAuthData = authData;
        
        if (authError) {
          const lowerMsg = authError.message.toLowerCase();
          if (lowerMsg.includes('already registered') || lowerMsg.includes('user already exists')) {
            // Try to sign in instead
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: formData.email,
              password: formData.password,
            });
            
            if (signInError) {
              if (signInError.message.toLowerCase().includes('invalid login credentials')) {
                throw new Error('Este e-mail já está em uso. A senha está incorreta. Tente entrar na sua conta.');
              }
              throw signInError;
            }
            finalAuthData = signInData;
          } else if (lowerMsg.includes('invalid login credentials')) {
            throw new Error('E-mail ou senha inválidos. Verifique e tente novamente.');
          } else {
            throw authError;
          }
        }
        if (!finalAuthData.user) throw new Error('Falha ao criar usuário.');
        
        if (!finalAuthData.session) {
          toast.success('Conta criada com sucesso! Por favor, verifique seu e-mail para confirmar a conta antes de continuar.');
          navigate('/login');
          setLoading(false);
          return;
        }
        
        setIsAuthenticated(true);
        userId = finalAuthData.user.id;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Sessão não encontrada.');
        userId = session.user.id;
      }

      const { email, password, ...profileData } = formData;
      const payload = {
        id: userId,
        ...profileData,
        birth_date: profileData.birth_date ? profileData.birth_date : null,
        weight: profileData.weight ? parseFloat(profileData.weight) : null,
        target_weight: profileData.target_weight ? parseFloat(profileData.target_weight) : null,
        height: profileData.height ? parseFloat(profileData.height) : null,
        availability: JSON.stringify(formData.availability),
        focus_areas: JSON.stringify(formData.focus_areas)
      };

      if (isEditing) {
        const { error } = await supabase.from('users').update(payload).eq('id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('users').insert([payload]);
        if (error) throw error;
      }
      
      if (userId) {
        setUserId(userId);
        
        let shouldRegenerate = true;
        if (isEditing && initialData) {
          const relevantFields = ['goal', 'experience', 'availability', 'workout_duration', 'equipment', 'focus_areas', 'constraints'];
          const hasChanged = relevantFields.some(field => {
            if (field === 'availability' || field === 'focus_areas') {
              return JSON.stringify(formData[field as keyof typeof formData]) !== JSON.stringify(initialData[field]);
            }
            return formData[field as keyof typeof formData] !== initialData[field];
          });
          shouldRegenerate = hasChanged;
        }

        if (shouldRegenerate) {
          // Generate workout
          const workoutPlan = await generateWorkout(payload);
          
          if (!workoutPlan || !workoutPlan.workouts || !Array.isArray(workoutPlan.workouts)) {
            throw new Error('O plano de treino gerado pela IA é inválido. Tente novamente.');
          }

          // Delete old workouts
          await supabase.from('workouts').delete().eq('user_id', userId);
          
          // Insert new workout plan
          const { data: workoutData, error: workoutError } = await supabase.from('workouts').insert([{
            user_id: userId,
            type: 'Plano de Treino Semanal'
          }]).select('id').single();
          
          if (workoutError) throw workoutError;
          
          const exercisesToInsert: any[] = [];
          workoutPlan.workouts.forEach((w: any) => {
            w.exercises.forEach((e: any, index: number) => {
              exercisesToInsert.push({
                workout_id: workoutData.id,
                day: w.day,
                name: e.name,
                sets: e.sets,
                reps: e.reps,
                rest: e.rest,
                instructions: e.instructions,
                muscles_worked: e.muscles_worked,
                exercise_order: index
              });
            });
          });
          
          await supabase.from('exercises').insert(exercisesToInsert);
          toast.success('Perfil e treino atualizados com sucesso!');
        } else {
          toast.success('Perfil atualizado com sucesso!');
        }

        navigate('/');
      }
    } catch (error: any) {
      console.error('Onboarding Error:', error);
      let errorMessage = error.message || 'Erro ao salvar perfil. Tente novamente.';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('generateContent')) {
        errorMessage = 'Erro ao gerar o treino com IA. Por favor, tente novamente mais tarde.';
      } else if (errorMessage.includes('duplicate key value')) {
        errorMessage = 'Este perfil já existe.';
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !isAuthenticated) {
      if (!formData.email || !formData.password || !formData.name) {
        toast.error('Por favor, preencha o e-mail, senha e nome.');
        return;
      }
    } else if (step === 1 && isAuthenticated) {
      if (!formData.name) {
        toast.error('Por favor, preencha o nome.');
        return;
      }
    }
    setStep(s => s + 1);
  };
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-white p-6 md:p-10 flex flex-col justify-center">
      <div className="max-w-md md:max-w-lg mx-auto w-full">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 md:mb-12"
        >
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 md:mb-4">
              {isEditing ? 'Editar Perfil' : 'Vamos começar!'}
            </h1>
            <p className="text-gray-500 md:text-lg">Passo {step} de 5</p>
            <div className="w-full bg-gray-200 h-2 md:h-3 rounded-full mt-4 md:mt-6">
                <div 
                    className="bg-blue-600 h-2 md:h-3 rounded-full transition-all duration-300" 
                    style={{ width: `${(step / 5) * 100}%` }}
                />
            </div>
        </motion.div>

        {step === 1 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4 md:space-y-6">
            {!isAuthenticated && (
              <>
                <div>
                  <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">E-mail</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg" placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Senha</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg" placeholder="Sua senha" />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Nome</label>
              <input name="name" value={formData.name} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg" placeholder="Seu nome" />
            </div>
            <div>
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Data de Nascimento</label>
              <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg" />
            </div>
            <div className="grid grid-cols-3 gap-4 md:gap-6">
                <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Peso (kg)</label>
                    <input type="number" name="weight" value={formData.weight} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg" placeholder="70" />
                </div>
                <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Meta (kg)</label>
                    <input type="number" name="target_weight" value={formData.target_weight} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg" placeholder="65" />
                </div>
                <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Altura (m)</label>
                    <input type="number" step="0.01" name="height" value={formData.height} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg" placeholder="1.75" />
                </div>
            </div>
            <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Sexo</label>
                <select name="sex" value={formData.sex} onChange={handleChange} className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl md:text-lg bg-white">
                    <option value="male">Masculino</option>
                    <option value="female">Feminino</option>
                </select>
            </div>
            <div className="flex gap-4 md:gap-6 mt-6 md:mt-8">
                <button 
                    onClick={() => navigate('/login')} 
                    className="flex-1 p-4 md:p-5 text-gray-600 font-medium md:text-lg bg-gray-50 rounded-xl md:rounded-2xl hover:bg-gray-100 transition-colors"
                >
                    {isEditing ? 'Voltar' : 'Já tenho conta'}
                </button>
                <button 
                    onClick={nextStep} 
                    className="flex-1 bg-blue-600 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-semibold md:text-lg flex items-center justify-center gap-2"
                >
                    Próximo <ChevronRight size={20} className="md:w-6 md:h-6" />
                </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-semibold">Qual seu objetivo principal?</h2>
            {[
                { id: 'weight_loss', label: 'Perda de Peso', desc: 'Queimar gordura e definir' },
                { id: 'hypertrophy', label: 'Ganho de Massa', desc: 'Ficar forte e crescer músculos' },
                { id: 'conditioning', label: 'Condicionamento', desc: 'Melhorar resistência e saúde' },
                { id: 'recomp', label: 'Recomposição', desc: 'Perder gordura e ganhar massa' }
            ].map((opt) => (
                <button
                    key={opt.id}
                    onClick={() => setFormData({ ...formData, goal: opt.id })}
                    className={clsx(
                        "w-full p-4 md:p-5 border rounded-xl md:rounded-2xl text-left transition-all",
                        formData.goal === opt.id ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 hover:bg-gray-50"
                    )}
                >
                    <div className="font-semibold text-gray-900 md:text-lg">{opt.label}</div>
                    <div className="text-sm md:text-base text-gray-500">{opt.desc}</div>
                </button>
            ))}
            <div className="flex gap-4 md:gap-6 mt-6 md:mt-8">
                <button onClick={prevStep} className="flex-1 p-4 md:p-5 text-gray-600 font-medium md:text-lg">Voltar</button>
                {isEditing && (
                    <button 
                        onClick={() => navigate('/')} 
                        className="flex-1 p-4 md:p-5 text-red-600 font-medium md:text-lg bg-red-50 rounded-xl md:rounded-2xl hover:bg-red-100 transition-colors"
                    >
                        Cancelar
                    </button>
                )}
                <button onClick={nextStep} className="flex-1 bg-blue-600 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-semibold md:text-lg">Próximo</button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-semibold">Nível de Experiência</h2>
            {[
                { id: 'beginner', label: 'Iniciante', desc: 'Nunca treinei ou parei há muito tempo' },
                { id: 'intermediate', label: 'Intermediário', desc: 'Treino regularmente há 6 meses+' },
                { id: 'advanced', label: 'Avançado', desc: 'Treino pesado há anos' }
            ].map((opt) => (
                <button
                    key={opt.id}
                    onClick={() => setFormData({ ...formData, experience: opt.id })}
                    className={clsx(
                        "w-full p-4 md:p-5 border rounded-xl md:rounded-2xl text-left transition-all",
                        formData.experience === opt.id ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 hover:bg-gray-50"
                    )}
                >
                    <div className="font-semibold text-gray-900 md:text-lg">{opt.label}</div>
                    <div className="text-sm md:text-base text-gray-500">{opt.desc}</div>
                </button>
            ))}
            <div className="flex gap-4 md:gap-6 mt-6 md:mt-8">
                <button onClick={prevStep} className="flex-1 p-4 md:p-5 text-gray-600 font-medium md:text-lg">Voltar</button>
                {isEditing && (
                    <button 
                        onClick={() => navigate('/')} 
                        className="flex-1 p-4 md:p-5 text-red-600 font-medium md:text-lg bg-red-50 rounded-xl md:rounded-2xl hover:bg-red-100 transition-colors"
                    >
                        Cancelar
                    </button>
                )}
                <button onClick={nextStep} className="flex-1 bg-blue-600 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-semibold md:text-lg">Próximo</button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-semibold">Local e Foco do Treino</h2>
            
            <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2 md:mb-3">Onde você vai treinar?</label>
                <div className="grid grid-cols-1 gap-3">
                    {[
                        { id: 'gym', label: 'Academia Completa', desc: 'Acesso a máquinas e pesos livres' },
                        { id: 'home_equipment', label: 'Em Casa (Com Equipamentos)', desc: 'Halteres, elásticos, barra' },
                        { id: 'home_bodyweight', label: 'Em Casa (Apenas Peso do Corpo)', desc: 'Sem equipamentos' }
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => setFormData({ ...formData, equipment: opt.id })}
                            className={clsx(
                                "w-full p-4 border rounded-xl text-left transition-all",
                                formData.equipment === opt.id ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            <div className="font-semibold text-gray-900">{opt.label}</div>
                            <div className="text-sm text-gray-500">{opt.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2 md:mb-3">Áreas de Foco (Opcional)</label>
                <div className="flex flex-wrap gap-2">
                    {['Peito', 'Costas', 'Pernas', 'Glúteos', 'Abdômen', 'Braços', 'Ombros'].map((area) => {
                        const isSelected = formData.focus_areas.includes(area);
                        return (
                            <button
                                key={area}
                                onClick={() => handleFocusArea(area)}
                                className={clsx(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                                    isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                {area}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex gap-4 md:gap-6 mt-6 md:mt-8">
                <button onClick={prevStep} className="flex-1 p-4 md:p-5 text-gray-600 font-medium md:text-lg">Voltar</button>
                {isEditing && (
                    <button 
                        onClick={() => navigate('/')} 
                        className="flex-1 p-4 md:p-5 text-red-600 font-medium md:text-lg bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                    >
                        Cancelar
                    </button>
                )}
                <button onClick={nextStep} className="flex-1 bg-blue-600 text-white p-4 md:p-5 rounded-xl font-semibold md:text-lg">Próximo</button>
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-semibold">Disponibilidade e Limitações</h2>
            
            <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2 md:mb-3">Dias disponíveis para treino</label>
                <div className="flex flex-wrap gap-2 md:gap-3">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day, idx) => {
                        const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][idx];
                        const isSelected = formData.availability.includes(dayKey);
                        return (
                            <button
                                key={dayKey}
                                onClick={() => handleAvailability(dayKey)}
                                className={clsx(
                                    "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base font-medium transition-colors",
                                    isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                                )}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2 md:mb-3">Tempo disponível por treino (minutos)</label>
                <div className="grid grid-cols-4 gap-2 md:gap-4">
                    {[30, 45, 60, 90].map((time) => (
                        <button
                            key={time}
                            onClick={() => setFormData({ ...formData, workout_duration: time })}
                            className={clsx(
                                "p-3 md:p-4 rounded-xl md:rounded-2xl font-bold md:text-lg transition-all",
                                formData.workout_duration === time 
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {time}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">Limitações Físicas / Lesões</label>
                <textarea 
                    name="constraints" 
                    value={formData.constraints} 
                    onChange={handleChange} 
                    className="w-full p-3 md:p-4 border rounded-xl md:rounded-2xl h-24 md:h-32 md:text-lg" 
                    placeholder="Ex: Dor no joelho direito, hérnia de disco..." 
                />
            </div>

            <div className="flex gap-4 md:gap-6 mt-6 md:mt-8">
                <button onClick={prevStep} className="flex-1 p-4 md:p-5 text-gray-600 font-medium md:text-lg">Voltar</button>
                {isEditing && (
                    <button 
                        onClick={() => navigate('/')} 
                        className="flex-1 p-4 md:p-5 text-red-600 font-medium md:text-lg bg-red-50 rounded-xl md:rounded-2xl hover:bg-red-100 transition-colors"
                    >
                        Cancelar
                    </button>
                )}
                <button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-semibold md:text-lg flex justify-center items-center gap-2"
                >
                    {loading ? 'Gerando...' : 'Finalizar'}
                    {!loading && <Check size={20} className="md:w-6 md:h-6" />}
                </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
