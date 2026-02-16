'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, ChatResponse } from './types';
import { Send, Bot, User, X, MessageCircle, Copy, Check, ExternalLink, Sparkles, RefreshCw, ThumbsUp, ThumbsDown, Target, Clock, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/app/contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================
// UI/UX 优化: 组件化 Markdown 样式 (移动端优化)
// ============================================
const MarkdownComponents = {
  table: ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-x-auto my-2 md:my-3 -mx-1 -webkit-overflow-scrolling-touch">
      <table className="min-w-full border-collapse text-[10px] md:text-xs rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children: React.ReactNode }) => (
    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">{children}</thead>
  ),
  th: ({ children }: { children: React.ReactNode }) => (
    <th className="border border-gray-200 px-2 py-1.5 md:px-3 md:py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }: { children: React.ReactNode }) => (
    <td className="border border-gray-200 px-2 py-1.5 md:px-3 md:py-2 text-gray-600 whitespace-nowrap">{children}</td>
  ),
  tr: ({ children }: { children: React.ReactNode }) => (
    <tr className="even:bg-gray-50/50 hover:bg-blue-50/30 transition-colors">{children}</tr>
  ),
  pre: ({ children }: { children: React.ReactNode }) => (
    <pre className="bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 p-4 rounded-xl overflow-x-auto text-xs my-3 shadow-inner">
      {children}
    </pre>
  ),
  code: ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-blue-100/80 text-blue-700 px-1.5 py-0.5 rounded-md text-xs font-mono">{children}</code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="list-none my-2 space-y-1.5">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="list-none my-2 space-y-1.5 counter-reset-[list]">{children}</ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-start gap-2 text-gray-700">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
      <span>{children}</span>
    </li>
  ),
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-lg font-bold my-3 text-gray-900 flex items-center gap-2">{children}</h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-base font-bold my-2 text-gray-800">{children}</h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-sm font-semibold my-2 text-gray-800">{children}</h3>
  ),
  p: ({ children }: { children: React.ReactNode }) => (
    <p className="my-1.5 leading-relaxed text-gray-700">{children}</p>
  ),
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5 font-medium"
    >
      {children}
      <ExternalLink size={10} className="flex-shrink-0" />
    </a>
  ),
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="border-l-4 border-blue-400 pl-4 my-3 py-1 bg-blue-50/50 rounded-r-lg text-gray-600">
      {children}
    </blockquote>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-bold text-gray-900">{children}</strong>
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
};

// ============================================
// UI/UX 优化: 打字机效果 Hook (支持 prefers-reduced-motion)
// ============================================
function useTypewriter(text: string, speed: number = 20, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // 检查用户是否偏好减少动画
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!enabled || prefersReducedMotion) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);

    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, enabled]);

  return { displayedText, isTyping };
}

// ============================================
// UI/UX 优化: 检测 prefers-reduced-motion
// ============================================
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// ============================================
// UI/UX 优化: 消息内容组件
// ============================================
function MessageContent({ content, animate = false }: { content: string; animate?: boolean }) {
  const { displayedText, isTyping } = useTypewriter(content, 15, animate);
  const textToShow = animate ? displayedText : content;

  return (
    <div className="relative">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
        {textToShow}
      </ReactMarkdown>
      {animate && isTyping && (
        <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
      )}
    </div>
  );
}

