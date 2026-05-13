import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuthStore } from '../store/authStore';
import { walletApi } from '../services/api';
import { on } from '../services/socket';
import { Layout } from '../components/layout/Layout';
import { WalletTransaction } from '@shared/types';
import toast from 'react-hot-toast';

// Razorpay window type
declare global {
  interface Window {
    Razorpay: any;
  }
}

const PRESET_AMOUNTS = [50, 100, 500, 1000];

const TX_ICONS: Record<string, string> = {
  deposit: '⬇️',
  withdrawal: '⬆️',
  winning: '🏆',
  entry_fee: '🎮',
  refund: '↩️',
};

const TX_COLORS: Record<string, string> = {
  deposit: 'text-green-400',
  winning: 'text-yellow-400',
  refund: 'text-blue-400',
  withdrawal: 'text-red-400',
  entry_fee: 'text-red-400',
};

const STATUS_PILL: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  pending:   'bg-yellow-500/20 text-yellow-300',
  failed:    'bg-red-500/20 text-red-400',
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ── Add Money Modal ──────────────────────────────────────────────────────────

function AddMoneyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (balance: number) => void }) {
  const [amount, setAmount] = useState(100);
  const [customText, setCustomText] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState(false);

  const finalAmount = useCustom ? (parseInt(customText) || 0) : amount;
  const isDev = import.meta.env.DEV;

  const handleDevAdd = async () => {
    if (finalAmount < 1) return toast.error('Enter a valid amount');
    setLoading(true);
    try {
      const { data } = await walletApi.devAdd(finalAmount);
      toast.success(data.message);
      onSuccess(data.balance);
      onClose();
    } catch {
      toast.error('Failed to add test money');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (finalAmount < 1) return toast.error('Enter a valid amount');
    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) return toast.error('Payment gateway failed to load');

      const { data } = await walletApi.createOrder(finalAmount);

      const options = {
        key: data.keyId,
        amount: finalAmount * 100,
        currency: 'INR',
        name: '7 Cards Show',
        description: 'Add Wallet Balance',
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            const verify = await walletApi.verifyDeposit({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: finalAmount,
            });
            toast.success(verify.data.message);
            onSuccess(verify.data.balance);
            onClose();
          } catch {
            toast.error('Payment verification failed');
          }
        },
        prefill: {},
        theme: { color: '#00ff88' },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => { toast.error('Payment failed'); setLoading(false); });
      rzp.open();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to initiate payment';
      // If gateway not configured, show dev fallback
      if (err?.response?.data?.error?.includes('not configured') || err?.response?.status === 503) {
        setGatewayError(true);
      } else {
        toast.error(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="relative w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: 'rgba(12,14,18,0.97)', border: '1px solid rgba(0,255,136,0.15)' }}
      >
        <h2 className="text-xl font-bold text-dark-text">Add Money</h2>

        <div className="grid grid-cols-4 gap-2">
          {PRESET_AMOUNTS.map(p => (
            <button
              key={p}
              onClick={() => { setAmount(p); setUseCustom(false); }}
              className={clsx(
                'rounded-xl py-2.5 text-sm font-bold transition-all',
                !useCustom && amount === p
                  ? 'bg-neon-green text-dark-bg'
                  : 'bg-dark-surface border border-dark-border text-dark-text hover:border-neon-green'
              )}
            >
              ₹{p}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-dark-muted block mb-1">Custom Amount</label>
          <input
            type="number"
            placeholder="Enter amount"
            value={customText}
            onChange={e => { setCustomText(e.target.value); setUseCustom(true); }}
            onFocus={() => setUseCustom(true)}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-neon-green"
          />
        </div>

        {/* Dev mode fallback when Razorpay not configured */}
        {(gatewayError || isDev) && (
          <div className="rounded-lg px-3 py-2 bg-yellow-500/10 border border-yellow-500/25 text-yellow-300 text-xs flex items-center gap-2">
            <span>🛠️</span>
            <span>Dev mode — Razorpay not configured. Use "Add Test Money" below.</span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-dark-text transition-colors">
            Cancel
          </button>
          {(gatewayError || isDev) ? (
            <button
              onClick={handleDevAdd}
              disabled={loading || finalAmount < 1}
              className="flex-1 py-2.5 rounded-xl bg-yellow-400 text-dark-bg font-bold text-sm disabled:opacity-50 hover:bg-yellow-300 transition-colors"
            >
              {loading ? 'Adding…' : `Add Test ₹${finalAmount}`}
            </button>
          ) : (
            <button
              onClick={handlePay}
              disabled={loading || finalAmount < 1}
              className="flex-1 py-2.5 rounded-xl bg-neon-green text-dark-bg font-bold text-sm disabled:opacity-50 hover:bg-green-400 transition-colors"
            >
              {loading ? 'Processing…' : `Pay ₹${finalAmount}`}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Withdraw Modal ────────────────────────────────────────────────────────────

function WithdrawModal({ balance, onClose, onSuccess }: { balance: number; onClose: () => void; onSuccess: (balance: number) => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState({ accountNumber: '', ifsc: '', accountName: '' });
  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    const amt = parseInt(amount);
    if (!amt || amt < 10) return toast.error('Minimum withdrawal ₹10');
    if (amt > balance) return toast.error('Insufficient balance');
    if (method === 'upi' && !upiId.trim()) return toast.error('Enter UPI ID');
    if (method === 'bank' && (!bank.accountNumber || !bank.ifsc || !bank.accountName)) {
      return toast.error('Fill all bank details');
    }

    setLoading(true);
    try {
      const { data } = await walletApi.withdraw({
        amount: amt,
        ...(method === 'upi' ? { upiId: upiId.trim() } : { bankDetails: bank }),
      });
      toast.success(data.message);
      onSuccess(data.balance);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="relative w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'rgba(12,14,18,0.97)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h2 className="text-xl font-bold text-dark-text">Withdraw Money</h2>
        <p className="text-xs text-dark-muted">Available: <span className="text-neon-green font-bold">₹{balance}</span></p>

        <div>
          <label className="text-xs text-dark-muted block mb-1">Amount (₹)</label>
          <input
            type="number"
            placeholder="e.g. 500"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-neon-green"
          />
        </div>

        {/* Method toggle */}
        <div className="flex gap-2">
          {(['upi', 'bank'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                method === m ? 'bg-neon-green text-dark-bg' : 'bg-dark-surface border border-dark-border text-dark-muted'
              )}
            >
              {m === 'upi' ? 'UPI' : 'Bank Transfer'}
            </button>
          ))}
        </div>

        {method === 'upi' ? (
          <div>
            <label className="text-xs text-dark-muted block mb-1">UPI ID</label>
            <input value={upiId} onChange={e => setUpiId(e.target.value)}
              placeholder="name@upi"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-neon-green"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <input value={bank.accountName} onChange={e => setBank(b => ({ ...b, accountName: e.target.value }))}
              placeholder="Account holder name"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
            />
            <input value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))}
              placeholder="Account number"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
            />
            <input value={bank.ifsc} onChange={e => setBank(b => ({ ...b, ifsc: e.target.value.toUpperCase() }))}
              placeholder="IFSC code"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
            />
          </div>
        )}

        <p className="text-xs text-dark-muted">Withdrawals are processed within 24–48 hours.</p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-dark-text transition-colors">
            Cancel
          </button>
          <button
            onClick={handleWithdraw}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-neon-green text-dark-bg font-bold text-sm disabled:opacity-50 hover:bg-green-400 transition-colors"
          >
            {loading ? 'Processing…' : 'Withdraw'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main WalletPage ───────────────────────────────────────────────────────────

export function WalletPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [isGuest, setIsGuest] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await walletApi.get();
      setBalance(data.balance);
      setIsGuest(data.isGuest);
      setTransactions(data.transactions);
      setWithdrawalRequests(data.withdrawalRequests ?? []);
    } catch {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }
    load();

    // Live prize notification
    const unsub = on('wallet:prize_won', (data: { amount: number; balance: number }) => {
      toast.success(`You won ₹${data.amount}!`, { duration: 6000 });
      setBalance(data.balance);
      load();
    });
    return () => unsub();
  }, [isAuthenticated, navigate, load]);

  const isDebit = (type: string) => type === 'withdrawal' || type === 'entry_fee';

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="text-dark-muted animate-pulse text-sm">Loading wallet…</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Balance Card */}
          <div
            className="relative rounded-3xl p-6 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,136,0.12) 0%, rgba(0,150,255,0.08) 100%)',
              border: '1px solid rgba(0,255,136,0.25)',
            }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, #00ff88, transparent)', transform: 'translate(30%, -30%)' }} />
            <p className="text-xs text-dark-muted uppercase tracking-wider mb-1">Wallet Balance</p>
            <p className="text-5xl font-bold text-dark-text mb-1">
              <span className="text-neon-green">₹</span>{balance.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-dark-muted">{user?.username}</p>

            {isGuest && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
                Guest accounts cannot add or withdraw money. Sign in to use the wallet.
              </div>
            )}
          </div>

          {/* Actions */}
          {!isGuest && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAdd(true)}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl font-bold transition-all"
                style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)' }}
              >
                <span className="text-2xl">⬇️</span>
                <span className="text-neon-green text-sm">Add Money</span>
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                disabled={balance <= 0}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl font-bold transition-all disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-2xl">⬆️</span>
                <span className="text-dark-text text-sm">Withdraw</span>
              </button>
            </div>
          )}

          {/* Withdrawal Requests */}
          {withdrawalRequests.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-dark-muted uppercase tracking-wider mb-3">Withdrawal Requests</h2>
              <div className="space-y-2">
                {withdrawalRequests.map((wr: any) => {
                  const statusConfig = {
                    pending:  { label: 'Pending Review', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
                    approved: { label: 'Approved ✓',     cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
                    rejected: { label: 'Rejected ✗',     cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
                  }[wr.status as string] ?? { label: wr.status, cls: 'bg-dark-border text-dark-muted border-dark-border' };

                  return (
                    <div
                      key={wr._id}
                      className="px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">⬆️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-dark-text font-medium">Withdrawal of ₹{wr.amount}</p>
                          <p className="text-xs text-dark-muted">
                            {wr.upiId ? `UPI: ${wr.upiId}` : `Bank: ${wr.bankDetails?.accountName}`}
                            {' · '}
                            {new Date(wr.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-red-400">-₹{wr.amount}</p>
                          <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-medium', statusConfig.cls)}>
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>
                      {wr.adminNote && (
                        <p className="mt-2 text-xs text-dark-muted pl-9 italic">Note: {wr.adminNote}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div>
            <h2 className="text-sm font-bold text-dark-muted uppercase tracking-wider mb-3">Transaction History</h2>
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-dark-muted text-sm">No transactions yet</div>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div
                    key={tx._id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-xl">{TX_ICONS[tx.type] ?? '💳'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-text truncate">{tx.description}</p>
                      <p className="text-xs text-dark-muted">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={clsx('text-sm font-bold', TX_COLORS[tx.type] ?? 'text-dark-text')}>
                        {isDebit(tx.type) ? '-' : '+'}₹{tx.amount}
                      </p>
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', STATUS_PILL[tx.status] ?? 'bg-dark-border text-dark-muted')}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showAdd && <AddMoneyModal onClose={() => setShowAdd(false)} onSuccess={b => { setBalance(b); load(); }} />}
        {showWithdraw && <WithdrawModal balance={balance} onClose={() => setShowWithdraw(false)} onSuccess={b => { setBalance(b); load(); }} />}
      </AnimatePresence>
    </Layout>
  );
}
