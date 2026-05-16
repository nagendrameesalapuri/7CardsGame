import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { useAuthStore } from "../store/authStore";
import { walletApi } from "../services/api";
import { on } from "../services/socket";
import { Layout } from "../components/layout/Layout";
import { WalletTransaction } from "@shared/types";
import { notify } from "../services/notify";

const BRANDS = [
  { name: "Amazon",      icon: "📦", color: "#FF9900" },
  { name: "Flipkart",    icon: "🛒", color: "#2874F0" },
  { name: "Myntra",      icon: "👗", color: "#FF3F6C" },
  { name: "Ajio",        icon: "👔", color: "#FF4E50" },
  { name: "Swiggy",      icon: "🍔", color: "#FC8019" },
  { name: "Zomato",      icon: "🍕", color: "#E23744" },
];

const TX_PAGE_SIZE = 10;

const TX_ICONS: Record<string, string> = {
  deposit:    "⬇️",
  withdrawal: "⬆️",
  winning:    "🏆",
  entry_fee:  "⚔️",
  refund:     "↩️",
  bonus:      "🎁",
};

const TX_LABELS: Record<string, string> = {
  deposit:    "Challenge Entry Credit",
  withdrawal: "Reward Redemption",
  winning:    "Tournament Prize",
  entry_fee:  "Challenge Entry",
  refund:     "Refund",
  bonus:      "Bonus Reward",
};

const TX_COLORS: Record<string, string> = {
  deposit:    "text-green-400",
  winning:    "text-yellow-400",
  refund:     "text-blue-400",
  withdrawal: "text-red-400",
  entry_fee:  "text-red-400",
  bonus:      "text-purple-400",
};

