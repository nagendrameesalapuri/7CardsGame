import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ChatMessage } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { Avatar } from '../ui/Avatar';

const REACTIONS = ['👏', '🎉', '😂', '😱', '🔥', '💀', '🤯', '😎', '👀', '🙏'];

interface ChatPanelProps {
  messages: ChatMessage[];
  className?: string;
}

export function ChatPanel({ messages, className }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { sendChat, sendReaction } = useGameStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChat(input.trim());
    setInput('');
  };

  return (
    <div className={clsx('relative', className)}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-muted hover:text-dark-text transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-xs">Chat</span>
        {messages.length > 0 && (
          <span className="bg-neon-blue text-dark-bg text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {Math.min(messages.length, 9)}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute top-full mt-2 right-0 w-72 bg-dark-surface border border-dark-border rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {/* Messages */}
            <div className="h-48 overflow-y-auto p-3 space-y-2 scrollbar-thin">
              {messages.length === 0 && (
                <p className="text-dark-muted text-xs text-center pt-8">No messages yet</p>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={clsx('flex gap-2', msg.type === 'system' && 'justify-center')}>
                  {msg.type === 'system' ? (
                    <span className="text-xs text-dark-muted italic">{msg.message}</span>
                  ) : msg.type === 'reaction' ? (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-dark-muted text-xs">{msg.username}:</span>
                      <span className="text-xl">{msg.message}</span>
                    </div>
                  ) : (
                    <>
                      <Avatar avatar={msg.avatar} size="xs" />
                      <div>
                        <span className="text-xs text-neon-blue font-medium">{msg.username}: </span>
                        <span className="text-xs text-dark-text">{msg.message}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reactions */}
            <div className="px-3 py-2 border-t border-dark-border flex gap-1 flex-wrap">
              {REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="text-xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-2 border-t border-dark-border flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-xs text-dark-text placeholder-dark-muted focus:outline-none focus:border-neon-blue"
              />
              <button
                onClick={handleSend}
                className="px-3 py-1.5 bg-neon-blue text-dark-bg rounded-lg text-xs font-bold hover:bg-blue-400 transition-colors"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