// ============================================
// UI/UX 优化: 复制按钮 (移动端优化)
// ============================================
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      onClick={handleCopy}
      className={cn(
        "absolute top-1.5 right-1.5 md:top-2 md:right-2",
        "p-2 min-w-[36px] min-h-[36px] rounded-lg",
        "bg-gray-100/80 hover:bg-gray-200 active:bg-gray-300",
        "transition-colors opacity-0 group-hover:opacity-100 group-active:opacity-100 focus:opacity-100",
        "backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      title={copied ? '已复制' : '复制'}
      aria-label={copied ? '已复制到剪贴板' : '复制消息内容'}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Check size={14} className="text-green-600" />
          </motion.div>
        ) : (
          <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Copy size={14} className="text-gray-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================
// UI/UX 优化: 反馈按钮 (移动端优化)
// ============================================
function FeedbackButtons({ messageId }: { messageId: string }) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  return (
    <div className="flex items-center gap-1 mt-1.5 md:mt-2 opacity-0 group-hover:opacity-100 group-active:opacity-100 focus-within:opacity-100 transition-opacity">
      <button
        onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
        className={cn(
          "p-2.5 min-w-[44px] min-h-[44px] rounded-lg transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          "active:scale-95",
          feedback === 'up' ? "text-green-600 bg-green-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        )}
        title="有帮助"
        aria-label="这个回答有帮助"
        aria-pressed={feedback === 'up'}
      >
        <ThumbsUp size={16} />
      </button>
      <button
        onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
        className={cn(
          "p-2.5 min-w-[44px] min-h-[44px] rounded-lg transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          "active:scale-95",
          feedback === 'down' ? "text-red-600 bg-red-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        )}
        title="需要改进"
        aria-label="这个回答需要改进"
        aria-pressed={feedback === 'down'}
      >
        <ThumbsDown size={16} />
      </button>
    </div>
  );
}

// ============================================
// UI/UX 优化: 快捷建议按钮 (移动端优化)
// ============================================
function QuickSuggestions({ onSelect }: { onSelect: (text: string) => void }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const suggestions = useMemo(() => [
    { icon: Target, text: '推荐 AI 方向 CCF A 类会议' },
    { icon: Clock, text: '我有2个月时间，推荐合适会议' },
    { icon: BarChart3, text: '多智能体强化学习匹配度打分' },
  ], []);

  return (
    <div className="flex flex-wrap gap-1.5 md:gap-2">
      {suggestions.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.button
            key={i}
            onClick={() => onSelect(s.text)}
            className={cn(
              "px-3 py-2 min-h-[44px] bg-white rounded-full text-[11px] md:text-xs",
              "text-gray-600 border border-gray-200",
              "hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50",
              "active:bg-blue-100 active:scale-95",
              "transition-all shadow-sm inline-flex items-center gap-1.5",
              "focus:outline-none focus:ring-2 focus:ring-blue-500"
            )}
            whileHover={prefersReducedMotion ? {} : { scale: 1.02, y: -1 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
          >
            <Icon size={12} className="flex-shrink-0" />
            <span className="whitespace-nowrap">{s.text}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ============================================
// UI/UX 优化: 会议卡片 (移动端优化)
// ============================================
function ConferenceCard({ conf, index }: { conf: any; index: number }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rankColors = {
    'A': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'B': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'C': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  };
  const rankStyle = rankColors[conf.rank?.ccf as keyof typeof rankColors] || rankColors['C'];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.08, type: 'spring' as const, stiffness: 300 }}
      whileHover={prefersReducedMotion ? undefined : { y: -2, boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)' }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "bg-white p-3 md:p-3.5 rounded-xl border transition-all cursor-pointer active:bg-gray-50",
        rankStyle.border,
        "hover:border-blue-300 focus-within:border-blue-300"
      )}
      role="article"
      aria-label={`${conf.title} - CCF ${conf.rank?.ccf || 'N'}类会议`}
    >
      {/* 头部 */}
      <div className="flex justify-between items-start mb-1.5 md:mb-2">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <span className="font-bold text-gray-900 text-xs md:text-sm truncate">{conf.title}</span>
          <span className={cn(
            "text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-full flex-shrink-0",
            rankStyle.bg, rankStyle.text
          )}>
            CCF {conf.rank?.ccf || 'N'}
          </span>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-[11px] md:text-xs text-gray-500 line-clamp-2 mb-2 md:mb-2.5 leading-relaxed">
        {conf.description}
      </p>

      {/* 底部 */}
      <div className="flex justify-between items-center">
        <span className="text-[9px] md:text-[10px] px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-100 rounded-md text-gray-600 font-medium">
          {conf.sub}
        </span>
        {conf.confs?.[0]?.link && (
          <motion.a
            href={conf.confs[0].link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] md:text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mr-2"
            whileHover={prefersReducedMotion ? undefined : { x: 2 }}
          >
            查看详情
            <ExternalLink size={10} />
          </motion.a>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================
export default function ChatWidget() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `您好！我是您的 **CCF 会议智能助手** 🎓

我可以帮您：
- 🔍 **推荐会议** - 根据研究方向和等级推荐
- ⏰ **时间筛选** - 根据您的完稿时间匹配
- 📊 **匹配打分** - 计算内容匹配度和时间可行性

请问有什么可以帮您的？`,
      timestamp: Date.now()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 清理
  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  // 发送消息
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

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
        body: JSON.stringify({ message: userMsg.content }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) throw new Error('Network error');

      const data: ChatResponse = await res.json();

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: Date.now(),
        relatedConferences: data.conferences
      }]);

      if (!isOpen) setHasNewMessage(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '抱歉，发生了错误。请稍后重试。',
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, isOpen]);

  // 快捷建议选择
  const handleSuggestionSelect = useCallback((text: string) => {
    setInput(text);
  }, []);

  // 打开聊天窗口
  const handleOpenChat = useCallback(() => {
    setIsOpen(true);
    setHasNewMessage(false);
  }, []);

  return (
    <>
      {/* Tooltip - 仅桌面端显示 */}
      <AnimatePresence>
        {!isOpen && showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="hidden md:block fixed bottom-28 right-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-3 rounded-2xl shadow-xl z-[9998] max-w-[240px] text-white"
          >
            <button
              onClick={(e) => { e.stopPropagation(); setShowTooltip(false); }}
              className="absolute -top-2 -right-2 w-7 h-7 min-w-[28px] min-h-[28px] bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="关闭提示"
            >
              <X size={12} />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-yellow-300" />
              <p className="text-sm font-semibold">{t('chatTooltip')}</p>
            </div>
            <button
              onClick={handleOpenChat}
              className="w-full text-xs bg-white/20 hover:bg-white/30 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              {t('askNow')} →
            </button>
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-purple-600 transform rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button - 移动端优化 */}
      <motion.button
        className={cn(
          "fixed text-white rounded-full shadow-lg flex items-center justify-center z-[9999] transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          // 移动端：更大按钮，考虑底部安全区域
          "w-14 h-14 md:w-14 md:h-14",
          "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
          "right-4 md:right-6",
          hasNewMessage
            ? "bg-gradient-to-r from-orange-500 to-red-500"
            : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"
        )}
        onClick={() => { setIsOpen(!isOpen); setHasNewMessage(false); }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? '关闭聊天窗口' : '打开聊天窗口'}
        aria-expanded={isOpen}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>
        {/* 新消息指示器 */}
        {hasNewMessage && (
          <motion.span
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' }}
          >
            !
          </motion.span>
        )}
      </motion.button>

      {/* Chat Window - 移动端全屏，桌面端浮动 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed flex flex-col z-[9999] overflow-hidden",
              // 移动端：全屏 + 安全区域适配 + 动态视口高度
              "inset-0 md:inset-auto",
              "h-[100dvh] md:h-auto", // 动态视口高度适配移动端浏览器
              // 桌面端：浮动窗口
              "md:bottom-24 md:right-6 md:w-[440px] md:h-[75vh] md:max-h-[650px]",
              "md:rounded-3xl md:shadow-2xl md:border md:border-gray-100",
              // 移动端样式
              "bg-gradient-to-b from-gray-50 to-white md:bg-gradient-to-b",
              // 安全区域适配 (iPhone 刘海、底部横条)
              "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
              "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
            )}
          >
            {/* Header - 移动端优化 */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-3 md:p-4 flex items-center gap-3 text-white flex-shrink-0">
              <motion.div
                className="w-10 h-10 md:w-11 md:h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Bot size={22} className="md:hidden" />
                <Bot size={24} className="hidden md:block" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm md:text-base truncate">{t('chatTitle')}</h3>
                <p className="text-[10px] md:text-xs text-blue-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-400 rounded-full animate-pulse" />
                  {t('online')}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-1 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="关闭聊天窗口"
              >
                <X size={22} />
              </button>
            </div>

            {/* Messages - 移动端优化滚动区域 */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 overscroll-contain">
              {messages.map((msg, msgIndex) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-2 md:gap-2.5 max-w-[95%] md:max-w-[92%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  {/* Avatar */}
                  <motion.div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                      msg.role === 'user'
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                        : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white"
                    )}
                    whileHover={{ scale: 1.1 }}
                  >
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </motion.div>

                  {/* Bubble - 移动端优化 */}
                  <div className="flex flex-col gap-1.5 md:gap-2 max-w-[calc(100%-48px)] md:max-w-[calc(100%-52px)]">
                    <div className={cn(
                      "p-3 md:p-3.5 rounded-2xl text-sm leading-relaxed group relative",
                      msg.role === 'user'
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-md"
                        : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-md"
                    )}>
                      <MessageContent
                        content={msg.content}
                        animate={msg.role === 'assistant' && msgIndex === messages.length - 1 && !isLoading}
                      />
                      {msg.role === 'assistant' && <CopyButton text={msg.content} />}
                    </div>

                    {/* Feedback */}
                    {msg.role === 'assistant' && (
                      <FeedbackButtons messageId={msg.id} />
                    )}

                    {/* Conference Cards */}
                    {msg.relatedConferences && msg.relatedConferences.length > 0 && (
                      <div className="grid gap-2 mt-1">
                        {msg.relatedConferences.slice(0, 3).map((conf, idx) => (
                          <ConferenceCard key={idx} conf={conf} index={idx} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Loading */}
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center shadow-sm">
                    <Bot size={16} />
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-md border border-gray-100 shadow-sm">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-2 h-2 bg-blue-400 rounded-full"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions - 移动端优化 */}
            {messages.length === 1 && !isLoading && (
              <div className="px-3 md:px-4 pb-2 flex-shrink-0">
                <QuickSuggestions onSelect={handleSuggestionSelect} />
              </div>
            )}

            {/* Input - 移动端优化，键盘适配 */}
            <form onSubmit={handleSubmit} className="p-2 md:p-3 bg-white border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('chatPlaceholder')}
                  className={cn(
                    "flex-1 px-3 md:px-4 py-3 md:py-3 bg-gray-100 rounded-xl text-base md:text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all",
                    "placeholder:text-gray-400 min-h-[48px]"
                  )}
                  disabled={isLoading}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                />
                <motion.button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-12 h-12 min-w-[48px] min-h-[48px]",
                    "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl",
                    "flex items-center justify-center",
                    "disabled:opacity-40 disabled:cursor-not-allowed shadow-md",
                    "active:scale-95 transition-transform"
                  )}
                  whileHover={{ scale: input.trim() ? 1.05 : 1 }}
                  whileTap={{ scale: input.trim() ? 0.95 : 1 }}
                  aria-label="发送消息"
                >
                  <Send size={20} />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
