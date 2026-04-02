import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Clock, RotateCcw, Youtube, Timer, AlertTriangle, RefreshCw, Video, ChevronUp, ChevronDown, Check, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RestTimer from '../components/RestTimer';
import LoadingScreen from '../components/LoadingScreen';
import { supabase } from '../db';
import { generateWorkout } from '../lib/gemini';

import { toast } from 'sonner';
 
export default function WorkoutPage() {
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [restTime, setRestTime] = useState(60); // Default 60s
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [expandedInstruction, setExpandedInstruction] = useState<number | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
 
  useEffect(() => {
    setCompletedExercises(new Set());
  }, [selectedDay, refreshKey]);
 
  useEffect(() => {
    const fetchWorkout = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            
            if (!userId) {
                setLoading(false);
                return;
            }

            const { data: workouts, error } = await supabase.from('workouts')
                .select(`
                    id, type, created_at,
                    exercises (id, day, name, sets, reps, rest, instructions, muscles_worked, exercise_order)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;
            
            if (workouts && workouts.length > 0) {
                const w = workouts[0];
                // Group exercises by day
                const daysMap = new Map();
                w.exercises.forEach((ex: any) => {
                    if (!daysMap.has(ex.day)) {
                        daysMap.set(ex.day, []);
                    }
                    daysMap.get(ex.day).push(ex);
                });
                
                const days = Array.from(daysMap.entries()).map(([name, exercises]) => ({
                    name,
                    exercises: (exercises as any[]).sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                }));
                
                const formattedWorkout = {
                    id: w.id,
                    type: w.type,
                    days
                };
                
                setWorkout(formattedWorkout);
                if (days.length > 0) {
                    setSelectedDay(days[0].name);
                }
            } else {
                setWorkout(null);
            }
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar treino.');
        } finally {
            setLoading(false);
        }
    };
 
    fetchWorkout();
  }, [refreshKey]);
 
  const [generating, setGenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [motivationMessage, setMotivationMessage] = useState('');
 
  const handleRegenerateClick = () => {
    if (!workout) {
      confirmRegenerate();
    } else {
      setShowRegenerateConfirm(true);
    }
  };
 
  const confirmRegenerate = async () => {
    setShowRegenerateConfirm(false);
    
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
        toast.error("Erro: Usuário não identificado.");
        return;
    }
    
    setGenerating(true);
    setError('');
    
    try {
        const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
        if (userError) throw userError;
        if (!user) throw new Error('User not found');
        
        const workoutPlan = await generateWorkout(user);
        
        // Delete old workouts (cascade deletes exercises)
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

        // Refresh local state instead of reloading page
        setGenerating(false);
        setRefreshKey(prev => prev + 1);
        toast.success('Novo treino gerado com sucesso!');
    } catch (error: any) {
        console.error('Regenerate error:', error);
        toast.error(`Erro ao gerar treino: ${error.message}`);
        setGenerating(false);
    }
  };

  const startRest = (timeString: string) => {
    // Parse "60s", "90 seg", "1 min" etc.
    let seconds = 60;
    const num = parseInt(timeString.replace(/\D/g, ''));
    if (!isNaN(num)) {
        if (timeString.includes('min')) seconds = num * 60;
        else seconds = num;
    }
    
    setRestTime(seconds);
    setTimerOpen(true);
  };

  const toggleExerciseVideo = (index: number) => {
    setExpandedExercise(expandedExercise === index ? null : index);
    setExpandedInstruction(null); // Close instructions if video opens
  };

  const toggleExerciseInstruction = (index: number) => {
    setExpandedInstruction(expandedInstruction === index ? null : index);
    setExpandedExercise(null); // Close video if instructions open
  };

  const toggleExerciseCompletion = (index: number) => {
    setCompletedExercises(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        return newSet;
    });
  };

  if (loading) return <LoadingScreen message="Carregando seu treino..." />;

  if (generating) return <LoadingScreen message="A IA está montando seu treino personalizado..." />;

  const renderModals = () => (
    <>
      {/* Custom Confirmation Modal for Regenerate */}
      <AnimatePresence>
        {showRegenerateConfirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegenerateConfirm(false)} />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative z-10"
                >
                    <h3 className="font-bold text-xl text-gray-900 mb-2">Gerar Novo Treino?</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        Isso criará uma nova ficha personalizada e substituirá a atual. Todo o histórico do treino atual será mantido, mas a ficha ativa mudará.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowRegenerateConfirm(false)}
                            className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmRegenerate}
                            className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                        >
                            Gerar Novo
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal for Finish */}
      <AnimatePresence>
        {showFinishConfirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFinishConfirm(false)} />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative z-10"
                >
                    <h3 className="font-bold text-xl text-gray-900 mb-2">Concluir Treino?</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        {completedExercises.size < (workout?.days.find((d: any) => d.name === selectedDay)?.exercises?.length || 0) 
                            ? "Você ainda não marcou todos os exercícios como concluídos. Deseja finalizar mesmo assim?" 
                            : "Parabéns por completar todos os exercícios! Deseja registrar este treino?"}
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowFinishConfirm(false)}
                            className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            disabled={finishing}
                        >
                            Voltar
                        </button>
                        <button 
                            onClick={confirmFinishWorkout}
                            disabled={finishing}
                            className="flex-1 py-3 font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex justify-center items-center"
                        >
                            {finishing ? <RefreshCw className="animate-spin" size={20} /> : 'Finalizar'}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 text-center flex flex-col items-center"
                >
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <Trophy size={40} className="text-green-600" />
                    </div>
                    <h3 className="font-black text-2xl text-gray-900 mb-3">Treino Concluído!</h3>
                    <p className="text-gray-600 mb-8 leading-relaxed text-lg">
                        {motivationMessage}
                    </p>
                    <button 
                        onClick={() => {
                            setShowSuccessModal(false);
                            navigate('/');
                        }}
                        className="w-full py-4 font-bold text-white bg-gray-900 rounded-2xl hover:bg-black transition-transform active:scale-95 shadow-xl"
                    >
                        Voltar ao Início
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </>
  );

  if (!workout && !generating) return (
    <div className="p-6 flex flex-col items-center justify-center h-[80vh] text-center">
        <DumbbellIconLarge />
        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-6">Nenhum treino encontrado</h2>
        <p className="text-gray-500 mb-8 max-w-xs">Parece que você ainda não tem uma ficha de treino ativa.</p>
        <button 
            onClick={handleRegenerateClick}
            className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2"
        >
            <RefreshCw size={20} /> Gerar Meu Treino
        </button>
        {renderModals()}
    </div>
  );

  const currentDayExercises = workout.days.find((d: any) => d.name === selectedDay)?.exercises || [];

  // Map English days to Portuguese for display if needed, though AI usually returns Portuguese
  // If AI returns "Treino A", we keep it. If it returns "Monday", we might want to map.
  // For now, let's trust the AI's naming or the fallback's naming.

  const handleFinishWorkoutClick = () => {
    setShowFinishConfirm(true);
  };

  const confirmFinishWorkout = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
        alert("Erro: Usuário não identificado.");
        return;
    }

    setFinishing(true);
    try {
        const { error } = await supabase.from('workout_history').insert([{
            user_id: userId,
            workout_id: workout.id,
            day_name: selectedDay,
            duration_minutes: 60
        }]);

        if (error) throw error;
        
        // Static motivation instead of AI generation
        const motivation = "Treino concluído com sucesso! Continue assim para alcançar seus objetivos.";
        
        setMotivationMessage(motivation);
        setShowFinishConfirm(false);
        setShowSuccessModal(true);
    } catch (error: any) {
        console.error('Error in handleFinishWorkout:', error);
        toast.error(`Erro ao concluir treino: ${error.message || 'Erro desconhecido'}`);
    } finally {
        setFinishing(false);
    }
  };

  return (
    <div className="p-6 md:p-10 pb-24 md:pb-10 space-y-6 md:space-y-8">
      <header className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Seu Plano</h1>
            <p className="text-gray-500 text-sm md:text-base">{workout.type}</p>
        </div>
        <button 
            onClick={() => {
                console.log('Botão Novo Treino clicado');
                handleRegenerateClick();
            }}
            className={`relative z-50 text-xs md:text-sm px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl font-medium flex items-center gap-1 md:gap-2 transition-transform ${
                generating 
                ? 'bg-gray-100 text-gray-400 cursor-wait' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 cursor-pointer'
            }`}
        >
            <RefreshCw size={14} className={generating ? "animate-spin md:w-5 md:h-5" : "md:w-5 md:h-5"} /> 
            {generating ? 'Gerando...' : 'Novo Treino'}
        </button>
      </header>

      {/* Day Selector */}
      <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
        {workout.days.map((day: any) => (
            <button
                key={day.name}
                onClick={() => setSelectedDay(day.name)}
                className={`px-5 md:px-6 py-2.5 md:py-3 rounded-full text-sm md:text-base font-bold whitespace-nowrap transition-all shadow-sm ${
                    selectedDay === day.name 
                    ? 'bg-blue-600 text-white shadow-blue-200' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
            >
                {day.name}
            </button>
        ))}
      </div>

      {/* Exercise List */}
      <div className="space-y-4 md:space-y-6">
        {currentDayExercises.map((ex: any, idx: number) => {
            const isExpanded = expandedExercise === idx;
            const isInstructionExpanded = expandedInstruction === idx;
            const isCompleted = completedExercises.has(idx);
            
            return (
            <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border transition-all ${
                    isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
                } overflow-hidden relative z-0`}
            >
                <div className="flex justify-between items-start mb-3 md:mb-5">
                    <div className="flex items-start gap-3 md:gap-4 w-3/4 md:w-5/6">
                        <button
                            onClick={() => toggleExerciseCompletion(idx)}
                            className={`mt-1 md:mt-1.5 min-w-[24px] h-6 w-6 md:h-8 md:w-8 md:min-w-[32px] rounded-full border-2 flex items-center justify-center transition-all ${
                                isCompleted 
                                ? 'bg-green-500 border-green-500 text-white' 
                                : 'border-gray-300 text-transparent hover:border-green-500'
                            }`}
                        >
                            <Check size={14} strokeWidth={3} className="md:w-5 md:h-5" />
                        </button>
                        <h3 className={`font-bold text-gray-900 text-lg md:text-xl leading-tight ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                            {ex.name}
                        </h3>
                    </div>
                    <div className="flex gap-2 md:gap-3">
                        <button 
                            onClick={() => startRest(ex.rest)}
                            className="text-blue-600 bg-blue-50 p-2 md:p-3 rounded-full hover:bg-blue-100 transition-colors"
                            title="Iniciar Descanso"
                        >
                            <Timer size={20} className="md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
                    <div className="bg-gray-50 p-2 md:p-3 rounded-lg md:rounded-xl text-center">
                        <div className="text-[10px] md:text-xs text-gray-400 uppercase font-bold tracking-wider">Séries</div>
                        <div className="font-mono font-bold text-gray-900 text-lg md:text-2xl">{ex.sets}</div>
                    </div>
                    <div className="bg-gray-50 p-2 md:p-3 rounded-lg md:rounded-xl text-center">
                        <div className="text-[10px] md:text-xs text-gray-400 uppercase font-bold tracking-wider">Reps</div>
                        <div className="font-mono font-bold text-gray-900 text-lg md:text-2xl">{ex.reps}</div>
                    </div>
                    <div className="bg-blue-50 p-2 md:p-3 rounded-lg md:rounded-xl text-center cursor-pointer hover:bg-blue-100 transition-colors group" onClick={() => startRest(ex.rest)}>
                        <div className="text-[10px] md:text-xs text-blue-400 uppercase font-bold tracking-wider group-hover:text-blue-600">Descanso</div>
                        <div className="font-mono font-bold text-blue-600 text-lg md:text-2xl flex items-center justify-center gap-1 md:gap-2">
                            {ex.rest} <Play size={10} className="fill-current md:w-3 md:h-3" />
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 md:gap-4 mt-4 md:mt-6">
                    <button 
                        onClick={() => toggleExerciseVideo(idx)}
                        className="flex-1 py-2.5 md:py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer relative z-10"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp size={16} className="md:w-5 md:h-5" /> Ocultar Vídeo
                            </>
                        ) : (
                            <>
                                <Video size={16} className="md:w-5 md:h-5" /> Ver Execução
                            </>
                        )}
                    </button>

                    <button 
                        onClick={() => toggleExerciseInstruction(idx)}
                        className="flex-1 py-2.5 md:py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer relative z-10"
                    >
                        {isInstructionExpanded ? (
                            <>
                                <ChevronUp size={16} className="md:w-5 md:h-5" /> Ocultar Dicas
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={16} className="md:w-5 md:h-5" /> Como Fazer?
                            </>
                        )}
                    </button>
                </div>

                {/* Expandable Video Section */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="relative w-full aspect-video bg-gray-900 rounded-xl md:rounded-2xl overflow-hidden group shadow-inner cursor-pointer">
                                <img 
                                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80" 
                                    alt="Treino" 
                                    className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity duration-300"
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                    <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm mb-3 group-hover:scale-110 transition-transform duration-300">
                                        <Youtube size={40} className="text-red-500 drop-shadow-lg" fill="currentColor" />
                                    </div>
                                    <h4 className="font-bold text-white text-base md:text-lg drop-shadow-md">Ver Execução no YouTube</h4>
                                    <p className="text-xs md:text-sm text-gray-200 mt-1 drop-shadow-md max-w-xs">
                                        Aprenda a forma correta do exercício <span className="font-semibold text-white">"{ex.name}"</span>
                                    </p>
                                </div>
                                <a 
                                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' exercício execução')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-0 z-10"
                                    title="Buscar no YouTube"
                                >
                                    <span className="sr-only">Buscar no YouTube</span>
                                </a>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Expandable Instructions Section */}
                <AnimatePresence>
                    {isInstructionExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            className="overflow-hidden bg-blue-50/50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-blue-100"
                        >
                            <h4 className="font-bold text-blue-800 text-sm md:text-base mb-2 flex items-center gap-2">
                                <AlertTriangle size={14} className="md:w-5 md:h-5" /> Instruções de Execução
                            </h4>
                            <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line mb-4 md:mb-6">
                                {ex.instructions || "Instruções detalhadas não disponíveis para este exercício."}
                            </p>
                            
                            <h4 className="font-bold text-blue-800 text-sm md:text-base mb-2">Músculos Trabalhados</h4>
                            <div className="flex flex-wrap gap-2 md:gap-3">
                                {(ex.muscles_worked || "Geral").split(',').map((muscle: string, i: number) => (
                                    <span key={i} className="text-xs md:text-sm bg-white text-blue-600 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-blue-100 font-medium">
                                        {muscle.trim()}
                                    </span>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        )})}
      </div>

      <button 
        onClick={handleFinishWorkoutClick}
        className={`cursor-pointer relative z-10 w-full py-4 md:py-5 rounded-xl md:rounded-2xl font-bold md:text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${
            completedExercises.size === currentDayExercises.length
            ? 'bg-green-600 text-white shadow-green-200 hover:bg-green-700'
            : 'bg-yellow-500 text-white shadow-yellow-200 hover:bg-yellow-600'
        }`}
      >
        <Check size={24} className="md:w-7 md:h-7" /> 
        {completedExercises.size === currentDayExercises.length ? 'Concluir Treino' : `Concluir (Faltam ${currentDayExercises.length - completedExercises.size})`}
      </button>

      <RestTimer 
        isOpen={timerOpen} 
        initialSeconds={restTime} 
        onClose={() => setTimerOpen(false)} 
      />

      {/* Custom Confirmation Modal for Regenerate */}
      <AnimatePresence>
        {showRegenerateConfirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegenerateConfirm(false)} />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative z-10"
                >
                    <h3 className="font-bold text-xl text-gray-900 mb-2">Gerar Novo Treino?</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        Isso criará uma nova ficha personalizada e substituirá a atual. Todo o histórico do treino atual será mantido, mas a ficha ativa mudará.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowRegenerateConfirm(false)} 
                            className="flex-1 py-3.5 bg-gray-100 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmRegenerate} 
                            className="flex-1 py-3.5 bg-blue-600 rounded-xl font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
                        >
                            Sim, Gerar
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal for Finish Workout */}
      <AnimatePresence>
        {showFinishConfirm && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                >
                    <h3 className="font-bold text-xl text-gray-900 mb-2">Concluir Treino?</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        {completedExercises.size < currentDayExercises.length 
                            ? `Você ainda tem ${currentDayExercises.length - completedExercises.size} exercícios pendentes. Deseja finalizar mesmo assim?`
                            : "Parabéns por finalizar todos os exercícios! Deseja registrar este treino como concluído?"
                        }
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowFinishConfirm(false)} 
                            disabled={finishing}
                            className="flex-1 py-3.5 bg-gray-100 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Voltar
                        </button>
                        <button 
                            onClick={confirmFinishWorkout} 
                            disabled={finishing}
                            className="flex-1 py-3.5 bg-green-600 rounded-xl font-bold text-white hover:bg-green-700 shadow-lg shadow-green-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {finishing ? <RefreshCw size={18} className="animate-spin" /> : null}
                            {finishing ? 'Salvando...' : 'Concluir'}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500"></div>
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                        <Trophy size={40} />
                    </div>
                    <h3 className="font-bold text-2xl text-gray-900 mb-2">Treino Concluído!</h3>
                    <p className="text-gray-600 mb-8 text-lg italic leading-relaxed">
                        "{motivationMessage}"
                    </p>
                    <button 
                        onClick={() => navigate('/')} 
                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
                    >
                        Voltar ao Início
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
      
      {/* Debug Info - Remove in production */}
      <div className="fixed bottom-24 left-0 right-0 text-[10px] text-gray-300 text-center pointer-events-none">
        Debug: Generating={generating ? 'true' : 'false'}
      </div>
    </div>
  );
}

function DumbbellIconLarge() {
    return (
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>
        </div>
    )
}
