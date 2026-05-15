import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { usersApi, survivalApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { Avatar, AVATARS } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { notify } from '../services/notify';
import { useProgressionStore } from '../store/progressionStore';
import { AchievementBadge } from '../components/AchievementBadge';

const STAGE_NAMES = ['', 'Safe Bot', 'Aggressive Bot', 'Bluff Bot', 'Smart AI', 'Boss AI'];

export function ProfilePage() {
  const { user, loadMe } = useAuthStore();
  const { highestBadge, load: loadProgression } = useProgressionStore();
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar_1');
  const [isSaving, setIsSaving] = useState(false);
  const [survivalStats, setSurvivalStats] = useState<any>(null);

  // Load user data on mount only if not already loaded
  useEffect(() => {
    if (!user) loadMe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && !user.isGuest) {
      survivalApi.stats().then(r => setSurvivalStats(r.data)).catch(() => {});
      loadProgression();
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local state whenever user data arrives or changes
  useEffect(() => {
    if (user && !editMode) {
      setUsername(user.username);
      setSelectedAvatar(user.avatar ?? 'avatar_1');
    }
  }, [user?.username, user?.avatar]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-dark-muted animate-pulse text-sm">Loading profile…</div>
        </div>
      </Layout>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await usersApi.updateMe({ username, avatar: selectedAvatar });
      await loadMe();
      setEditMode(false);
      notify.success('Profile updated!');
    } catch {
      notify.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const gamesPlayed = user.stats?.gamesPlayed ?? 0;
  const gamesWon = user.stats?.gamesWon ?? 0;
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  const stats = [
    { label: 'Games Played', value: gamesPlayed },
    { label: 'Games Won', value: gamesWon },
    { label: 'Win Rate', value: `${winRate}%` },
    { label: 'Rounds Played', value: user.stats?.roundsPlayed ?? 0 },
  ];

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold font-game text-dark-text mb-8">Your Profile</h1>

        {/* Profile card */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <Avatar avatar={selectedAvatar} size="xl" username={user.username} />
              {editMode && (
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedAvatar(`avatar_${i + 1}`)}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-sm transition-all ${
                        selectedAvatar === `avatar_${i + 1}` ? 'ring-2 ring-neon-green scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {AVATARS[i]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              {editMode ? (
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value.slice(0, 20))}
                  className="w-full bg-dark-bg border-2 border-neon-green rounded-xl px-4 py-2 text-dark-text text-xl font-bold focus:outline-none mb-3"
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-2xl font-bold text-dark-text">{user.username}</h2>
                  {highestBadge && <AchievementBadge badge={highestBadge} size="md" />}
                </div>
              )}

              <p className="text-dark-muted text-sm mb-1">
                {user.isGuest ? '👤 Guest Account' : '🟢 Registered'}
              </p>
              {user.email && <p className="text-dark-muted text-sm">{user.email}</p>}

              <p className="text-dark-muted text-xs mt-1 font-mono flex items-center gap-2">
                ID: <span className="text-dark-text select-all">{user.id}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(user.id); notify.success('ID copied!'); }}
                  className="text-neon-green hover:text-green-400 text-[10px] underline underline-offset-2"
                >
                  Copy
                </button>
              </p>

              <div className="flex gap-3 mt-4">
                {editMode ? (
                  <>
                    <Button size="sm" onClick={() => setEditMode(false)} variant="ghost">Cancel</Button>
                    <Button size="sm" onClick={handleSave} loading={isSaving}>Save</Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
                    ✏️ Edit Profile
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Regular game stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-dark-surface border border-dark-border rounded-xl p-4 text-center"
            >
              <p className="text-2xl font-bold text-neon-green">{s.value}</p>
              <p className="text-dark-muted text-xs mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* AI Survival Championship stats */}
        {!user.isGuest && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🏆</span>
              <h2 className="text-sm font-bold text-dark-text uppercase tracking-wider">AI Survival Championship</h2>
            </div>

            {!survivalStats || survivalStats.runsPlayed === 0 ? (
              <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 text-center">
                <p className="text-3xl mb-2">⚔️</p>
                <p className="text-dark-muted text-sm">No survival runs yet.</p>
                <p className="text-dark-muted text-xs mt-1">Enter the AI Survival Championship to build your record.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Top summary row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Runs Played', value: survivalStats.runsPlayed, color: '#60a5fa', emoji: '🎮' },
                    { label: 'Champion', value: survivalStats.runsWon, color: '#fbbf24', emoji: '🏆' },
                    { label: 'Run Win %', value: `${survivalStats.runWinRate}%`, color: '#22c55e', emoji: '📈' },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.45 + i * 0.07 }}
                      className="rounded-2xl p-4 text-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xl mb-1">{s.emoji}</p>
                      <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-dark-muted mt-0.5">{s.label}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Second row: run outcomes */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Eliminated', value: survivalStats.runsLost, color: '#ff6b6b', emoji: '💀' },
                    { label: 'Abandoned', value: survivalStats.runsAbandoned, color: '#9ca3af', emoji: '↩️' },
                    { label: 'Best Stage', value: survivalStats.bestStage > 0 ? `${STAGE_NAMES[survivalStats.bestStage]}` : '—', color: '#a78bfa', emoji: '⭐', small: true },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.55 + i * 0.07 }}
                      className="rounded-2xl p-4 text-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xl mb-1">{s.emoji}</p>
                      <p className={`font-black ${s.small ? 'text-sm' : 'text-xl'}`} style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-dark-muted mt-0.5">{s.label}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Stage stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Stages Played', value: survivalStats.stagesPlayed, color: '#60a5fa', emoji: '🎯' },
                    { label: 'Stages Won', value: survivalStats.stagesWon, color: '#22c55e', emoji: '✅' },
                    { label: 'Stage Win %', value: `${survivalStats.stageWinRate}%`, color: '#fbbf24', emoji: '📊' },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.65 + i * 0.07 }}
                      className="rounded-2xl p-4 text-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xl mb-1">{s.emoji}</p>
                      <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-dark-muted mt-0.5">{s.label}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Earnings summary */}
                <div className="rounded-2xl p-4"
                  style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(234,88,12,0.06))', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <p className="text-[10px] text-dark-muted uppercase tracking-widest mb-3 text-center">Survival Earnings</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-red-400">−{survivalStats.totalSpent.toLocaleString()} pts</p>
                      <p className="text-[10px] text-dark-muted">≡ ₹{(survivalStats.totalSpent / 100).toFixed(0)}</p>
                      <p className="text-[10px] text-dark-muted mt-0.5">Total Spent</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-400">+{survivalStats.totalEarned.toLocaleString()} pts</p>
                      <p className="text-[10px] text-dark-muted">≡ ₹{(survivalStats.totalEarned / 100).toFixed(0)}</p>
                      <p className="text-[10px] text-dark-muted mt-0.5">Total Earned</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: survivalStats.netPoints >= 0 ? '#22c55e' : '#ff6b6b' }}>
                        {survivalStats.netPoints >= 0 ? '+' : ''}{survivalStats.netPoints.toLocaleString()} pts
                      </p>
                      <p className="text-[10px] text-dark-muted">
                        {survivalStats.netPoints >= 0 ? '+' : '−'}₹{(Math.abs(survivalStats.netPoints) / 100).toFixed(0)}
                      </p>
                      <p className="text-[10px] text-dark-muted mt-0.5">Net Profit</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
}
