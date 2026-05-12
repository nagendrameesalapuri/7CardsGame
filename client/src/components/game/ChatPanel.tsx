import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { clsx } from 'clsx';
import { ChatMessage } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';

const QUICK_REACTIONS = ['🔥', '😱', '😂', '👏', '💀', '🎉', '😤'];

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  playerCount?: number;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({ messages, playerCount = 2 }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lastReadCount, setLastReadCount] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const { sendChat, sendReaction } = useGameStore();
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  const myPlayerId = user?.id;
  const unreadCount = isOpen ? 0 : Math.max(0, messages.length - lastReadCount);

  useEffect(() => {
    if (isOpen) {
      setLastReadCount(messages.length);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Count unread while closed
    }
  }, [messages]);

  const open = () => {
    setIsOpen(true);
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      inputRef.current?.focus();
    }, 320);
  };

  const close = () => {
    setLastReadCount(messages.length);
    setIsOpen(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendChat(input.trim());
    setInput('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleReaction = (emoji: string) => {
    sendReaction(emoji);
    const id = `${Date.now()}-${Math.random()}`;
    const x = 15 + Math.random() * 65;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 1600);
  };

  // Annotate each message with isFirst/isLast within same-sender runs
  type AnnotatedMsg = ChatMessage & { isFirst: boolean; isLast: boolean };
  const annotated: AnnotatedMsg[] = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const samePrev = prev && prev.playerId === msg.playerId && prev.type === msg.type;
    const sameNext = next && next.playerId === msg.playerId && next.type === msg.type;
    return { ...msg, isFirst: !samePrev, isLast: !sameNext };
  });

  return (
    <>
      {/* ── Toggle FAB in top bar ─────────────────────────────────────────── */}
      <button
        onClick={open}
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-xl transition-all active:scale-95"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-neon-green flex-shrink-0"
          style={{ boxShadow: '0 0 6px rgba(0,255,136,0.9)' }} />
        <svg className="w-3.5 h-3.5 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-dark-muted text-[11px] font-medium hidden xs:inline">Chat</span>
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1.5 -right-1.5 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center"
              style={{ background: '#ff3b5c', boxShadow: '0 0 8px rgba(255,59,92,0.7)' }}
            >
              {Math.min(unreadCount, 9)}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            />

            {/* Floating panel */}
            <motion.div
              key="chat-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 38, mass: 0.9 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.5 }}
              onDragEnd={(_, info) => { if (info.offset.y > 90) close(); }}
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col select-none"
              style={{
                height: 'clamp(380px, 68dvh, 580px)',
                background: 'rgba(8,9,14,0.93)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                borderRadius: '24px 24px 0 0',
                border: '1px solid rgba(0,255,136,0.10)',
                borderBottom: 'none',
                boxShadow: '0 -4px 60px rgba(0,255,136,0.07), 0 -1px 0 rgba(255,255,255,0.04), 0 -20px 80px rgba(0,0,0,0.9)',
              }}
            >
              {/* Green gradient glow at top edge */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.35), transparent)' }} />

              {/* Floating reaction burst animations */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-t-3xl" style={{ zIndex: 1 }}>
                <AnimatePresence>
                  {floatingReactions.map(r => (
                    <motion.div
                      key={r.id}
                      initial={{ y: '80%', opacity: 1, scale: 0.7 }}
                      animate={{ y: '-5%', opacity: 0, scale: 1.5 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute text-2xl leading-none"
                      style={{ left: `${r.x}%` }}
                    >
                      {r.emoji}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* ── Drag handle ────────────────────────────────────────── */}
              <div
                className="flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={e => dragControls.start(e)}
              >
                <div className="w-9 h-[3px] rounded-full"
                  style={{ background: 'rgba(255,255,255,0.18)' }} />
              </div>

              {/* ── Header ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 pb-2.5 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <span className="block w-2 h-2 rounded-full bg-neon-green"
                      style={{ boxShadow: '0 0 8px rgba(0,255,136,0.9)' }} />
                    <span className="absolute inset-0 w-2 h-2 rounded-full bg-neon-green animate-ping opacity-60" />
                  </div>
                  <span className="font-bold text-white text-sm tracking-wide">Live Chat</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}>
                    {playerCount} online
                  </span>
                </div>
                <button
                  onClick={close}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                >
                  ✕
                </button>
              </div>

              {/* ── Quick reactions strip ──────────────────────────────── */}
              <div className="flex items-center gap-0.5 px-3 py-2 flex-shrink-0 overflow-x-auto no-scrollbar"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {QUICK_REACTIONS.map(emoji => (
                  <motion.button
                    key={emoji}
                    whileTap={{ scale: 1.5 }}
                    onClick={() => handleReaction(emoji)}
                    className="text-lg w-9 h-8 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              {/* ── Messages ───────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 overscroll-contain"
                style={{ scrollbarWidth: 'none' }}>
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <span className="text-4xl opacity-40">💬</span>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      No messages yet — say hi!
                    </p>
                  </div>
                )}

                {annotated.map((msg) => {
                  const isMe = msg.playerId === myPlayerId;

                  if (msg.type === 'system') {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-center py-2"
                      >
                        <span className="text-[10px] italic px-3 py-1 rounded-full"
                          style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}>
                          {msg.message}
                        </span>
                      </motion.div>
                    );
                  }

                  if (msg.type === 'reaction') {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex justify-center py-1"
                      >
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          <span style={{ color: '#00ff88' }}>{isMe ? 'You' : msg.username}</span>
                          {' '}reacted {msg.message}
                        </span>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: isMe ? 14 : -14, y: 4 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className={clsx(
                        'flex flex-col',
                        isMe ? 'items-end' : 'items-start',
                        msg.isFirst ? 'mt-2.5' : 'mt-0.5',
                      )}
                    >
                      {msg.isFirst && (
                        <span className={clsx('text-[10px] mb-1 px-1', isMe ? 'text-right' : 'text-left')}
                          style={{ color: isMe ? 'rgba(0,255,136,0.55)' : 'rgba(255,255,255,0.3)' }}>
                          {isMe ? 'You' : msg.username}
                          {' · '}{formatTime(msg.timestamp)}
                        </span>
                      )}
                      <div
                        className={clsx(
                          'max-w-[78%] px-3.5 py-2 text-sm leading-relaxed',
                          isMe
                            ? [
                                'font-medium text-dark-bg',
                                msg.isFirst && msg.isLast ? 'rounded-2xl rounded-br-sm' : '',
                                msg.isFirst && !msg.isLast ? 'rounded-2xl rounded-br-md' : '',
                                !msg.isFirst && msg.isLast ? 'rounded-2xl rounded-tr-md rounded-br-sm' : '',
                                !msg.isFirst && !msg.isLast ? 'rounded-2xl rounded-r-md' : '',
                              ]
                            : [
                                'text-white',
                                msg.isFirst && msg.isLast ? 'rounded-2xl rounded-bl-sm' : '',
                                msg.isFirst && !msg.isLast ? 'rounded-2xl rounded-bl-md' : '',
                                !msg.isFirst && msg.isLast ? 'rounded-2xl rounded-tl-md rounded-bl-sm' : '',
                                !msg.isFirst && !msg.isLast ? 'rounded-2xl rounded-l-md' : '',
                              ],
                        )}
                        style={isMe
                          ? { background: '#00ff88', boxShadow: '0 2px 12px rgba(0,255,136,0.25)' }
                          : { background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.06)' }
                        }
                      >
                        {msg.message}
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={bottomRef} className="h-1" />
              </div>

              {/* ── Input bar ──────────────────────────────────────────── */}
              <div
                className="px-3 pt-2 flex-shrink-0 flex items-center gap-2"
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Say something…"
                  maxLength={200}
                  autoComplete="off"
                  className="flex-1 text-white placeholder-dark-muted focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 16,
                    padding: '10px 16px',
                    fontSize: 15,
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = '1px solid rgba(0,255,136,0.4)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
                    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 350);
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: input.trim() ? '#00ff88' : 'rgba(255,255,255,0.07)',
                    boxShadow: input.trim() ? '0 0 16px rgba(0,255,136,0.45)' : 'none',
                    color: input.trim() ? '#0a0f0a' : 'rgba(255,255,255,0.25)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
