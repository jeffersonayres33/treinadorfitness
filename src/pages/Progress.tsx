import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Plus, Camera, Image as ImageIcon, X } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '../db';
import { toast } from 'sonner';

export default function ProgressPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) return;

      const [logsRes, userRes] = await Promise.all([
        supabase.from('progress_logs').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('users').select('*').eq('id', userId).maybeSingle()
      ]);
      
      if (logsRes.data) {
        setLogs(logsRes.data);
      }
      
      if (userRes.data) {
        setUser(userRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddLog = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!newWeight || !userId) return;
    
    const { error: insertError } = await supabase.from('progress_logs').insert([{
        user_id: userId,
        weight: parseFloat(newWeight),
        photo: newPhoto
    }]);

    if (insertError) {
        console.error("Error inserting log:", insertError);
        toast.error("Erro ao salvar registro.");
        return;
    }
    
    // Also update current weight in user profile
    const { error: updateError } = await supabase.from('users').update({
        weight: parseFloat(newWeight)
    }).eq('id', userId);

    if (updateError) {
        console.error("Error updating user weight:", updateError);
    }
    
    setShowModal(false);
    setNewWeight('');
    setNewPhoto(null);
    fetchData();
    toast.success("Registro adicionado com sucesso!");
  };

  // Filter logs that have photos
  const logsWithPhotos = logs.filter(log => log.photo);
  const firstPhoto = logsWithPhotos[0];
  const lastPhoto = logsWithPhotos[logsWithPhotos.length - 1];
  const showComparison = logsWithPhotos.length >= 2;

  return (
    <div className="p-6 md:p-10 pb-24 md:pb-10 space-y-6 md:space-y-8">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Sua Evolução</h1>
        <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white p-2 md:p-3 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
            <Plus size={24} className="md:w-7 md:h-7" />
        </button>
      </header>

      {/* Before & After Comparison */}
      {showComparison ? (
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-sm md:text-base font-semibold text-gray-700 mb-4 md:mb-6 flex items-center gap-2">
                <Camera size={16} className="md:w-5 md:h-5" /> Antes e Depois
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div className="space-y-2 md:col-span-2">
                    <div className="aspect-[3/4] md:aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-gray-100 relative">
                        <img src={firstPhoto.photo} alt="Antes" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 bg-black/60 text-white text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 rounded-lg backdrop-blur-sm">
                            {new Date(firstPhoto.date).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                    <div className="text-center">
                        <span className="text-xs md:text-sm font-bold text-gray-500 uppercase">Início</span>
                        <div className="font-bold text-gray-900 md:text-xl">{firstPhoto.weight} kg</div>
                    </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                    <div className="aspect-[3/4] md:aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-gray-100 relative">
                        <img src={lastPhoto.photo} alt="Depois" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 bg-black/60 text-white text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 rounded-lg backdrop-blur-sm">
                            {new Date(lastPhoto.date).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                    <div className="text-center">
                        <span className="text-xs md:text-sm font-bold text-blue-600 uppercase">Atual</span>
                        <div className="font-bold text-gray-900 md:text-xl">{lastPhoto.weight} kg</div>
                    </div>
                </div>
            </div>
            <div className="mt-4 md:mt-6 text-center">
                <span className={clsx(
                    "text-sm md:text-base font-bold px-3 md:px-4 py-1 md:py-1.5 rounded-full",
                    lastPhoto.weight < firstPhoto.weight ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                )}>
                    {Math.abs(lastPhoto.weight - firstPhoto.weight).toFixed(1)} kg {lastPhoto.weight < firstPhoto.weight ? 'perdidos' : 'de diferença'}
                </span>
            </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-blue-100 text-center">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-sm text-blue-500">
                <Camera size={24} className="md:w-8 md:h-8" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1 md:text-lg">Registre sua jornada</h3>
            <p className="text-sm md:text-base text-gray-500 max-w-md mx-auto">Adicione fotos ao registrar seu peso para desbloquear a comparação Antes e Depois.</p>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 h-64 md:h-96">
        <h3 className="text-sm md:text-base font-semibold text-gray-700 mb-4 md:mb-6">Histórico de Peso</h3>
        {logs.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={logs}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="created_at" tick={{fontSize: 12}} tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                    <Tooltip />
                    {user?.target_weight && (
                        <ReferenceLine y={user.target_weight} label="Meta" stroke="#10b981" strokeDasharray="3 3" />
                    )}
                    <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                </LineChart>
            </ResponsiveContainer>
        ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm md:text-base">
                Nenhum registro ainda.
            </div>
        )}
      </div>

      {/* Log List */}
      <div className="space-y-3 md:space-y-4">
        <h3 className="text-sm md:text-base font-semibold text-gray-700">Registros Recentes</h3>
        {logs.slice().reverse().map((log) => (
            <div key={log.id} className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                    {log.photo ? (
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-gray-100 overflow-hidden">
                            <img src={log.photo} alt="Foto" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-gray-50 flex items-center justify-center text-gray-300">
                            <ImageIcon size={16} className="md:w-6 md:h-6" />
                        </div>
                    )}
                    <span className="text-gray-600 text-sm md:text-base font-medium">
                        {new Date(log.created_at).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                </div>
                <span className="font-bold text-gray-900 md:text-lg">{log.weight} kg</span>
            </div>
        ))}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Novo Registro</h3>
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Peso Atual (kg)</label>
                        <input 
                            type="number" 
                            value={newWeight} 
                            onChange={(e) => setNewWeight(e.target.value)}
                            className="w-full p-3 border rounded-xl text-lg font-bold text-center"
                            placeholder="0.0"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Foto de Progresso (Opcional)</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors h-32"
                        >
                            {newPhoto ? (
                                <div className="relative w-full h-full">
                                    <img src={newPhoto} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNewPhoto(null);
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Camera className="text-gray-400" size={24} />
                                    <span className="text-xs text-gray-500">Toque para adicionar foto</span>
                                </>
                            )}
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>

                    <button 
                        onClick={handleAddLog} 
                        disabled={!newWeight}
                        className="w-full bg-blue-600 text-white p-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        Salvar Progresso
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
