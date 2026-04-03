import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Utensils, ShoppingCart, Download, ThermometerSnowflake, FileText, Plus, Check, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../db';
import { generateMealPlan } from '../lib/gemini';
import LoadingScreen from '../components/LoadingScreen';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function NutritionPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState<'plan' | 'shopping'>('plan');

  const [preferences, setPreferences] = useState({
    goal: 'weight_loss',
    mealType: 'fresh',
    days: 7,
    restrictions: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      setUser(userData);

      // Fetch existing meal plan if any
      const { data: planData } = await supabase.from('meal_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (planData && planData.length > 0) {
        setMealPlan(planData[0]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const plan = await generateMealPlan(user, preferences);
      
      const payload = {
        user_id: user.id,
        goal: preferences.goal,
        preference: preferences.mealType,
        days: preferences.days,
        meals: plan.days,
        shopping_list: plan.shopping_list
      };

      // Try to insert, if table doesn't exist it will throw error
      const { data, error } = await supabase.from('meal_plans').insert([payload]).select().single();
      
      if (error) {
        if (error.code === '42P01') {
          toast.error("Tabela 'meal_plans' não existe no Supabase. Execute o script SQL.");
          // Fallback to local state for now
          setMealPlan({ ...payload, created_at: new Date().toISOString() });
        } else {
          throw error;
        }
      } else {
        setMealPlan(data);
        toast.success("Cardápio gerado com sucesso!");
      }
    } catch (error: any) {
      console.error("Error generating meal plan:", error);
      toast.error(error.message || "Erro ao gerar cardápio.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    if (!mealPlan) return;
    
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(33, 33, 33);
    doc.text('Seu Plano Nutricional', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Objetivo: ${mealPlan.goal === 'weight_loss' ? 'Emagrecimento' : mealPlan.goal === 'hypertrophy' ? 'Hipertrofia' : 'Manutenção'}`, 14, 30);
    doc.text(`Tipo: ${mealPlan.preference === 'frozen' ? 'Marmitas Congeladas' : 'Refeições Frescas'}`, 14, 36);
    
    let yPos = 45;

    if (activeTab === 'plan') {
      mealPlan.meals.forEach((day: any) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(16);
        doc.setTextColor(0, 102, 204);
        doc.text(`Dia ${day.day}`, 14, yPos);
        yPos += 10;

        day.meals.forEach((meal: any) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFontSize(14);
          doc.setTextColor(50, 50, 50);
          doc.text(`${meal.type}: ${meal.name}`, 14, yPos);
          yPos += 7;
          
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          doc.text(`Ingredientes: ${meal.ingredients.join(', ')}`, 14, yPos, { maxWidth: 180 });
          
          // Calculate lines for ingredients
          const ingLines = doc.splitTextToSize(`Ingredientes: ${meal.ingredients.join(', ')}`, 180);
          yPos += (ingLines.length * 5) + 2;

          if (meal.instructions) {
            doc.setTextColor(60, 60, 60);
            doc.text(`Preparo: ${meal.instructions}`, 14, yPos, { maxWidth: 180 });
            const prepLines = doc.splitTextToSize(`Preparo: ${meal.instructions}`, 180);
            yPos += (prepLines.length * 5) + 2;
          }

          if (meal.macros) {
            doc.text(`Macros: ${meal.macros.calories}kcal | P: ${meal.macros.protein}g | C: ${meal.macros.carbs}g | G: ${meal.macros.fat}g`, 14, yPos);
            yPos += 7;
          }

          if (meal.freezing_info) {
            doc.setTextColor(0, 153, 204);
            doc.text(`Congelamento: ${meal.freezing_info}`, 14, yPos, { maxWidth: 180 });
            const freezeLines = doc.splitTextToSize(`Congelamento: ${meal.freezing_info}`, 180);
            yPos += (freezeLines.length * 5) + 2;
          }
          
          yPos += 5;
        });
        yPos += 5;
      });
      doc.save('cardapio.pdf');
    } else {
      // Shopping List PDF
      doc.text('Lista de Compras', 14, yPos);
      yPos += 10;
      
      const tableData = mealPlan.shopping_list.map((item: any) => [
        item.category,
        item.item,
        item.quantity
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Categoria', 'Item', 'Quantidade']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 102, 204] }
      });
      
      doc.save('lista_de_compras.pdf');
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="pb-24 pt-6 px-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Nutrição IA</h1>
          <p className="text-gray-500 mt-1">Seu nutricionista pessoal 24/7</p>
        </div>
        <div className="bg-green-100 p-3 rounded-2xl">
          <Utensils className="text-green-600" size={28} />
        </div>
      </div>

      {!mealPlan && !generating && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Configurar Cardápio</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo Principal</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'weight_loss', label: 'Emagrecimento' },
                  { id: 'hypertrophy', label: 'Hipertrofia' },
                  { id: 'maintenance', label: 'Manutenção' }
                ].map(obj => (
                  <button
                    key={obj.id}
                    onClick={() => setPreferences({...preferences, goal: obj.id})}
                    className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      preferences.goal === obj.id 
                        ? 'border-green-500 bg-green-50 text-green-700' 
                        : 'border-gray-200 text-gray-600 hover:border-green-200'
                    }`}
                  >
                    {obj.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Preparo</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => setPreferences({...preferences, mealType: 'frozen'})}
                  className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    preferences.mealType === 'frozen' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 text-gray-600 hover:border-blue-200'
                  }`}
                >
                  <ThermometerSnowflake size={24} />
                  <div className="text-left">
                    <div className="font-bold">Marmitas Congeladas</div>
                    <div className="text-xs opacity-80">Praticidade para a semana</div>
                  </div>
                </button>
                <button
                  onClick={() => setPreferences({...preferences, mealType: 'fresh'})}
                  className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    preferences.mealType === 'fresh' 
                      ? 'border-green-500 bg-green-50 text-green-700' 
                      : 'border-gray-200 text-gray-600 hover:border-green-200'
                  }`}
                >
                  <Utensils size={24} />
                  <div className="text-left">
                    <div className="font-bold">Refeições Frescas</div>
                    <div className="text-xs opacity-80">Preparo diário</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duração do Cardápio</label>
              <select 
                value={preferences.days}
                onChange={(e) => setPreferences({...preferences, days: parseInt(e.target.value)})}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-green-500 focus:border-green-500 block p-3"
              >
                <option value={3}>3 Dias</option>
                <option value={5}>5 Dias</option>
                <option value={7}>7 Dias</option>
                <option value={14}>14 Dias</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Restrições Alimentares (Opcional)</label>
              <input 
                type="text"
                placeholder="Ex: intolerância a lactose, sem glúten, não gosto de brócolis..."
                value={preferences.restrictions}
                onChange={(e) => setPreferences({...preferences, restrictions: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-green-500 focus:border-green-500 block p-3"
              />
              <p className="text-xs text-gray-500 mt-1">A IA irá excluir esses alimentos do seu cardápio.</p>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full bg-gray-900 text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
            >
              <RefreshCw size={20} />
              Gerar Cardápio com IA
            </button>
          </div>
        </motion.div>
      )}

      {generating && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Montando seu cardápio...</h3>
          <p className="text-gray-500">A inteligência artificial está calculando macros, selecionando ingredientes e organizando sua lista de compras.</p>
        </div>
      )}

      {mealPlan && !generating && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'plan' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText size={18} />
              Cardápio
            </button>
            <button
              onClick={() => setActiveTab('shopping')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'shopping' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingCart size={18} />
              Lista de Compras
            </button>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">
              {activeTab === 'plan' ? 'Seu Plano Alimentar' : 'Sua Lista de Compras'}
            </h2>
            <button 
              onClick={downloadPDF}
              className="flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Download size={16} />
              Baixar PDF
            </button>
          </div>

          {activeTab === 'plan' && (
            <div className="space-y-4">
              {mealPlan.meals.map((day: any) => (
                <div key={day.day} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <button 
                    onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                    className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="font-bold text-gray-900">Dia {day.day}</div>
                    {expandedDay === day.day ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedDay === day.day && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-4">
                          {day.meals.map((meal: any, idx: number) => (
                            <div key={idx} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="text-xs font-bold text-green-600 uppercase tracking-wider">{meal.type}</span>
                                  <h4 className="font-bold text-gray-900 text-lg">{meal.name}</h4>
                                </div>
                                {meal.macros && (
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-gray-900">{meal.macros.calories} kcal</div>
                                    <div className="text-xs text-gray-500">P:{meal.macros.protein}g C:{meal.macros.carbs}g G:{meal.macros.fat}g</div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="mt-3">
                                <h5 className="text-xs font-bold text-gray-700 mb-1">Ingredientes:</h5>
                                <ul className="list-disc pl-4 text-sm text-gray-600 space-y-1">
                                  {meal.ingredients.map((ing: string, i: number) => (
                                    <li key={i}>{ing}</li>
                                  ))}
                                </ul>
                              </div>

                              {meal.instructions && (
                                <div className="mt-3">
                                  <h5 className="text-xs font-bold text-gray-700 mb-1">Modo de Preparo:</h5>
                                  <p className="text-sm text-gray-600">{meal.instructions}</p>
                                </div>
                              )}

                              {meal.freezing_info && (
                                <div className="mt-3 bg-blue-50 p-3 rounded-xl flex gap-3 items-start">
                                  <ThermometerSnowflake className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                  <p className="text-xs text-blue-800">{meal.freezing_info}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'shopping' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              {Object.entries(
                mealPlan.shopping_list.reduce((acc: any, item: any) => {
                  if (!acc[item.category]) acc[item.category] = [];
                  acc[item.category].push(item);
                  return acc;
                }, {})
              ).map(([category, items]: [string, any]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <h3 className="font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">{category}</h3>
                  <ul className="space-y-2">
                    {items.map((item: any, idx: number) => (
                      <li key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{item.item}</span>
                        <span className="font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded">{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setMealPlan(null)}
            className="w-full py-4 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            Gerar novo cardápio
          </button>
        </motion.div>
      )}
    </div>
  );
}
