import { BrowserRouter, Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom';
import { Home, Dumbbell, LineChart, History, Menu, X, MessageCircle, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './db';

import { Toaster } from 'sonner';
 
declare global {
  interface Window {
    aistudio?: {
      openSelectKey: () => Promise<void>;
      hasSelectedApiKey: () => Promise<boolean>;
    };
  }
}
 
// Pages
import HomePage from './pages/Home';
import OnboardingPage from './pages/Onboarding';
import WorkoutPage from './pages/Workout';
import ProgressPage from './pages/Progress';
import HistoryPage from './pages/History';
import { ChatPage } from './pages/Chat';
import LoadingScreen from './components/LoadingScreen';

function DrawerMenu({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.nav 
            initial={{ x: '-100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Dumbbell size={24} />
                </div>
                <span className="text-xl font-bold text-gray-900 tracking-tight">FitAI</span>
              </div>
              <button onClick={onClose} className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="flex flex-col p-4 gap-2 mt-4">
              <Link to="/" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
                <span className="text-base">Início</span>
              </Link>
              <Link to="/workout" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/workout') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <Dumbbell size={24} strokeWidth={isActive('/workout') ? 2.5 : 2} />
                <span className="text-base">Treino</span>
              </Link>
              <Link to="/history" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/history') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <History size={24} strokeWidth={isActive('/history') ? 2.5 : 2} />
                <span className="text-base">Histórico</span>
              </Link>
              <Link to="/progress" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/progress') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <LineChart size={24} strokeWidth={isActive('/progress') ? 2.5 : 2} />
                <span className="text-base">Evolução</span>
              </Link>
              <Link to="/chat" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/chat') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <MessageCircle size={24} strokeWidth={isActive('/chat') ? 2.5 : 2} />
                <span className="text-base">Coach AI</span>
              </Link>

              <div className="mt-auto p-4 border-t border-gray-100">
                <button 
                  onClick={async () => {
                    if (window.aistudio?.openSelectKey) {
                      await window.aistudio.openSelectKey();
                      onClose();
                    }
                  }}
                  className="w-full flex items-center gap-4 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors px-4 py-4 rounded-xl font-medium"
                >
                  <Settings size={24} />
                  <span className="text-base text-left">Configurações de IA</span>
                </button>
                <div className="mt-2 px-4 text-[10px] text-gray-400">
                  Configure sua chave para melhor qualidade de imagem.
                </div>
              </div>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  if (location.pathname === '/onboarding') return null;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
          <Menu size={24} />
        </button>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md">
          <Dumbbell size={18} />
        </div>
        <span className="text-lg font-bold text-gray-900 tracking-tight">FitAI</span>
      </div>
    </header>
  );
}

function AppContent() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const storedId = localStorage.getItem('userId');
      
      if (!storedId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.from('users').select('id').eq('id', storedId).single();
        
        if (!error && data) {
          setUserId(storedId);
        } else {
          console.warn('User ID invalid or not found, resetting...');
          localStorage.removeItem('userId');
          setUserId(null);
        }
      } catch (error) {
        console.error('Connection error:', error);
        setUserId(storedId);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  if (isLoading) return <LoadingScreen message="Iniciando..." />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-100 flex flex-col">
      <Toaster position="top-center" richColors />
      {userId && <TopBar onMenuClick={() => setIsMenuOpen(true)} />}
      {userId && <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />}
      
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-5xl mx-auto w-full">
          <Routes>
            <Route path="/" element={userId ? <HomePage setUserId={setUserId} /> : <OnboardingPage setUserId={setUserId} />} />
            <Route path="/onboarding" element={<OnboardingPage setUserId={setUserId} />} />
            <Route path="/workout" element={userId ? <WorkoutPage /> : <OnboardingPage setUserId={setUserId} />} />
            <Route path="/history" element={userId ? <HistoryPage /> : <OnboardingPage setUserId={setUserId} />} />
            <Route path="/progress" element={userId ? <ProgressPage /> : <OnboardingPage setUserId={setUserId} />} />
            <Route path="/chat" element={userId ? <ChatPage /> : <OnboardingPage setUserId={setUserId} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppContent />
    </BrowserRouter>
  );
}
