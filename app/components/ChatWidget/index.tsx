'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, ChatResponse } from './types';
import { Send, Bot, User, X, MessageCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Conference } from '@/app/types';
import { useLanguage } from '@/app/contexts/LanguageContext';

export default function ChatWidget() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  
  // Debug mount
  useEffect(() => {
    console.log("ChatWidget mounted");
  }, []);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是您的会议助手。您可以问我关于会议的任何问题，例如：“帮我找一下人工智能类的CCF A类会议”、“最近有哪些在中国举办的会议？”',
      timestamp: Date.now()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content })
      });

      if (!res.ok) throw new Error('Network error');

      const data: ChatResponse = await res.json();
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: Date.now(),
        relatedConferences: data.conferences
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: t('errorMessage'),
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Tooltip Bubble */}
      <AnimatePresence>
        {!isOpen && showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed bottom-28 right-10 bg-white px-4 py-3 rounded-xl shadow-xl border border-blue-100 z-[9998] max-w-[200px]"
          >
            <div className="text-sm text-gray-700 font-medium relative pt-2">
              <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setShowTooltip(false);
                }}
                className="absolute -top-3 -right-3 text-gray-400 hover:text-gray-600 p-2"
                aria-label="Close tooltip"
              >
                 <X size={14} />
              </button>
              {t('chatTooltip')}
            </div>
            <button 
              onClick={() => setIsOpen(true)}
              className="mt-2 text-xs text-blue-600 font-semibold hover:underline w-full text-right"
            >
              {t('askNow')} →
            </button>
            
            {/* Arrow Pointer */}
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-b border-r border-blue-100 transform rotate-45"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <button
        className="fixed bottom-10 right-10 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center z-[9999] focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all transform hover:scale-110"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Chat"
      >
        {isOpen ? <X size={32} /> : <MessageCircle size={32} />}
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 right-10 w-[90vw] md:w-[450px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col z-[9999] border border-gray-200 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center gap-3 text-white">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">{t('chatTitle')}</h3>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {t('online')}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-[90%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                    msg.role === 'user' ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className={cn(
                      "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.role === 'user' 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>

                    {/* Result Cards */}
                    {msg.relatedConferences && msg.relatedConferences.length > 0 && (
                      <div className="flex flex-col gap-2 mt-1">
                        {msg.relatedConferences.map((conf, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow text-left">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-gray-900">{conf.title}</span>
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                CCF {conf.rank?.ccf || 'N'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{conf.description}</p>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">{conf.sub}</span>
                              {/* We need to extract the link from the conf instances if available, assume first one for now */}
                              {conf.confs && conf.confs[0] && (
                                <a 
                                  href={conf.confs[0].link} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {t('viewDetails')}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={16} />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    {t('thinking')}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('chatPlaceholder')}
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
