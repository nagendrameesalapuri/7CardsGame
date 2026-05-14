import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { supportApi } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'payment',  label: '💳 Payment / Wallet' },
  { value: 'game',     label: '🎮 Game Issue' },
  { value: 'account',  label: '👤 Account Problem' },
  { value: 'bug',      label: '🐛 Bug Report' },
  { value: 'other',    label: '💬 Other' },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  open:        { label: 'Open',        cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', dot: 'bg-yellow-400' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',       dot: 'bg-blue-400' },
  resolved:    { label: 'Resolved',    cls: 'bg-neon-green/15 text-neon-green border-neon-green/30', dot: 'bg-neon-green' },
};

const CAT_LABEL: Record<string, string> = {
  payment: '💳 Payment', game: '🎮 Game', account: '👤 Account', bug: '🐛 Bug', other: '💬 Other',
};

type Tab  = 'new' | 'tickets';
type Step = 'form' | 'done';

export function SupportModal({ isOpen, onClose }: Props) {
  const [tab, setTab]           = useState<Tab>('new');
  const [step, setStep]         = useState<Step>('form');
  const [category, setCategory] = useState('other');
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // My tickets
  const [tickets, setTickets]         = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [expanded, setExpanded]       = useState<string | null>(null);

  const loadTickets = useCallback(() => {
    setTicketsLoading(true);
    supportApi.mine()
      .then(r => setTickets(r.data.tickets))
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  }, []);

  useEffect(() => {
    if (isOpen && tab === 'tickets') loadTickets();
  }, [isOpen, tab, loadTickets]);

  const resetForm = () => {
    setStep('form');
    setCategory('other');
    setSubject('');
    setMessage('');
    setError('');
  };

  const handleClose = () => { resetForm(); setTab('new'); onClose(); };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in subject and message.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await supportApi.submit({ category, subject, message });
      setStep('done');
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchToTickets = () => {
    loadTickets();
    setTab('tickets');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            className="relative w-full max-w-md bg-dark-surface border border-dark-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎧</span>
                <h2 className="font-bold text-dark-text">Help & Support</h2>
              </div>
              <button onClick={handleClose} className="text-dark-muted hover:text-dark-text transition-colors text-lg">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-dark-border flex-shrink-0">
              <button
                onClick={() => { setTab('new'); if (step === 'done') resetForm(); }}
                className={clsx(
                  'flex-1 py-2.5 text-sm font-semibold transition-colors',
                  tab === 'new'
                    ? 'text-neon-green border-b-2 border-neon-green'
                    : 'text-dark-muted hover:text-dark-text',
                )}
              >
                ✏️ New Ticket
              </button>
              <button
                onClick={switchToTickets}
                className={clsx(
                  'flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5',
                  tab === 'tickets'
                    ? 'text-neon-green border-b-2 border-neon-green'
                    : 'text-dark-muted hover:text-dark-text',
                )}
              >
                📋 My Tickets
                {tickets.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-dark-border text-dark-muted">
                    {tickets.length}
                  </span>
                )}
              </button>
            </div>

            {/* Content — scrollable */}
            <div className="overflow-y-auto flex-1">

              {/* ── New Ticket tab ── */}
              {tab === 'new' && (
                step === 'done' ? (
                  <div className="p-6 text-center">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="font-bold text-neon-green text-lg mb-1">Ticket Submitted!</p>
                    <p className="text-dark-muted text-sm mb-5">Our team will review your issue and get back to you soon.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { resetForm(); switchToTickets(); }}
                        className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-dark-text transition-all"
                      >
                        View My Tickets
                      </button>
                      <button
                        onClick={handleClose}
                        className="flex-1 py-2.5 bg-neon-green text-dark-bg font-bold rounded-xl hover:bg-neon-green/90 transition-all text-sm"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">
                    {/* Category */}
                    <div>
                      <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase tracking-wide">Category</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-neon-green"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase tracking-wide">Subject</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        maxLength={120}
                        placeholder="Brief description of your issue"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-neon-green"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase tracking-wide">
                        Details <span className="text-dark-muted font-normal normal-case">({message.length}/2000)</span>
                      </label>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        maxLength={2000}
                        rows={5}
                        placeholder="Describe your issue in detail — include room codes, amounts, or error messages."
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-neon-green resize-none"
                      />
                    </div>

                    {error && <p className="text-neon-red text-xs">{error}</p>}

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleClose}
                        className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-dark-text transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-neon-green text-dark-bg font-bold text-sm hover:bg-neon-green/90 transition-all disabled:opacity-50"
                      >
                        {loading ? 'Submitting…' : 'Submit Ticket'}
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* ── My Tickets tab ── */}
              {tab === 'tickets' && (
                <div className="p-4 space-y-3">
                  {ticketsLoading ? (
                    <div className="text-center py-12 text-dark-muted animate-pulse text-sm">Loading your tickets…</div>
                  ) : tickets.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-3xl mb-2">🎧</p>
                      <p className="text-dark-muted text-sm mb-4">No support tickets yet</p>
                      <button
                        onClick={() => setTab('new')}
                        className="px-4 py-2 bg-neon-green text-dark-bg font-bold text-sm rounded-xl hover:bg-neon-green/90 transition-all"
                      >
                        Submit your first ticket
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-dark-muted">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
                        <button onClick={loadTickets} className="text-xs text-dark-muted hover:text-dark-text transition-colors">
                          ⟳ Refresh
                        </button>
                      </div>

                      {tickets.map((t: any) => {
                        const st = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open;
                        const isExp = expanded === t._id;
                        const hasReply = !!t.adminReply?.trim();

                        return (
                          <div
                            key={t._id}
                            className="bg-dark-bg border border-dark-border rounded-xl overflow-hidden"
                          >
                            {/* Ticket row */}
                            <button
                              className="w-full text-left p-3 hover:bg-white/[0.02] transition-colors"
                              onClick={() => setExpanded(isExp ? null : t._id)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', st.cls)}>
                                      <span className={clsx('w-1.5 h-1.5 rounded-full', st.dot)} />
                                      {st.label}
                                    </span>
                                    <span className="text-[10px] text-dark-muted bg-white/5 px-1.5 py-0.5 rounded-full">
                                      {CAT_LABEL[t.category] ?? t.category}
                                    </span>
                                    {hasReply && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        💬 Reply
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-semibold text-dark-text truncate">{t.subject}</p>
                                  <p className="text-[10px] text-dark-muted mt-0.5">
                                    {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                                <span className="text-dark-muted text-xs flex-shrink-0 mt-1">{isExp ? '▲' : '▼'}</span>
                              </div>
                            </button>

                            {/* Expanded detail */}
                            {isExp && (
                              <div className="border-t border-dark-border px-3 pb-3 pt-3 space-y-3">
                                {/* Your message */}
                                <div>
                                  <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wide mb-1">Your Message</p>
                                  <p className="text-xs text-dark-text whitespace-pre-wrap bg-dark-surface rounded-lg p-2.5">{t.message}</p>
                                </div>

                                {/* Admin reply */}
                                {hasReply ? (
                                  <div>
                                    <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide mb-1">Support Reply</p>
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2.5">
                                      <p className="text-xs text-dark-text whitespace-pre-wrap">{t.adminReply}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-dark-muted bg-dark-surface rounded-lg p-2.5">
                                    <span className="animate-pulse">🕐</span>
                                    <span>Waiting for a support reply…</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