function PageBar({ page, total, size, onChange }: {
  page: number; total: number; size: number; onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-border">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-dark-muted hover:text-dark-text border border-dark-border transition-all disabled:opacity-30">
        ← Prev
      </button>
      <div className="flex items-center gap-1">
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
              p === page ? "bg-indigo-500 text-white" : "text-dark-muted hover:text-dark-text hover:bg-white/5"
            }`}>
            {p}
          </button>
        ))}
      </div>
      <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page >= pages}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-dark-muted hover:text-dark-text border border-dark-border transition-all disabled:opacity-30">
        Next →
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    approved:  "bg-green-500/20 text-green-400 border-green-500/30",
    rejected:  "bg-red-500/20 text-red-400 border-red-500/30",
    delivered: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  };
  const labels: Record<string, string> = {
    pending: "Pending", approved: "Approved", rejected: "Rejected", delivered: "Delivered",
  };
  return (
    <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-semibold border",
      map[status] ?? "bg-dark-border text-dark-muted border-dark-border")}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Redeem Gift Voucher Modal (deposit) ───────────────────────────────────────

function VoucherDetails({ voucher: w }: { voucher: any }) {
  const [revealed, setRevealed] = useState(false);
  const mask = (val: string) => val ? '•'.repeat(Math.min(val.length, 12)) : '—';
  return (
    <div className="space-y-2">
      <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="min-w-0">
          <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-1">Voucher Code</p>
          <p className="font-mono text-sm font-bold text-white tracking-wider truncate">
            {revealed ? w.deliveredVoucherNumber : mask(w.deliveredVoucherNumber)}
          </p>
        </div>
        <button onClick={() => setRevealed(r => !r)}
          className="flex-shrink-0 text-dark-muted hover:text-white transition-colors px-2 py-1 rounded-lg"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          title={revealed ? "Hide" : "Reveal"}>
          {revealed ? "🙈" : "👁️"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-0.5">PIN</p>
          <p className="font-mono text-sm font-bold text-white">
            {revealed ? w.deliveredVoucherPin : mask(w.deliveredVoucherPin)}
          </p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-0.5">Expiry</p>
          <p className="font-mono text-sm font-bold text-white">{w.deliveredVoucherExpiry}</p>
        </div>
      </div>
      {!revealed && (
        <button onClick={() => setRevealed(true)}
          className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)" }}>
          👁️ Tap to reveal voucher details
        </button>
      )}
    </div>
  );
}

function VoucherSubmitModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [brand, setBrand] = useState("");
  const [amount, setAmount] = useState<50 | 100 | null>(null);
  const [number, setNumber] = useState("");
  const [pin, setPin] = useState("");
  const [expiry, setExpiry] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPurchaseGuide, setShowPurchaseGuide] = useState(true);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { notify.error("Screenshot too large. Max 3MB."); return; }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setScreenshotPreview(b64);
      setScreenshot(b64);
    };
    reader.readAsDataURL(file);
  };

  const canNext1 = !!brand;
  const canNext2 = !!amount;
  const canSubmit = number.trim().length >= 6 && pin.trim().length >= 3 && expiry.trim().length >= 4;

  const handleSubmit = async () => {
    if (!brand || !amount || !canSubmit) return;
    setLoading(true);
    try {
      const { data } = await walletApi.voucherSubmit({
        voucherBrand: brand, voucherNumber: number.trim(),
        voucherPin: pin.trim(), voucherExpiry: expiry.trim(),
        amount, screenshotUrl: screenshot.trim() || undefined,
      });
      notify.success(data.message, { duration: 6000 });
      onSuccess();
      onClose();
    } catch (err: any) {
      notify.error(err?.response?.data?.error ?? "Failed to submit voucher");
    } finally {
      setLoading(false);
    }
  };

  const selectedBrand = BRANDS.find(b => b.name === brand);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "rgba(10,12,24,0.98)", border: "1px solid rgba(99,102,241,0.3)" }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-white">Submit Gift Voucher</h2>
              <p className="text-xs text-dark-muted mt-0.5">Earn wallet credits after admin verifies your voucher</p>
            </div>
            <button onClick={onClose} className="text-dark-muted hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all ${
                  step === s ? "bg-indigo-500 text-white" : step > s ? "bg-green-500 text-white" : "bg-dark-border text-dark-muted"
                }`}>{step > s ? "✓" : s}</div>
                {s < 3 && <div className={`flex-1 h-px ${step > s ? "bg-green-500/50" : "bg-dark-border"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: Brand */}
          {step === 1 && (
            <>
              <p className="text-sm font-semibold text-white">Select voucher brand</p>
              <div className="grid grid-cols-3 gap-2">
                {BRANDS.map(b => (
                  <button key={b.name} onClick={() => setBrand(b.name)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
                    style={{
                      background: brand === b.name ? `${b.color}22` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${brand === b.name ? b.color + "80" : "rgba(255,255,255,0.07)"}`,
                    }}>
                    <span className="text-2xl">{b.icon}</span>
                    <span className="text-[10px] font-bold text-white leading-tight text-center">{b.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)} disabled={!canNext1}
                className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-40 transition-all"
                style={{ background: canNext1 ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : undefined, color: canNext1 ? "#fff" : undefined }}>
                Next →
              </button>
            </>
          )}

          {/* Step 2: Amount */}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-dark-muted text-xs hover:text-white transition-colors">
                ← {selectedBrand?.icon} {brand}
              </button>
              <p className="text-sm font-semibold text-white">Select voucher amount</p>
              <div className="grid grid-cols-2 gap-3">
                {([50, 100] as const).map(a => (
                  <button key={a} onClick={() => setAmount(a)}
                    className="flex flex-col items-center gap-1 py-5 rounded-2xl transition-all"
                    style={{
                      background: amount === a ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${amount === a ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.07)"}`,
                    }}>
                    <span className="text-2xl font-black text-white">₹{a}</span>
                    <span className="text-[10px] text-dark-muted">{a * 100} credits</span>
                  </button>
                ))}
              </div>
              <div className="rounded-xl p-3 text-xs text-dark-muted"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Daily limit: ₹300 | Amounts: ₹50 or ₹100 only
              </div>
              <button onClick={() => setStep(3)} disabled={!canNext2}
                className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-40 transition-all"
                style={{ background: canNext2 ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : undefined, color: canNext2 ? "#fff" : undefined }}>
                Next →
              </button>
            </>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <>
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-dark-muted text-xs hover:text-white transition-colors">
                ← ₹{amount} {selectedBrand?.icon} {brand}
              </button>

              {/* ── How to Purchase Guide ── */}
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.06)" }}>
                <button
                  type="button"
                  onClick={() => setShowPurchaseGuide(g => !g)}
                  className="w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">💡</span>
                    <span className="text-xs font-black text-indigo-300">How to get a {brand} voucher?</span>
                  </div>
                  <span className="text-indigo-400 text-xs transition-transform" style={{ transform: showPurchaseGuide ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>

                {showPurchaseGuide && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="h-px" style={{ background: "rgba(99,102,241,0.2)" }} />
                    {/* App options */}
                    <div className="flex gap-1.5 flex-wrap pt-0.5">
                      {["📱 PhonePe", "💳 Paytm", "🔵 Amazon Pay"].map(a => (
                        <span key={a} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)" }}>
                          {a}
                        </span>
                      ))}
                    </div>
                    {/* Steps */}
                    <div className="space-y-1.5">
                      {[
                        { n: 1, icon: "📲", text: `Open PhonePe or Paytm on your phone` },
                        { n: 2, icon: "🔍", text: `Search for "${brand} Gift Card" or tap Gift Cards section` },
                        { n: 3, icon: "💰", text: `Select ₹${amount} denomination and proceed to pay` },
                        { n: 4, icon: "✅", text: `Complete payment via UPI / wallet` },
                        { n: 5, icon: "🎟️", text: `Open the voucher — you'll see Code, PIN & Expiry` },
                        { n: 6, icon: "📸", text: `Take a screenshot of the voucher screen` },
                        { n: 7, icon: "✍️", text: `Come back here, enter the details & upload screenshot` },
                      ].map(s => (
                        <div key={s.n} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-0.5"
                            style={{ background: "rgba(99,102,241,0.25)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.35)" }}>
                            {s.n}
                          </div>
                          <p className="text-[11px] leading-relaxed flex items-center gap-1.5" style={{ color: "rgba(203,213,225,0.8)" }}>
                            <span>{s.icon}</span>
                            <span>{s.text}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl mt-1"
                      style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <span className="text-sm">⚡</span>
                      <p className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>
                        Screenshot speeds up admin approval — attach it below!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-dark-muted block mb-1">Voucher Number *</label>
                  <input value={number} onChange={e => setNumber(e.target.value)}
                    placeholder="e.g. 1234 5678 9012 3456"
                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-dark-text font-mono text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-dark-muted block mb-1">Voucher PIN *</label>
                    <input value={pin} onChange={e => setPin(e.target.value)}
                      placeholder="PIN"
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-dark-text font-mono text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-dark-muted block mb-1">Expiry *</label>
                    <input value={expiry} onChange={e => setExpiry(e.target.value)}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-dark-text font-mono text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-dark-muted block mb-1.5">📸 Upload Screenshot <span className="text-dark-muted/60">(optional, helps speed up approval)</span></label>
                  {screenshotPreview ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.4)" }}>
                      <img src={screenshotPreview} alt="screenshot" className="w-full h-24 object-cover" />
                      <button
                        onClick={() => { setScreenshotFile(null); setScreenshotPreview(""); setScreenshot(""); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>×</button>
                      <div className="absolute bottom-0 inset-x-0 px-2 py-1" style={{ background: "rgba(0,0,0,0.6)" }}>
                        <p className="text-[10px] text-green-400 font-semibold">✓ Screenshot attached — {screenshotFile?.name}</p>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 py-4 rounded-xl cursor-pointer transition-all"
                      style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.35)" }}>
                      <span className="text-2xl">📷</span>
                      <span className="text-xs text-indigo-300 font-semibold">Tap to upload screenshot</span>
                      <span className="text-[10px] text-dark-muted">JPG, PNG · Max 3MB</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotUpload} />
                    </label>
                  )}
                </div>
              </div>
              <div className="rounded-xl p-3 text-xs text-dark-muted space-y-1"
                style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <p className="font-semibold text-indigo-300">After submission:</p>
                <p>• Admin will verify your voucher details</p>
                <p>• ₹{amount} ({(amount ?? 0) * 100} credits) added on approval</p>
                <p>• Typically processed within 24 hours</p>
              </div>
              <button onClick={handleSubmit} disabled={loading || !canSubmit}
                className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
                {loading ? "Submitting…" : `Submit ${selectedBrand?.icon} ${brand} Voucher`}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Redeem Rewards Modal (withdrawal as gift voucher) ─────────────────────────

function RedeemModal({ balance, onClose, onSuccess }: {
  balance: number; onClose: () => void; onSuccess: (b: number) => void;
}) {
  const [brand, setBrand] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const amt = parseInt(amount) || 0;
  const valid = !!brand && amt >= 50 && amt <= 500 && amt <= balance;

  const handleRedeem = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      const { data } = await walletApi.redeem({ amount: amt, voucherBrand: brand });
      notify.success(data.message, { duration: 6000 });
      onSuccess(data.balance);
      onClose();
    } catch (err: any) {
      notify.error(err?.response?.data?.error ?? "Redemption failed");
    } finally {
      setLoading(false);
    }
  };

  const selectedBrand = BRANDS.find(b => b.name === brand);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "rgba(10,12,24,0.98)", border: "1px solid rgba(168,85,247,0.3)" }}>

        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-white">Redeem Rewards</h2>
              <p className="text-xs text-dark-muted mt-0.5">Receive a brand gift voucher via admin</p>
            </div>
            <button onClick={onClose} className="text-dark-muted hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <span className="text-xs text-dark-muted">Available Rewards</span>
            <span className="text-lg font-black text-purple-400">₹{balance.toLocaleString("en-IN")}</span>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-2">Choose voucher brand</p>
            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map(b => (
                <button key={b.name} onClick={() => setBrand(b.name)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all"
                  style={{
                    background: brand === b.name ? `${b.color}22` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${brand === b.name ? b.color + "80" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  <span className="text-xl">{b.icon}</span>
                  <span className="text-[10px] font-bold text-white text-center leading-tight">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-dark-muted block mb-1">Redemption Amount (₹50 – ₹500)</label>
            <input type="number" min={50} max={500} value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-dark-text text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
            {amt > 0 && amt < 50 && <p className="text-[11px] text-red-400 mt-1">Minimum ₹50</p>}
            {amt > 500 && <p className="text-[11px] text-red-400 mt-1">Maximum ₹500</p>}
            {amt > balance && amt <= 500 && <p className="text-[11px] text-red-400 mt-1">Insufficient Reward Balance</p>}
          </div>

          {brand && amt >= 50 && amt <= 500 && amt <= balance && (
            <div className="rounded-xl p-3 text-xs text-dark-muted"
              style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)" }}>
              <p className="font-semibold text-purple-300">
                {selectedBrand?.icon} ₹{amt} will be deducted from your Reward Balance
              </p>
              <p className="mt-1">Admin will deliver a {brand} voucher worth ₹{amt} within 24 hours.</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-dark-text transition-colors">
              Cancel
            </button>
            <button onClick={handleRedeem} disabled={loading || !valid}
              className="flex-1 py-2.5 rounded-xl font-black text-sm disabled:opacity-40 transition-all"
              style={{ background: valid ? "linear-gradient(135deg,#8b5cf6,#a855f7)" : undefined, color: valid ? "#fff" : undefined }}>
              {loading ? "Processing…" : "Redeem"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Promo Flow Banner ────────────────────────────────────────────────────────

const SMALL_VOUCHERS = [
  { brand: "AMAZON",   amount: 50,  bg: "linear-gradient(135deg,#FF9900,#e67e00)", border: "rgba(255,153,0,0.5)",  text: "#fff", offset: "translate(8px,8px)" },
  { brand: "FLIPKART", amount: 100, bg: "linear-gradient(135deg,#2874F0,#1a5fd6)", border: "rgba(40,116,240,0.6)", text: "#fff", offset: "translate(0,0)" },
];

function PromoFlowBanner({ onSubmit }: { onSubmit: () => void }) {
  return (
    <motion.div whileTap={{ scale: 0.985 }} onClick={onSubmit}
      className="relative rounded-3xl overflow-hidden cursor-pointer select-none"
      style={{
        background: "linear-gradient(135deg,rgba(25,12,60,0.97) 0%,rgba(12,6,30,0.99) 100%)",
        border: "1px solid rgba(99,102,241,0.4)",
        boxShadow: "0 12px 50px rgba(99,102,241,0.18)",
      }}>

      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle,#6366f1,transparent)", filter: "blur(30px)" }} />
        <div className="absolute -bottom-8 -right-8 w-48 h-48 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle,#a855f7,transparent)", filter: "blur(35px)" }} />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle,#8b5cf6,transparent)", filter: "blur(20px)", transform: "translate(-50%,-50%)" }} />
      </div>

      <div className="relative p-4 sm:p-5">
        {/* Top label row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-0.5" style={{ color: "#818cf8" }}>Earn System</p>
            <p className="text-base font-black text-white leading-tight">Submit Small,<br/>
              <span style={{ background: "linear-gradient(90deg,#a78bfa,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Earn Big Rewards
              </span>
            </p>
          </div>
          <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
            ⚔️
          </motion.div>
        </div>

        {/* Flow row */}
        <div className="flex items-center gap-3">

          {/* Left: stacked small voucher cards */}
          <div className="flex-shrink-0 relative" style={{ width: 100, height: 72 }}>
            {SMALL_VOUCHERS.map((v, i) => (
              <motion.div key={v.brand}
                animate={{ y: [0, i === 1 ? -3 : 3, 0] }}
                transition={{ duration: 2.5 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute rounded-2xl px-3 py-2 shadow-xl"
                style={{
                  width: 96, height: 58,
                  background: v.bg,
                  border: `1px solid ${v.border}`,
                  transform: v.offset,
                  zIndex: i + 1,
                  boxShadow: `0 4px 20px ${v.border}`,
                }}>
                <p className="text-[8px] font-black tracking-widest opacity-80" style={{ color: v.text }}>{v.brand}</p>
                <p className="text-xl font-black leading-none" style={{ color: v.text }}>₹{v.amount}</p>
                <p className="text-[8px] opacity-60 font-semibold" style={{ color: v.text }}>Gift Voucher</p>
                {/* Shine sweep */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute top-0 left-[-60%] w-1/2 h-full opacity-20 rotate-12"
                    style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)" }} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Center: animated flow arrow */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#818cf8" }}>Submit</p>
            <div className="flex items-center gap-0.5 w-full justify-center">
              {[0, 1, 2, 3].map(i => (
                <motion.div key={i}
                  animate={{ opacity: [0.2, 1, 0.2], x: [0, 4, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                  className="rounded-full"
                  style={{ width: i === 3 ? 0 : 5, height: 5,
                    background: i === 3 ? undefined : "rgba(139,92,246,0.8)",
                    borderTop: i === 3 ? "5px solid transparent" : undefined,
                    borderBottom: i === 3 ? "5px solid transparent" : undefined,
                    borderLeft: i === 3 ? "8px solid #8b5cf6" : undefined,
                  }} />
              ))}
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#a78bfa" }}>Earn Back</p>
          </div>

          {/* Right: big reward card */}
          <div className="flex-shrink-0 relative" style={{ width: 110 }}>
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-2xl p-3 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg,rgba(99,102,241,0.35),rgba(168,85,247,0.3))",
                border: "1.5px solid rgba(168,85,247,0.6)",
                boxShadow: "0 0 30px rgba(139,92,246,0.3)",
              }}>
              {/* Gold shimmer bar */}
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: "linear-gradient(90deg,transparent,rgba(253,224,71,0.8),transparent)" }} />
              <div className="absolute top-0 right-0 w-10 h-10 rounded-full pointer-events-none opacity-30"
                style={{ background: "radial-gradient(circle,#fde047,transparent)", transform: "translate(30%,-30%)" }} />

              <p className="text-[8px] font-black uppercase tracking-widest text-purple-300">REWARD</p>
              <p className="text-2xl font-black leading-none"
                style={{ background: "linear-gradient(135deg,#fde047,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                ₹500
              </p>
              <p className="text-[8px] text-purple-200 font-semibold mt-0.5">Any Brand</p>
              <div className="flex gap-0.5 mt-1.5 flex-wrap">
                {["📦","🛒","👗","🎮","🍔","🍕"].map(icon => (
                  <span key={icon} className="text-[11px]">{icon}</span>
                ))}
              </div>
            </motion.div>

            {/* "UP TO" badge */}
            <div className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[8px] font-black"
              style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff", boxShadow: "0 2px 8px rgba(245,158,11,0.5)" }}>
              UP TO
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}
          className="mt-4 flex items-center justify-center gap-2">
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.4))" }} />
          <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "#818cf8" }}>
            Tap to Submit a Gift Voucher
          </p>
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(99,102,241,0.4),transparent)" }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Main WalletPage ───────────────────────────────────────────────────────────

type HistoryTab = "activity" | "vouchers" | "rewards" | "received";

export function WalletPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [lockedRewards, setLockedRewards] = useState(0);
  const [isGuest, setIsGuest] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVoucherSubmit, setShowVoucherSubmit] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);

  const [historyTab, setHistoryTab] = useState<HistoryTab>("activity");
  const [txPage, setTxPage] = useState(1);
  const [depPage, setDepPage] = useState(1);
  const [wdPage, setWdPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const { data } = await walletApi.get();
      setBalance(data.balance);
      setLockedRewards(data.lockedRewards ?? 0);
      setIsGuest(data.isGuest);
      setTransactions(data.transactions ?? []);
      setWithdrawalRequests(data.withdrawalRequests ?? []);
      setDepositRequests(data.depositRequests ?? []);
    } catch {
      notify.error("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate("/"); return; }
    load();
    const unsub = on("wallet:prize_won", (d: { amount: number; balance: number }) => {
      notify.success(`You won ₹${d.amount}! 🏆`, { duration: 6000 });
      setBalance(d.balance);
      load();
    });
    return () => { unsub(); };
  }, [isAuthenticated, navigate, load]);

  const deliveredVouchers = withdrawalRequests.filter(w => w.status === "delivered" && w.deliveredVoucherNumber);

  const TABS: { key: HistoryTab; label: string; icon: string; count: number }[] = [
    { key: "activity",  icon: "📊", label: "Activity",  count: transactions.length },
    { key: "vouchers",  icon: "🎟️", label: "Vouchers",  count: depositRequests.length },
    { key: "rewards",   icon: "⬆️", label: "Rewards",   count: withdrawalRequests.length },
    { key: "received",  icon: "🎁", label: "Received",  count: deliveredVouchers.length },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin" />
          <p className="text-dark-muted text-sm">Loading Tournament Wallet…</p>
        </div>
      </Layout>
    );
  }

  const credits = balance * 100;

  return (
    <Layout>
      <div className="max-w-lg mx-auto pb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* ── Balance Card ──────────────────────────────────────────────── */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg,rgba(99,102,241,0.15) 0%,rgba(168,85,247,0.1) 60%,rgba(30,20,60,0.95) 100%)",
              border: "1px solid rgba(99,102,241,0.3)",
              boxShadow: "0 20px 60px rgba(99,102,241,0.15)",
            }}>
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle,#8b5cf6,transparent)", transform: "translate(30%,-30%)" }} />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle,#6366f1,transparent)", transform: "translate(-30%,30%)" }} />

            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(99,102,241,0.8)" }}>
                    Tournament Wallet
                  </p>
                  <p className="text-xs text-dark-muted">{user?.username}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}>
                  🏆
                </div>
              </div>

              <p className="text-xs text-dark-muted uppercase tracking-wider mb-1">Reward Balance</p>
              <p className="text-5xl font-black leading-none mb-1" style={{
                background: "linear-gradient(135deg,#ffffff,#c7d2fe,#a78bfa)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                ₹{balance.toLocaleString("en-IN")}
              </p>

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <span className="text-xs">⚡</span>
                  <span className="text-xs font-bold text-indigo-300">{credits.toLocaleString("en-IN")} Credits</span>
                </div>
                {lockedRewards > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                    style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                    <span className="text-xs">🔒</span>
                    <span className="text-xs font-bold text-yellow-400">₹{lockedRewards} Locked</span>
                  </div>
                )}
              </div>

              {isGuest && (
                <div className="mt-4 px-3 py-2.5 rounded-xl text-xs text-yellow-300"
                  style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  Guest accounts cannot use the wallet. Sign in to track rewards.
                </div>
              )}
            </div>
          </div>

          {/* ── Action Buttons ────────────────────────────────────────────── */}
          {!isGuest && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowVoucherSubmit(true)}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
                <span className="text-2xl">🎟️</span>
                <div className="text-center">
                  <p className="text-indigo-300 text-sm font-black leading-tight">Submit Voucher</p>
                  <p className="text-[10px] text-dark-muted">Earn Tournament Credits</p>
                </div>
              </button>
              <button onClick={() => setShowRedeem(true)} disabled={balance < 50}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-40"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
                <span className="text-2xl">🎁</span>
                <div className="text-center">
                  <p className="text-purple-300 text-sm font-black leading-tight">Redeem Rewards</p>
                  <p className="text-[10px] text-dark-muted">Get brand gift vouchers</p>
                </div>
              </button>
            </div>
          )}

          {/* ── Promo Flow Banner ─────────────────────────────────────────── */}
          <PromoFlowBanner onSubmit={() => setShowVoucherSubmit(true)} />

          {/* ── History Tabs ──────────────────────────────────────────────── */}
          <div>
            <div className="flex rounded-2xl overflow-hidden mb-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {TABS.map((tab) => (
                <button key={tab.key} onClick={() => setHistoryTab(tab.key)}
                  className="flex-1 py-2.5 text-[11px] font-semibold transition-all flex flex-col items-center gap-0.5"
                  style={historyTab === tab.key ? {
                    background: "rgba(99,102,241,0.2)", color: "#a5b4fc", borderBottom: "2px solid #6366f1",
                  } : { color: "#4b5563" }}>
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                      style={{ background: historyTab === tab.key ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)" }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Activity Tab ── */}
            {historyTab === "activity" && (
              transactions.length === 0 ? (
                <div className="text-center py-12 text-dark-muted">
                  <p className="text-4xl mb-3">📊</p>
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs mt-1">Compete in arenas to earn rewards</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {transactions.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE).map((tx) => {
                      const isDebit = tx.type === "withdrawal" || tx.type === "entry_fee";
                      return (
                        <div key={tx._id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                          style={{
                            background: isDebit ? "rgba(255,60,60,0.04)" : tx.type === "winning" ? "rgba(255,215,0,0.04)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${isDebit ? "rgba(255,60,60,0.1)" : tx.type === "winning" ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.05)"}`,
                          }}>
                          <span className="text-xl flex-shrink-0">{TX_ICONS[tx.type] ?? "💳"}</span>
                          <div className="flex-1 min-w-0">
                            <p className={clsx("text-sm font-semibold", TX_COLORS[tx.type] ?? "text-dark-text")}>
                              {TX_LABELS[tx.type] ?? tx.type}
                            </p>
                            <p className="text-xs text-dark-muted truncate">{tx.description}</p>
                            <p className="text-[10px] text-dark-muted opacity-70">
                              {new Date(tx.createdAt).toLocaleString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={clsx("text-sm font-bold", TX_COLORS[tx.type] ?? "text-dark-text")}>
                              {isDebit ? "-" : "+"}₹{tx.amount}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <PageBar page={txPage} total={transactions.length} size={TX_PAGE_SIZE} onChange={setTxPage} />
                </>
              )
            )}

            {/* ── Vouchers Tab (deposits) ── */}
            {historyTab === "vouchers" && (
              depositRequests.length === 0 ? (
                <div className="text-center py-12 text-dark-muted">
                  <p className="text-4xl mb-3">🎟️</p>
                  <p className="text-sm">No vouchers submitted yet</p>
                  {!isGuest && (
                    <button onClick={() => setShowVoucherSubmit(true)}
                      className="mt-3 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                      Submit a Voucher
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-dark-muted mb-3">{depositRequests.length} submission{depositRequests.length !== 1 ? "s" : ""}</p>
                  <div className="space-y-2">
                    {depositRequests.slice((depPage - 1) * TX_PAGE_SIZE, depPage * TX_PAGE_SIZE).map((d: any) => {
                      const brandInfo = BRANDS.find(b => b.name === d.voucherBrand);
                      return (
                        <div key={d._id} className="rounded-2xl px-4 py-3"
                          style={{
                            background: d.status === "rejected" ? "rgba(255,60,60,0.05)" : d.status === "approved" ? "rgba(99,102,241,0.06)" : "rgba(251,191,36,0.04)",
                            border: `1px solid ${d.status === "rejected" ? "rgba(255,60,60,0.2)" : d.status === "approved" ? "rgba(99,102,241,0.2)" : "rgba(251,191,36,0.2)"}`,
                          }}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                                {brandInfo?.icon ?? "🎟️"} {d.voucherBrand ?? "Voucher"} — ₹{d.amount}
                              </p>
                              {d.voucherNumberMasked && (
                                <p className="text-[11px] text-dark-muted font-mono mt-0.5">{d.voucherNumberMasked}</p>
                              )}
                              {d.utrNumber && (
                                <p className="text-[11px] text-dark-muted font-mono mt-0.5">UTR: {d.utrNumber}</p>
                              )}
                              <p className="text-[10px] text-dark-muted mt-0.5">
                                {new Date(d.createdAt).toLocaleString("en-IN", {
                                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <StatusBadge status={d.status} />
                          </div>
                          {d.status === "rejected" && (
                            <p className="text-xs text-red-400/80 mt-2">
                              {d.adminNote ? `Reason: ${d.adminNote}` : "Voucher not verified. Please contact admin."}
                            </p>
                          )}
                          {d.status === "pending" && (
                            <p className="text-xs text-yellow-400/70 mt-1">Admin will verify and credit your wallet shortly.</p>
                          )}
                          {d.status === "approved" && (
                            <p className="text-xs text-indigo-300/80 mt-1">₹{d.amount} ({d.amount * 100} credits) added to your wallet.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <PageBar page={depPage} total={depositRequests.length} size={TX_PAGE_SIZE} onChange={setDepPage} />
                </>
              )
            )}

            {/* ── Rewards Tab (withdrawals) ── */}
            {historyTab === "rewards" && (
              withdrawalRequests.length === 0 ? (
                <div className="text-center py-12 text-dark-muted">
                  <p className="text-4xl mb-3">🎁</p>
                  <p className="text-sm">No redemption requests yet</p>
                  {!isGuest && balance >= 50 && (
                    <button onClick={() => setShowRedeem(true)}
                      className="mt-3 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#d8b4fe" }}>
                      Redeem Rewards
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-dark-muted mb-3">{withdrawalRequests.length} request{withdrawalRequests.length !== 1 ? "s" : ""}</p>
                  <div className="space-y-2">
                    {withdrawalRequests.slice((wdPage - 1) * TX_PAGE_SIZE, wdPage * TX_PAGE_SIZE).map((w: any) => {
                      const brandInfo = BRANDS.find(b => b.name === w.voucherBrand);
                      return (
                        <div key={w._id} className="rounded-2xl px-4 py-3"
                          style={{
                            background: w.status === "rejected" ? "rgba(255,60,60,0.05)" : w.status === "delivered" ? "rgba(99,102,241,0.06)" : w.status === "approved" ? "rgba(34,197,94,0.05)" : "rgba(251,191,36,0.04)",
                            border: `1px solid ${w.status === "rejected" ? "rgba(255,60,60,0.2)" : w.status === "delivered" ? "rgba(99,102,241,0.2)" : w.status === "approved" ? "rgba(34,197,94,0.2)" : "rgba(251,191,36,0.2)"}`,
                          }}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                                {brandInfo?.icon ?? "🎁"} {w.voucherBrand ?? "Reward"} — ₹{w.amount}
                              </p>
                              <p className="text-[10px] text-dark-muted mt-0.5">
                                {new Date(w.createdAt).toLocaleString("en-IN", {
                                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <StatusBadge status={w.status} />
                          </div>
                          {w.status === "rejected" && (
                            <p className="text-xs text-red-400/80 mt-2">{w.adminNote ? `Reason: ${w.adminNote}` : "Redemption could not be processed."}</p>
                          )}
                          {w.status === "pending" && (
                            <p className="text-xs text-yellow-400/70 mt-1">Admin will deliver your voucher within 24 hours.</p>
                          )}
                          {w.status === "approved" && (
                            <p className="text-xs text-green-400/70 mt-1">Voucher is being prepared for delivery.</p>
                          )}
                          {w.status === "delivered" && w.adminMessage && (
                            <p className="text-xs text-indigo-300/80 mt-1">{w.adminMessage}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <PageBar page={wdPage} total={withdrawalRequests.length} size={TX_PAGE_SIZE} onChange={setWdPage} />
                </>
              )
            )}

            {/* ── Received Vouchers Tab ── */}
            {historyTab === "received" && (
              deliveredVouchers.length === 0 ? (
                <div className="text-center py-12 text-dark-muted">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm">No vouchers received yet</p>
                  <p className="text-xs mt-1">Redeem rewards and admin will deliver vouchers here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveredVouchers.map((w: any) => {
                    const brandInfo = BRANDS.find(b => b.name === w.voucherBrand);
                    return (
                      <div key={w._id} className="rounded-2xl p-4 relative overflow-hidden"
                        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none opacity-10"
                          style={{ background: "radial-gradient(circle,#a78bfa,transparent)", transform: "translate(30%,-30%)" }} />
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{brandInfo?.icon ?? "🎁"}</span>
                            <div>
                              <p className="text-sm font-black text-white">{w.voucherBrand} Voucher</p>
                              <p className="text-xs text-indigo-300 font-semibold">₹{w.amount} value</p>
                            </div>
                          </div>
                          <StatusBadge status="delivered" />
                        </div>
                        <VoucherDetails voucher={w} />
                        <p className="text-[10px] text-dark-muted mt-2">
                          Delivered {new Date(w.deliveredAt ?? w.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showVoucherSubmit && (
          <VoucherSubmitModal onClose={() => setShowVoucherSubmit(false)} onSuccess={load} />
        )}
        {showRedeem && (
          <RedeemModal balance={balance} onClose={() => setShowRedeem(false)}
            onSuccess={(b) => { setBalance(b); load(); }} />
        )}
      </AnimatePresence>
    </Layout>
  );
}
