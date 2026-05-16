import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  size?: 'sm' | 'lg';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type AnnotatedMsg = ChatMessage & { isFirst: boolean; isLast: boolean };

export function ChatPanel({ messages, playerCount = 2, size = 'sm' }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lastReadCount, setLastReadCount] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  // Track keyboard height so the panel lifts above the soft keyboard on Android
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const { sendChat, sendReaction } = useGameStore();
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  // VisualViewport listener — detects soft keyboard on Android/mobile
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const myPlayerId = user?.id;
  const unreadCount = isOpen ? 0 : Math.max(0, messages.length - lastReadCount);

  // Auto-scroll when new messages arrive while open
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const open = () => {
    setIsOpen(true);
    setLastReadCount(messages.length);
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      inputRef.current?.focus();
    }, 300);
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
    const x = 10 + Math.random() * 70;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 1600);
  };

  const annotated: AnnotatedMsg[] = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    return {
      ...msg,
      isFirst: !prev || prev.playerId !== msg.playerId || prev.type !== msg.type,
      isLast: !next || next.playerId !== msg.playerId || next.type !== msg.type,
    };
  });

  // ── Toggle button (stays in top bar, no stacking-context issues) ──────────
  const toggleBtn = size === 'lg' ? (
    <button
      onClick={open}
      className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.09)',
        border: '1px solid rgba(255,255,255,0.13)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {unreadCount > 0 && (
        <span
          className="absolute top-0 right-0 w-2 h-2 rounded-full"
          style={{ background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.9)' }}
        />
      )}
      <svg className="w-5 h-5 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center"
            style={{ background: '#ff3b5c', boxShadow: '0 0 8px rgba(255,59,92,0.7)' }}
          >
            {Math.min(unreadCount, 9)}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  ) : (
    <button
      onClick={open}
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-neon-green flex-shrink-0"
        style={{ boxShadow: '0 0 6px rgba(0,255,136,0.9)' }}
      />
      <svg className="w-3.5 h-3.5 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
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
  );

  // ── Floating panel rendered via Portal to escape all stacking contexts ────
  const panel = createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="chat-panel"
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 38, mass: 0.85 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.55 }}
          onDragEnd={(_, info) => { if (info.offset.y > 80) close(); }}
          className="flex flex-col"
          style={{
            position: 'fixed',
            bottom: 16 + keyboardOffset,
            right: 12,
            width: 'min(calc(100vw - 24px), 360px)',
            // Shrink height when keyboard is visible so panel stays on screen
            height: keyboardOffset > 0
              ? `min(calc(100dvh - ${keyboardOffset + 32}px), 480px)`
              : 'clamp(360px, 65dvh, 520px)',
            zIndex: 9999,
            background: 'rgba(8,9,14,0.94)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderRadius: 20,
            border: '1px solid rgba(0,255,136,0.13)',
            boxShadow: '0 8px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04), 0 -2px 40px rgba(0,255,136,0.06)',
          }}
        >
          {/* Top glow line */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.4), transparent)', borderRadius: 99 }}
          />

          {/* Floating reaction bursts */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[20px]" style={{ zIndex: 1 }}>
            <AnimatePresence>
              {floatingReactions.map(r => (
                <motion.div
                  key={r.id}
                  initial={{ y: '85%', opacity: 1, scale: 0.7 }}
                  animate={{ y: '0%', opacity: 0, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute text-2xl leading-none select-none"
                  style={{ left: `${r.x}%` }}
                >
                  {r.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* ── Drag handle ──────────────────────────────────────────── */}
          <div
            className="flex justify-center pt-3 pb-1.5 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={e => dragControls.start(e)}
          >
            <div className="w-8 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          {/* ── Header ───────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-4 pb-2.5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <span className="block w-2 h-2 rounded-full bg-neon-green"
                  style={{ boxShadow: '0 0 7px rgba(0,255,136,0.9)' }} />
                <span className="absolute inset-0 w-2 h-2 rounded-full bg-neon-green animate-ping opacity-50" />
              </div>
              <span className="font-bold text-white text-sm tracking-wide">Live Chat</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.07)' }}
              >
                {playerCount} online
              </span>
            </div>
            <button
              onClick={close}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
            >
              ✕
            </button>
          </div>

          {/* ── Quick reactions ───────────────────────────────────────── */}
          <div
            className="flex items-center gap-0.5 px-3 py-1.5 flex-shrink-0 overflow-x-auto"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', scrollbarWidth: 'none' }}
          >
            {QUICK_REACTIONS.map(emoji => (
              <motion.button
                key={emoji}
                whileTap={{ scale: 1.5 }}
                onClick={() => handleReaction(emoji)}
                className="text-lg w-9 h-8 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
                style={{ background: 'transparent' }}
              >
                {emoji}
              </motion.button>
            ))}
          </div>

          {/* ── Messages ─────────────────────────────────────────────── */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 overscroll-contain"
            style={{ scrollbarWidth: 'none' }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="text-4xl opacity-30">💬</span>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
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
                    <span
                      className="text-[10px] italic px-3 py-1 rounded-full"
                      style={{ color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.05)' }}
                    >
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
                    className="flex justify-center py-0.5"
                  >
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      <span style={{ color: '#00ff88' }}>{isMe ? 'You' : msg.username}</span>
                      {' '}reacted {msg.message}
                    </span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: isMe ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16 }}
                  className={clsx(
                    'flex flex-col',
                    isMe ? 'items-end' : 'items-start',
                    msg.isFirst ? 'mt-3' : 'mt-0.5',
                  )}
                >
                  {msg.isFirst && (
                    <span
                      className="text-[10px] mb-1 px-1"
                      style={{ color: isMe ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.28)' }}
                    >
                      {isMe ? 'You' : msg.username} · {formatTime(msg.timestamp)}
                    </span>
                  )}
                  <div
                    className="max-w-[82%] px-3.5 py-2 text-sm leading-snug break-words"
                    style={isMe
                      ? {
                          background: '#00e87a',
                          color: '#071a0e',
                          fontWeight: 500,
                          borderRadius: msg.isFirst && msg.isLast ? '18px 18px 5px 18px'
                            : msg.isFirst ? '18px 18px 5px 18px'
                            : msg.isLast ? '18px 18px 5px 18px'
                            : '18px 5px 5px 18px',
                          boxShadow: '0 2px 12px rgba(0,232,122,0.2)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.09)',
                          color: 'rgba(255,255,255,0.92)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: msg.isFirst && msg.isLast ? '18px 18px 18px 5px'
                            : msg.isFirst ? '18px 18px 18px 5px'
                            : msg.isLast ? '5px 18px 18px 5px'
                            : '5px 18px 18px 5px',
                        }
                    }
                  >
                    {msg.message}
                  </div>
                </motion.div>
              );
            })}
            <div ref={bottomRef} className="h-1" />
          </div>

          {/* ── Input bar ────────────────────────────────────────────── */}
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
              className="flex-1 text-white placeholder:text-white/25 focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 14,
                padding: '9px 14px',
                fontSize: 15,
              }}
              onFocus={e => {
                e.currentTarget.style.border = '1px solid rgba(0,255,136,0.38)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 400);
              }}
              onBlur={e => {
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              }}
            />
            <motion.button
              whileTap={{ scale: 0.87 }}
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: input.trim() ? '#00e87a' : 'rgba(255,255,255,0.07)',
                boxShadow: input.trim() ? '0 0 16px rgba(0,232,122,0.45)' : 'none',
                color: input.trim() ? '#071a0e' : 'rgba(255,255,255,0.2)',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      {toggleBtn}
      {panel}
    </>
  );
}
