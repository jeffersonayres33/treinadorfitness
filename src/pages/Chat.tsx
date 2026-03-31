import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User } from 'lucide-react';
import { motion } from 'motion/react';
import clsx from 'clsx';

interface Message {
  id: number;
  role: 'user' | 'model';
  content: string;
  created_at: string;
}

export function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }
    fetchMessages();
  }, [userId, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/chat/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // If no messages, send an initial greeting from the coach
        if (data.length === 0) {
          sendInitialGreeting();
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendInitialGreeting = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "Oi, coach! Estou pronto para começar." }),
      });
      if (response.ok) {
        fetchMessages();
      }
    } catch (error) {
      console.error('Failed to send initial greeting:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Optimistically add user message
    const tempId = Date.now();
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }]);

    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'model',
          content: data.response,
          created_at: new Date().toISOString()
        }]);
      } else {
        // Revert optimistic update on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      <header className="fixed top-0 inset-x-0 bg-zinc-900/80 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-tight">Coach AI</h1>
              <p className="text-xs text-emerald-400">Online</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 pt-24 pb-24 overflow-y-auto">
        <div className="space-y-6">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            // Don't show the initial hidden greeting from the user
            if (isUser && msg.content === "Oi, coach! Estou pronto para começar." && index === 0) {
              return null;
            }
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={clsx(
                  "flex gap-3 max-w-[85%]",
                  isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto",
                  isUser ? "bg-zinc-800" : "bg-emerald-500/20"
                )}>
                  {isUser ? <User className="w-5 h-5 text-zinc-400" /> : <Bot className="w-5 h-5 text-emerald-400" />}
                </div>
                <div className={clsx(
                  "p-4 rounded-2xl",
                  isUser 
                    ? "bg-emerald-500 text-white rounded-br-sm" 
                    : "bg-zinc-900 border border-white/5 text-zinc-200 rounded-bl-sm"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <span className="text-[10px] opacity-50 mt-2 block text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            );
          })}
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 max-w-[85%] mr-auto"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-auto">
                <Bot className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 text-zinc-200 rounded-bl-sm flex gap-1 items-center">
                <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-zinc-950 border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Fale com seu coach..."
              className="flex-1 bg-zinc-900 border border-white/10 rounded-full px-6 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors shrink-0"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
