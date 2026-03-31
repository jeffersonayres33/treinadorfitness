import { motion } from 'motion/react';
import { Dumbbell } from 'lucide-react';

export default function LoadingScreen({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6">
      <motion.div
        animate={{ 
          rotate: [0, 180, 360],
          scale: [1, 1.2, 1]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="text-blue-600 mb-6"
      >
        <Dumbbell size={64} />
      </motion.div>
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-gray-500 font-medium text-center animate-pulse"
      >
        {message}
      </motion.p>
    </div>
  );
}
