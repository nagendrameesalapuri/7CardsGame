import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { admin } from '../services/api';

export function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Already logged in as admin
    if (localStorage.getItem('adminToken')) navigate('/admin', { replace: true });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await admin.login(password);
      localStorage.setItem('adminToken', res.data.token);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/30 to-dark-bg pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-dark-muted text-sm mt-1">Restricted area — authorised personnel only</p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(12,14,18,0.97)',
            border: '1px solid rgba(147,51,234,0.3)',
            boxShadow: '0 0 40px rgba(147,51,234,0.08)',
          }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-muted mb-1.5">Admin Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full bg-dark-bg border-2 border-dark-border rounded-xl px-4 py-3 text-dark-text placeholder-dark-muted focus:outline-none focus:border-purple-500 transition-colors text-base"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
              style={{
                background: loading || !password.trim()
                  ? 'rgba(147,51,234,0.3)'
                  : 'rgba(147,51,234,0.9)',
                color: 'white',
              }}
            >
              {loading ? 'Authenticating…' : 'Access Dashboard'}
            </button>
          </form>

          <button
            onClick={() => navigate('/')}
            className="w-full mt-4 py-2 text-dark-muted text-sm hover:text-dark-text transition-colors"
          >
            ← Back to Game
          </button>
        </div>
      </motion.div>
    </div>
  );
}
