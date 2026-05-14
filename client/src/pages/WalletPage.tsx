import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import QRCode from "react-qr-code";
import { useAuthStore } from "../store/authStore";
import { walletApi, configApi } from "../services/api";
import { on } from "../services/socket";
import { Layout } from "../components/layout/Layout";
import { WalletTransaction, AdminWalletConfig } from "@shared/types";
import toast from "react-hot-toast";

const PRESET_AMOUNTS = [50, 100, 200, 500];

const TX_ICONS: Record<string, string> = {
  deposit: "⬇️",
  withdrawal: "⬆️",
  winning: "🏆",
  entry_fee: "🎮",
  refund: "↩️",
};

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  winning: "Prize Won",
  entry_fee: "Entry Fee",
  refund: "Refund",
};

const TX_COLORS: Record<string, string> = {
  deposit: "text-green-400",
  winning: "text-yellow-400",
  refund: "text-blue-400",
  withdrawal: "text-red-400",
  entry_fee: "text-red-400",
};

const STATUS_PILL: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400",
  pending: "bg-yellow-500/20 text-yellow-300",
  failed: "bg-red-500/20 text-red-400",
};

// ── Add Money Modal (QR + UTR) ───────────────────────────────────────────────

function AddMoneyModal({
  onClose,
  onSuccess,
  walletConfig,
}: {
  onClose: () => void;
  onSuccess: () => void;
  walletConfig: AdminWalletConfig;
}) {
  const [step, setStep] = useState<"pay" | "utr">("pay");
  const [amount, setAmount] = useState(100);
  const [customAmt, setCustomAmt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [utr, setUtr] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDev = import.meta.env.DEV;

  const finalAmount = useCustom ? parseInt(customAmt) || 0 : amount;
  const upiLink = `upi://pay?pa=${walletConfig.upiId}&pn=${encodeURIComponent(walletConfig.upiName)}&am=${finalAmount}&cu=INR`;

  const copyUpi = () => {
    navigator.clipboard.writeText(walletConfig.upiId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDevAdd = async () => {
    if (finalAmount < 1) return toast.error("Enter a valid amount");
    setLoading(true);
    try {
      const { data } = await walletApi.devAdd(finalAmount);
      toast.success(data.message);
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to add test money");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUTR = async () => {
    if (finalAmount < 10) return toast.error("Minimum deposit is ₹10");
    if (!utr.trim() || utr.trim().length < 6)
      return toast.error("Enter a valid UTR number");
    setLoading(true);
    try {
      const { data } = await walletApi.requestDeposit(finalAmount, utr.trim());
      toast.success(data.message, { duration: 5000 });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "rgba(12,14,18,0.98)",
          border: "1px solid rgba(0,255,136,0.2)",
        }}
      >
        {/* Step tabs */}
        <div
          className="flex"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {(["pay", "utr"] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className="flex-1 py-3 text-xs font-semibold transition-all"
              style={
                step === s
                  ? { color: "#00ff88", borderBottom: "2px solid #00ff88" }
                  : { color: "#4b5563" }
              }
            >
              {i + 1}. {s === "pay" ? "Scan & Pay" : "Enter UTR"}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {step === "pay" ? (
            <>
              <p className="text-sm text-dark-muted text-center">
                Choose amount, then scan QR with any UPI app
              </p>

              {/* Amount presets */}
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setAmount(p);
                      setUseCustom(false);
                    }}
                    className={clsx(
                      "rounded-xl py-2.5 text-sm font-bold transition-all",
                      !useCustom && amount === p
                        ? "bg-neon-green text-dark-bg"
                        : "bg-dark-surface border border-dark-border text-dark-text hover:border-neon-green",
                    )}
                  >
                    ₹{p}
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="Custom amount"
                value={customAmt}
                onChange={(e) => {
                  setCustomAmt(e.target.value);
                  setUseCustom(true);
                }}
                onFocus={() => setUseCustom(true)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-dark-text text-sm focus:outline-none focus:border-neon-green"
              />

              {/* QR Code - Only show if enabled */}
              {walletConfig.qrEnabled && (
                <div className="flex flex-col items-center gap-3 py-1">
                  <div className="p-3 bg-white rounded-2xl shadow-lg">
                    {walletConfig.qrCodeUrl ? (
                      <img
                        src={walletConfig.qrCodeUrl}
                        alt="UPI QR Code"
                        className="w-[164px] h-[164px] rounded-lg"
                      />
                    ) : (
                      <QRCode value={upiLink} size={164} />
                    )}
                  </div>
                  <p className="text-xs text-dark-muted">
                    Scan with GPay · PhonePe · Paytm · BHIM
                  </p>
                </div>
              )}

              {/* UPI ID copy row - Only show if QR enabled */}
              {walletConfig.qrEnabled && (
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer active:scale-98 transition-transform"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onClick={copyUpi}
                >
                  <div>
                    <p className="text-[10px] text-dark-muted uppercase tracking-wider">
                      UPI ID
                    </p>
                    <p className="text-sm font-mono text-white">
                      {walletConfig.upiId}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: copied ? "#00ff88" : "#8b949e" }}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </span>
                </div>
              )}

              {isDev && (
                <button
                  onClick={handleDevAdd}
                  disabled={loading || finalAmount < 1}
                  className="w-full py-2.5 rounded-xl bg-yellow-400 text-dark-bg font-bold text-sm disabled:opacity-50"
                >
                  {loading ? "Adding…" : `[DEV] Add ₹${finalAmount} Test Money`}
                </button>
              )}

              <button
                onClick={() => setStep("utr")}
                disabled={finalAmount < 10 || !walletConfig.qrEnabled}
                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #00ff88, #00cc6a)",
                  color: "#0d1117",
                }}
              >
                I've Paid ₹{finalAmount} →
              </button>
            </>
          ) : (
            <>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-white">
                  Enter UTR / Transaction ID
                </p>
                <p className="text-xs text-dark-muted">
                  Find it in your UPI app under payment history
                </p>
              </div>

              <div
                className="rounded-xl p-3 text-center text-sm font-bold text-neon-green"
                style={{
                  background: "rgba(0,255,136,0.06)",
                  border: "1px solid rgba(0,255,136,0.15)",
                }}
              >
                Amount: ₹{finalAmount}
              </div>

              <div>
                <label className="text-xs text-dark-muted block mb-1.5">
                  UTR / Reference Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 424512345678"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  autoFocus
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-3 text-dark-text font-mono text-sm focus:outline-none focus:border-neon-green"
                />
              </div>

              <div
                className="rounded-xl p-3 text-xs text-dark-muted space-y-1"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="font-semibold text-dark-text">
                  Where to find UTR?
                </p>
                <p>• GPay → Payment details → Transaction ID</p>
                <p>• PhonePe → History → tap payment → UTR No.</p>
                <p>• Paytm → Passbook → tap payment → Reference No.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("pay")}
                  className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-dark-text transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmitUTR}
                  disabled={loading || !utr.trim()}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #00ff88, #00cc6a)",
                    color: "#0d1117",
                  }}
                >
                  {loading ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Withdraw Modal ────────────────────────────────────────────────────────────

function WithdrawModal({
  balance,
  onClose,
  onSuccess,
  walletConfig,
}: {
  balance: number;
  onClose: () => void;
  onSuccess: (balance: number) => void;
  walletConfig: AdminWalletConfig;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [bank, setBank] = useState({
    accountNumber: "",
    ifsc: "",
    accountName: "",
  });
  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    const amt = parseInt(amount);
    if (!amt || amt < 10) return toast.error("Minimum withdrawal ₹10");
    if (amt > balance) return toast.error("Insufficient balance");
    if (method === "upi" && !upiId.trim())
      return toast.error("Enter your UPI ID");
    if (
      method === "bank" &&
      (!bank.accountNumber || !bank.ifsc || !bank.accountName)
    ) {
      return toast.error("Fill all bank details");
    }
    setLoading(true);
    try {
      const { data } = await walletApi.withdraw({
        amount: amt,
        ...(method === "upi" ? { upiId: upiId.trim() } : { bankDetails: bank }),
      });
      toast.success(data.message, { duration: 5000 });
      onSuccess(data.balance);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="relative w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{
          background: "rgba(12,14,18,0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h2 className="text-xl font-bold text-dark-text">Withdraw Money</h2>
        <p className="text-xs text-dark-muted">
          Available:{" "}
          <span className="text-neon-green font-bold">₹{balance}</span>
        </p>

        <div>
          <label className="text-xs text-dark-muted block mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            placeholder="e.g. 500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-neon-green"
          />
        </div>

        <div className="flex gap-2">
          {(["upi", "bank"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                method === m
                  ? "bg-neon-green text-dark-bg"
                  : "bg-dark-surface border border-dark-border text-dark-muted",
              )}
            >
              {m === "upi" ? "UPI" : "Bank Transfer"}
            </button>
          ))}
        </div>

        {method === "upi" ? (
          <div>
            <label className="text-xs text-dark-muted block mb-1">
              Your UPI ID
            </label>
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-neon-green"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <input
              value={bank.accountName}
              onChange={(e) =>
                setBank((b) => ({ ...b, accountName: e.target.value }))
              }
              placeholder="Account holder name"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
            />
            <input
              value={bank.accountNumber}
              onChange={(e) =>
                setBank((b) => ({ ...b, accountNumber: e.target.value }))
              }
              placeholder="Account number"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
            />
            <input
              value={bank.ifsc}
              onChange={(e) =>
                setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))
              }
              placeholder="IFSC code"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
            />
          </div>
        )}

        <div
          className="rounded-lg px-3 py-2 text-xs text-dark-muted"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          Admin will send money to your UPI/bank within 24 hours of approval.
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleWithdraw}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-neon-green text-dark-bg font-bold text-sm disabled:opacity-50 hover:bg-green-400 transition-colors"
          >
            {loading ? "Submitting…" : "Request Withdrawal"}
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

  const TX_PAGE_SIZE = 10;

  const [balance, setBalance] = useState(0);
  const [isGuest, setIsGuest] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [walletConfig, setWalletConfig] = useState<AdminWalletConfig>({
    depositEnabled: true,
    withdrawEnabled: true,
    upiId: "paytmqr5p0dyv@ptys",
    upiName: "7Cards Game",
    qrEnabled: true,
    qrCodeUrl: "",
  });

  const load = useCallback(async () => {
    try {
      const { data } = await walletApi.get();
      setBalance(data.balance);
      setIsGuest(data.isGuest);
      setTransactions(data.transactions);
      setWithdrawalRequests(data.withdrawalRequests ?? []);
      setDepositRequests(data.depositRequests ?? []);
    } catch {
      toast.error("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    // Load wallet config
    configApi
      .getPublic()
      .then((r) => {
        if (r.data.walletConfig) {
          setWalletConfig(r.data.walletConfig);
        }
      })
      .catch(() => {});

    load();

    const unsub = on(
      "wallet:prize_won",
      (data: { amount: number; balance: number }) => {
        toast.success(`You won ₹${data.amount}!`, { duration: 6000 });
        setBalance(data.balance);
        load();
      },
    );

    // Listen for config updates
    const unsubConfig = on("admin:config_updated", (cfg: any) => {
      if (cfg.walletConfig) {
        setWalletConfig(cfg.walletConfig);
      }
    });

    return () => {
      unsub();
      unsubConfig();
    };
  }, [isAuthenticated, navigate, load]);

  const isDebit = (type: string) =>
    type === "withdrawal" || type === "entry_fee";

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="text-dark-muted animate-pulse text-sm">
            Loading wallet…
          </div>
        </div>
      </Layout>
    );
  }

  const pendingWithdrawals = withdrawalRequests.filter(
    (w) => w.status === "pending",
  );

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Balance Card */}
          <div
            className="relative rounded-3xl p-6 overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,255,136,0.12) 0%, rgba(0,150,255,0.08) 100%)",
              border: "1px solid rgba(0,255,136,0.25)",
            }}
          >
            <div
              className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
              style={{
                background: "radial-gradient(circle, #00ff88, transparent)",
                transform: "translate(30%, -30%)",
              }}
            />
            <p className="text-xs text-dark-muted uppercase tracking-wider mb-1">
              Wallet Balance
            </p>
            <p className="text-5xl font-bold text-dark-text mb-1">
              <span className="text-neon-green">₹</span>
              {balance.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-dark-muted">{user?.username}</p>
            {isGuest && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
                Guest accounts cannot add or withdraw money. Sign in to use the
                wallet.
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isGuest && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAdd(true)}
                disabled={!walletConfig.depositEnabled}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl font-bold transition-all disabled:opacity-40"
                style={{
                  background: "rgba(0,255,136,0.1)",
                  border: "1px solid rgba(0,255,136,0.25)",
                }}
              >
                <span className="text-2xl">⬇️</span>
                <span className="text-neon-green text-sm">Add Money</span>
                {!walletConfig.depositEnabled && (
                  <span className="text-[10px] text-yellow-400">Disabled</span>
                )}
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                disabled={balance <= 0 || !walletConfig.withdrawEnabled}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl font-bold transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-2xl">⬆️</span>
                <span className="text-dark-text text-sm">Withdraw</span>
                {!walletConfig.withdrawEnabled && (
                  <span className="text-[10px] text-yellow-400">Disabled</span>
                )}
              </button>
            </div>
          )}

          {/* Deposit request statuses */}
          {depositRequests.length > 0 && (
            <div className="space-y-2">
              {depositRequests.map((d: any) => {
                const isPending = d.status === "pending";
                const isApproved = d.status === "approved";
                const isRejected = d.status === "rejected";
                return (
                  <div
                    key={d._id}
                    className="rounded-2xl px-4 py-3"
                    style={{
                      background: isRejected
                        ? "rgba(255,60,60,0.05)"
                        : isApproved
                          ? "rgba(0,255,136,0.05)"
                          : "rgba(251,191,36,0.05)",
                      border: `1px solid ${isRejected ? "rgba(255,60,60,0.2)" : isApproved ? "rgba(0,255,136,0.2)" : "rgba(251,191,36,0.2)"}`,
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {isPending ? "⏳" : isApproved ? "✅" : "❌"} Deposit
                          ₹{d.amount}
                        </p>
                        <p className="text-xs text-dark-muted font-mono mt-0.5">
                          UTR: {d.utrNumber}
                        </p>
                        <p className="text-[10px] text-dark-muted mt-0.5">
                          {new Date(d.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={clsx(
                          "text-[10px] px-2 py-0.5 rounded-full font-semibold mt-0.5",
                          isRejected
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : isApproved
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
                        )}
                      >
                        {d.status}
                      </span>
                    </div>
                    {isRejected && (
                      <p className="text-xs text-red-400/80 mt-2">
                        {d.adminNote
                          ? `Reason: ${d.adminNote}`
                          : "Your deposit was not verified. Please contact admin or resubmit with correct UTR."}
                      </p>
                    )}
                    {isPending && (
                      <p className="text-xs text-yellow-400/70 mt-1">
                        Admin will verify and credit your wallet shortly.
                      </p>
                    )}
                    {isApproved && (
                      <p className="text-xs text-green-400/70 mt-1">
                        Amount has been credited to your wallet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending withdrawal banner */}
          {pendingWithdrawals.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,107,107,0.04)",
                border: "1px solid rgba(255,107,107,0.15)",
              }}
            >
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                ⏳ Withdrawal Under Review
              </p>
              {pendingWithdrawals.map((w: any) => (
                <div
                  key={w._id}
                  className="flex justify-between items-center py-1.5"
                >
                  <div>
                    <p className="text-sm text-white font-medium">
                      ₹{w.amount}
                    </p>
                    <p className="text-xs text-dark-muted">
                      {w.upiId ?? w.bankDetails?.accountName}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    Pending
                  </span>
                </div>
              ))}
              <p className="text-xs text-dark-muted mt-2">
                Admin will process within 24 hours.
              </p>
            </div>
          )}

          {/* Transaction history */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-dark-muted uppercase tracking-wider">
                Transaction History
              </h2>
              {transactions.length > TX_PAGE_SIZE && (
                <span className="text-xs text-dark-muted">
                  {Math.min(txPage * TX_PAGE_SIZE, transactions.length)} of{" "}
                  {transactions.length}
                </span>
              )}
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-dark-muted text-sm">
                No transactions yet
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {transactions
                    .slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE)
                    .map((tx) => (
                      <div
                        key={tx._id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{
                          background: isDebit(tx.type)
                            ? "rgba(255,60,60,0.04)"
                            : tx.type === "winning"
                              ? "rgba(255,215,0,0.04)"
                              : "rgba(255,255,255,0.03)",
                          border: isDebit(tx.type)
                            ? "1px solid rgba(255,60,60,0.1)"
                            : tx.type === "winning"
                              ? "1px solid rgba(255,215,0,0.12)"
                              : "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span className="text-xl flex-shrink-0">
                          {TX_ICONS[tx.type] ?? "💳"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={clsx(
                              "text-sm font-semibold",
                              TX_COLORS[tx.type] ?? "text-dark-text",
                            )}
                          >
                            {TX_LABELS[tx.type] ?? tx.type}
                          </p>
                          <p className="text-xs text-dark-muted truncate">
                            {tx.description}
                          </p>
                          <p className="text-[10px] text-dark-muted opacity-70">
                            {new Date(tx.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p
                            className={clsx(
                              "text-sm font-bold",
                              TX_COLORS[tx.type] ?? "text-dark-text",
                            )}
                          >
                            {isDebit(tx.type) ? "-" : "+"}₹{tx.amount}
                          </p>
                          <span
                            className={clsx(
                              "text-[10px] px-1.5 py-0.5 rounded-full",
                              STATUS_PILL[tx.status] ??
                                "bg-dark-border text-dark-muted",
                            )}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Pagination controls */}
                {transactions.length > TX_PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-border">
                    <button
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={txPage === 1}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-dark-muted hover:text-dark-text border border-dark-border hover:border-dark-text/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from(
                        {
                          length: Math.ceil(transactions.length / TX_PAGE_SIZE),
                        },
                        (_, i) => i + 1,
                      ).map((p) => (
                        <button
                          key={p}
                          onClick={() => setTxPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            p === txPage
                              ? "bg-neon-green text-dark-bg"
                              : "text-dark-muted hover:text-dark-text hover:bg-white/5"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        setTxPage((p) =>
                          Math.min(
                            Math.ceil(transactions.length / TX_PAGE_SIZE),
                            p + 1,
                          ),
                        )
                      }
                      disabled={
                        txPage >= Math.ceil(transactions.length / TX_PAGE_SIZE)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-dark-muted hover:text-dark-text border border-dark-border hover:border-dark-text/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddMoneyModal
            onClose={() => setShowAdd(false)}
            onSuccess={load}
            walletConfig={walletConfig}
          />
        )}
        {showWithdraw && (
          <WithdrawModal
            balance={balance}
            onClose={() => setShowWithdraw(false)}
            onSuccess={(b) => {
              setBalance(b);
              load();
            }}
            walletConfig={walletConfig}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
