import { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../db';

interface WorkoutHistoryItem {
  id: number;
  day_name: string;
  completed_at: string;
  duration_minutes: number;
  workout_type: string | null;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (userId) {
      const fetchHistory = async () => {
        try {
          const { data, error } = await supabase
            .from('workout_history')
            .select(`
              id,
              day_name,
              completed_at,
              duration_minutes,
              workouts (type)
            `)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

          if (error) throw error;
          
          if (data) {
            const formattedData = data.map((item: any) => ({
              id: item.id,
              day_name: item.day_name,
              completed_at: item.completed_at,
              duration_minutes: item.duration_minutes,
              workout_type: item.workouts?.type || null
            }));
            setHistory(formattedData);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      
      fetchHistory();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 pb-24 md:pb-10 space-y-6 md:space-y-8 min-h-screen bg-gray-50">
      <header className="flex items-center gap-4">
        <Link to="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-600 md:w-7 md:h-7" />
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Histórico de Treinos</h1>
      </header>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 md:mb-6 text-gray-400">
            <Calendar size={32} className="md:w-12 md:h-12" />
          </div>
          <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">Nenhum treino registrado</h3>
          <p className="text-gray-500 text-sm md:text-base max-w-xs md:max-w-md">
            Complete seu primeiro treino para começar a ver seu histórico aqui!
          </p>
          <Link 
            to="/workout" 
            className="mt-6 md:mt-8 px-6 md:px-8 py-3 md:py-4 bg-blue-600 text-white rounded-xl md:rounded-2xl font-semibold md:text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            Ir para Treino
          </Link>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {history.map((item) => (
            <div key={item.id} className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                  <CheckCircle size={24} className="md:w-8 md:h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 md:text-xl">{item.day_name}</h3>
                  <div className="flex items-center gap-3 mt-1 md:mt-2 text-sm md:text-base text-gray-500">
                    <span className="flex items-center gap-1 md:gap-2">
                      <Calendar size={14} className="md:w-5 md:h-5" />
                      {new Date(item.completed_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {item.workout_type && (
                    <span className="inline-block mt-2 md:mt-3 text-[10px] md:text-xs font-semibold px-2 md:px-3 py-0.5 md:py-1 bg-gray-100 text-gray-600 rounded-md md:rounded-lg uppercase tracking-wide">
                        {item.workout_type}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 md:gap-2 text-gray-900 font-bold md:text-lg">
                    <Clock size={16} className="text-blue-500 md:w-5 md:h-5" />
                    {item.duration_minutes} min
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
