import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { admin } from "../services/api";
import { useAuthStore } from "../store/authStore";

export function AdminLoginPage() {
  const [password,  setPassword]  = useState("");
  const [totpCode,  setTotpCode]  = useState("");
  const [needs2FA,  setNeeds2FA]  = useState(false);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  useEffect(() => {
    if (user?.isAdmin && token) {
      localStorage.setItem("adminToken", token);
      navigate("/admin", { replace: true });
      return;
    }
    if (localStorage.getItem("adminToken"))
      navigate("/admin", { replace: true });
  }, [navigate, user, token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = password.trim();
    if (!pw) return;
    setLoading(true);
    setError("");
    try {
      const res = await admin.login(pw, totpCode.trim() || undefined);
      localStorage.setItem("adminToken", res.data.token);
      navigate("/admin", { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.requires2FA) {
        setNeeds2FA(true);
        setError("");
      } else {
        setError(data?.error ?? "Invalid credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/30 to-dark-bg pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">{needs2FA ? '🔑' : '🔐'}</div>
          <h1 className="text-2xl font-bold text-white">
            {needs2FA ? 'Two-Factor Auth' : 'Admin Access'}
          </h1>
          <p className="text-dark-muted text-sm mt-1">
            {needs2FA
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Restricted area — authorised personnel only'}
          </p>
        </div>

        <div className="rounded-2xl p-8"
          style={{
            background: "rgba(12,14,18,0.97)",
            border: "1px solid rgba(147,51,234,0.3)",
            boxShadow: "0 0 40px rgba(147,51,234,0.08)",
          }}>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Password field — hidden once 2FA step is reached */}
            <AnimatePresence>
              {!needs2FA && (
                <motion.div
                  initial={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}>
                  <label className="block text-sm text-dark-muted mb-1.5">Admin Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoFocus
                    className="w-full bg-dark-bg border-2 border-dark-border rounded-xl px-4 py-3 text-dark-text placeholder-dark-muted focus:outline-none focus:border-purple-500 transition-colors text-base"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2FA code field — shown after password accepted */}
            <AnimatePresence>
              {needs2FA && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}>
                  <label className="block text-sm text-dark-muted mb-1.5">Authenticator Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    maxLength={7}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="w-full bg-dark-bg border-2 border-dark-border rounded-xl px-4 py-3 text-dark-text placeholder-dark-muted focus:outline-none focus:border-purple-500 transition-colors text-2xl tracking-widest text-center font-mono"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || (!needs2FA && !password.trim()) || (needs2FA && totpCode.length < 6)}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
              style={{
                background: loading ? "rgba(147,51,234,0.3)" : "rgba(147,51,234,0.9)",
                color: "white",
              }}>
              {loading ? "Verifying…" : needs2FA ? "Verify Code" : "Continue"}
            </button>

            {needs2FA && (
              <button type="button" onClick={() => { setNeeds2FA(false); setTotpCode(""); setError(""); }}
                className="w-full py-2 text-dark-muted text-sm hover:text-dark-text transition-colors">
                ← Back
              </button>
            )}
          </form>

          {!needs2FA && (
            <button onClick={() => navigate("/")}
              className="w-full mt-4 py-2 text-dark-muted text-sm hover:text-dark-text transition-colors">
              ← Back to Game
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
