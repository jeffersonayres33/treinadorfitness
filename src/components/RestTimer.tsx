import { useState, useEffect } from 'react';
import { X, RotateCcw, Play, Pause, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

interface RestTimerProps {
  initialSeconds: number;
  onClose: () => void;
  isOpen: boolean;
}

export default function RestTimer({ initialSeconds, onClose, isOpen }: RestTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setSeconds(initialSeconds);
    setIsActive(true);
  }, [initialSeconds, isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((prev) => prev - 1);
      }, 1000);
    } else if (seconds === 0) {
      setIsActive(false);
      // Optional: Play sound or vibrate here
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setSeconds(initialSeconds);
    setIsActive(true);
  };
  const adjustTime = (amount: number) => setSeconds(prev => Math.max(0, prev + amount));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-gray-900 text-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-2xl z-50 flex items-center justify-between border border-gray-800"
        >
          <div className="flex flex-col">
            <span className="text-xs md:text-sm text-gray-400 uppercase font-bold tracking-wider">Descanso</span>
            <div className="text-3xl md:text-4xl font-mono font-bold tabular-nums text-blue-400">
              {formatTime(seconds)}
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => adjustTime(-10)} className="p-2 md:p-3 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                <Minus size={20} className="md:w-6 md:h-6" />
            </button>
            
            <button 
                onClick={toggleTimer}
                className={clsx(
                    "w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all",
                    isActive ? "bg-yellow-500 text-black" : "bg-green-600 text-white hover:bg-green-500"
                )}
            >
                {isActive ? <Pause size={24} fill="currentColor" className="md:w-8 md:h-8" /> : <Play size={24} fill="currentColor" className="md:w-8 md:h-8" />}
            </button>

            <button onClick={() => adjustTime(10)} className="p-2 md:p-3 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                <Plus size={20} className="md:w-6 md:h-6" />
            </button>

            <div className="w-px h-8 md:h-10 bg-gray-700 mx-1 md:mx-2"></div>

            <button onClick={onClose} className="p-2 md:p-3 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                <X size={24} className="md:w-7 md:h-7" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
