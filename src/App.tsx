import { BrowserRouter, Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom';
import { Home, Dumbbell, LineChart, History, Menu, X, MessageCircle, Settings, LogOut } from 'lucide-react';
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
import NutritionPage from './pages/Nutrition';
import LoadingScreen from './components/LoadingScreen';
import LoginPage from './pages/Login';

function DrawerMenu({ isOpen, onClose, setUserId }: { isOpen: boolean, onClose: () => void, setUserId: (id: string | null) => void }) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    onClose();
  };

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
              <Link to="/nutrition" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/nutrition') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/nutrition') ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                <span className="text-base">Nutrição</span>
              </Link>
              <Link to="/history" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/history') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <History size={24} strokeWidth={isActive('/history') ? 2.5 : 2} />
                <span className="text-base">Histórico</span>
              </Link>
              <Link to="/progress" onClick={onClose} className={clsx("flex items-center gap-4 transition-colors px-4 py-4 rounded-xl", isActive('/progress') ? "text-blue-600 bg-blue-50 font-bold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium")}>
                <LineChart size={24} strokeWidth={isActive('/progress') ? 2.5 : 2} />
                <span className="text-base">Evolução</span>
              </Link>

              <div className="mt-auto p-4 border-t border-gray-100">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 text-red-600 hover:bg-red-50 transition-colors px-4 py-4 rounded-xl font-medium mb-2"
                >
                  <LogOut size={24} />
                  <span className="text-base text-left">Sair</span>
                </button>
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
    let mounted = true;

    const checkSession = async (session: any) => {
      try {
        const currentUserId = session?.user?.id || null;
        if (mounted) setUserId(currentUserId);
        
        if (currentUserId) {
          // Check if user has a profile
          const { data: profile, error } = await supabase.from('users').select('id').eq('id', currentUserId).maybeSingle();
          
          if (error) {
            console.error("Error fetching profile:", error);
          }
          
          const isAuthPage = window.location.pathname.includes('/login');
          const isOnboardingPage = window.location.pathname.includes('/onboarding');

          if (!profile && !isOnboardingPage && mounted) {
            navigate('/onboarding');
          } else if (profile && isAuthPage && mounted) {
            navigate('/');
          }
        } else {
          // Not logged in
          const isAuthPage = window.location.pathname.includes('/login');
          const isOnboardingPage = window.location.pathname.includes('/onboarding');
          
          if (!isAuthPage && !isOnboardingPage && mounted) {
            navigate('/login');
          }
        }
      } catch (err) {
        console.error("Auth state change error:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkSession(session);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isLoading) return <LoadingScreen message="Iniciando..." />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-100 flex flex-col">
      <Toaster position="top-center" richColors />
      {userId && <TopBar onMenuClick={() => setIsMenuOpen(true)} />}
      {userId && <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} setUserId={setUserId} />}
      
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-5xl mx-auto w-full">
          <Routes>
            <Route path="/" element={userId ? <HomePage setUserId={setUserId} /> : <LoginPage setUserId={setUserId} />} />
            <Route path="/login" element={<LoginPage setUserId={setUserId} />} />
            <Route path="/onboarding" element={<OnboardingPage setUserId={setUserId} />} />
            <Route path="/workout" element={userId ? <WorkoutPage /> : <LoginPage setUserId={setUserId} />} />
            <Route path="/history" element={userId ? <HistoryPage /> : <LoginPage setUserId={setUserId} />} />
            <Route path="/progress" element={userId ? <ProgressPage /> : <LoginPage setUserId={setUserId} />} />
            <Route path="/nutrition" element={userId ? <NutritionPage /> : <LoginPage setUserId={setUserId} />} />
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
