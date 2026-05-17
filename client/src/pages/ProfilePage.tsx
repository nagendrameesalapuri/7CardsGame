import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { usersApi, survivalApi, progressionApi, gamesApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { Avatar, AVATARS } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { notify } from '../services/notify';
import { useProgressionStore, RANK_CONFIG } from '../store/progressionStore';
import { AchievementBadge } from '../components/AchievementBadge';

const STAGE_NAMES = ['', 'Safe Bot', 'Aggressive Bot', 'Bluff Bot', 'Smart AI', 'Boss AI'];
const STAGE_ICONS = ['', '🛡️', '⚔️', '🃏', '🧠', '👑'];

function XPBar({ progress, xpNeeded, pct }: { progress: number; xpNeeded: number; pct: number }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
        <span>{progress.toLocaleString()} XP</span>
        <span>{xpNeeded.toLocaleString()} XP to next level</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ background: 'linear-gradient(90deg,#00ff88,#00d4ff)' }}
        />
      </div>
    </div>
  );
}

function StatPill({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="rounded-2xl p-4 flex flex-col items-center justify-center text-center"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.07)` }}
    >
      <span className="text-xl mb-1">{icon}</span>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
    </motion.div>
  );
}

export function ProfilePage() {
  const { user, loadMe } = useAuthStore();
  const { progress, highestBadge, load: loadProgression } = useProgressionStore();
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar_1');
  const [isSaving, setIsSaving] = useState(false);
  const [survivalStats, setSurvivalStats] = useState<any>(null);
  const [allAchievements, setAllAchievements] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'history'>('stats');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) loadMe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`profileBadge_${user.id}`);
      if (saved) setSelectedBadgeId(saved);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && !user.isGuest) {
      survivalApi.stats().then(r => setSurvivalStats(r.data)).catch(() => {});
      loadProgression();
      progressionApi.achievements().then(r => setAllAchievements(r.data.achievements)).catch(() => {});
      gamesApi.history().then(r => setRecentGames(r.data.games.slice(0, 8))).catch(() => {});
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (selectedBadgeId) localStorage.setItem(`profileBadge_${user.id}`, selectedBadgeId);
      else localStorage.removeItem(`profileBadge_${user.id}`);
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
  const roundsPlayed = user.stats?.roundsPlayed ?? 0;
  const roundsWon = user.stats?.roundsWon ?? 0;
  const roundWinRate = roundsPlayed > 0 ? Math.round((roundsWon / roundsPlayed) * 100) : 0;
  const showRate = Math.round(user.stats?.showSuccessRate ?? 0);

  const rank = progress?.rank ?? 'bronze';
  const rc = RANK_CONFIG[rank] ?? RANK_CONFIG.bronze;
  const level = progress?.level ?? 1;
  const xp = progress?.xp ?? 0;
  const xpProgress = progress?.xpProgress ?? 0;
  const xpNeeded = progress?.xpNeeded ?? 100;
  const xpPct = xpNeeded > 0 ? Math.round((xpProgress / xpNeeded) * 100) : 0;
  const winStreak = progress?.winStreak ?? 0;
  const maxWinStreak = progress?.maxWinStreak ?? 0;

  const unlockedIds = new Set((progress?.achievements ?? []).map((a: any) => a.id));

  // Compute display badge: user-selected > highestBadge fallback
  const displayBadge = (() => {
    if (selectedBadgeId) {
      const achDef = allAchievements.find((a) => a.id === selectedBadgeId && unlockedIds.has(a.id));
      if (achDef) return { emoji: achDef.emoji, name: achDef.name, rarity: achDef.rarity };
    }
    return highestBadge;
  })();

  // Unlocked achievement defs for badge picker
  const unlockedAchDefs = allAchievements.filter((a) => unlockedIds.has(a.id));

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto pb-8">

        {/* ── HERO BANNER ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden mb-5"
          style={{
            background: `linear-gradient(135deg, rgba(12,14,22,0.98) 0%, rgba(20,20,40,0.98) 100%)`,
            border: `1px solid ${rc.color}33`,
            boxShadow: `0 0 40px ${rc.glow}, inset 0 0 60px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '20px 20px' }} />

          {/* Rank glow blob */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 pointer-events-none"
            style={{ background: rc.color, filter: 'blur(40px)' }} />

          <div className="relative p-6">
            <div className="flex items-start gap-5">
              {/* Avatar ring */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 3px ${rc.color}99, 0 0 20px ${rc.glow}` }} />
                {editMode ? (
                  <Avatar avatar={selectedAvatar} size="xl" username={user.username} />
                ) : (
                  <Avatar avatar={user.avatar} size="xl" username={user.username} />
                )}
                {/* Level badge */}
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2"
                  style={{ background: rc.color, borderColor: '#0d0f1a', color: '#000' }}>
                  {level}
                </div>
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0">
                {editMode ? (
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value.slice(0, 20))}
                    className="w-full bg-white/5 border-2 rounded-xl px-3 py-2 text-white text-xl font-bold focus:outline-none mb-2"
                    style={{ borderColor: rc.color }}
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-2xl font-black text-white">{user.username}</h2>
                    {displayBadge && <AchievementBadge badge={displayBadge} size="md" />}
                  </div>
                )}

                {/* Rank chip */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: `${rc.color}22`, color: rc.color, border: `1px solid ${rc.color}55` }}>
                    {rc.icon} {rc.label} Rank
                  </span>
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {user.isGuest ? '👤 Guest' : '✅ Registered'}
                  </span>
                </div>

                {/* XP bar */}
                <XPBar progress={xpProgress} xpNeeded={xpNeeded} pct={xpPct} />

                {/* Email / ID */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {user.email && (
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{user.email}</p>
                  )}
                  <button
                    onClick={() => { navigator.clipboard.writeText(user.id); notify.success('ID copied!'); }}
                    className="text-[10px] px-2 py-0.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    ID: {user.id.slice(-8)} · Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Avatar + Badge picker (edit mode) */}
            <AnimatePresence>
              {editMode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-4">
                  {/* Avatar picker */}
                  <div>
                    <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Choose avatar</p>
                    <div className="grid grid-cols-6 gap-2">
                      {AVATARS.map((emoji, i) => (
                        <button key={i} onClick={() => setSelectedAvatar(`avatar_${i + 1}`)}
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all"
                          style={{
                            background: selectedAvatar === `avatar_${i + 1}` ? `${rc.color}33` : 'rgba(255,255,255,0.05)',
                            border: selectedAvatar === `avatar_${i + 1}` ? `2px solid ${rc.color}` : '2px solid transparent',
                            transform: selectedAvatar === `avatar_${i + 1}` ? 'scale(1.15)' : undefined,
                          }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Badge picker */}
                  {unlockedAchDefs.length > 0 && (
                    <div>
                      <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Choose display badge</p>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {unlockedAchDefs.map((ach) => {
                          const isActive = selectedBadgeId === ach.id;
                          const rarityColor: Record<string, string> = { legendary: '#fbbf24', epic: '#c084fc', rare: '#60a5fa', common: '#9ca3af' };
                          const col = rarityColor[ach.rarity] ?? '#9ca3af';
                          return (
                            <button key={ach.id}
                              onClick={() => setSelectedBadgeId(isActive ? null : ach.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all"
                              style={{
                                background: isActive ? `${col}25` : 'rgba(255,255,255,0.05)',
                                border: isActive ? `2px solid ${col}` : `1px solid rgba(255,255,255,0.1)`,
                                color: isActive ? col : 'rgba(255,255,255,0.5)',
                                boxShadow: isActive ? `0 0 8px ${col}55` : 'none',
                              }}>
                              <span>{ach.emoji}</span>
                              <span>{ach.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {!selectedBadgeId && (
                        <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Tap a badge to pin it to your profile</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Edit buttons */}
            <div className="flex gap-2 mt-4">
              {editMode ? (
                <>
                  <Button size="sm" onClick={() => setEditMode(false)} variant="ghost">Cancel</Button>
                  <Button size="sm" onClick={handleSave} loading={isSaving}>Save Changes</Button>
                </>
              ) : (
                <button onClick={() => setEditMode(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  ✏️ Edit Profile
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── QUICK STATS ROW ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Games', value: gamesPlayed, color: '#60a5fa', icon: '🎮' },
            { label: 'Wins', value: gamesWon, color: '#00ff88', icon: '🏆' },
            { label: 'Win %', value: `${winRate}%`, color: winRate >= 60 ? '#fbbf24' : winRate >= 40 ? '#60a5fa' : '#9ca3af', icon: '📈' },
            { label: 'Total XP', value: xp.toLocaleString(), color: rc.color, icon: '⭐' },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-base">{s.icon}</span>
              <p className="text-lg font-black mt-0.5" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── TABS ────────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5">
          {([['stats', '📊 Stats'], ['achievements', '🎖️ Achievements'], ['history', '📜 History']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1"
              style={activeTab === key
                ? { background: `${rc.color}22`, color: rc.color, border: `1px solid ${rc.color}55` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STATS TAB ───────────────────────────────────────────────────────── */}
          {activeTab === 'stats' && (
            <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Performance */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Performance</p>
                <div className="grid grid-cols-3 gap-3">
                  <StatPill label="Win Streak" value={winStreak} color="#fbbf24" icon="🔥" />
                  <StatPill label="Best Streak" value={maxWinStreak} color="#f97316" icon="⚡" />
                  <StatPill label="Show Rate" value={`${showRate}%`} color="#a78bfa" icon="🎯" />
                  <StatPill label="Rounds Played" value={roundsPlayed} color="#60a5fa" icon="🎲" />
                  <StatPill label="Rounds Won" value={roundsWon} color="#00ff88" icon="✅" />
                  <StatPill label="Round Win %" value={`${roundWinRate}%`} color={roundWinRate >= 50 ? '#00ff88' : '#ff6b6b'} icon="📊" />
                </div>
              </div>

              {/* AI Survival Championship */}
              {!user.isGuest && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <span className="text-base">🏆</span>
                    <p className="text-xs font-black uppercase tracking-widest text-white">AI Survival Championship</p>
                  </div>

                  {!survivalStats || survivalStats.runsPlayed === 0 ? (
                    <div className="px-4 pb-5 text-center">
                      <p className="text-3xl mb-1">⚔️</p>
                      <p className="text-xs text-dark-muted">No survival runs yet — challenge the AI gauntlet!</p>
                    </div>
                  ) : (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Stage journey */}
                      <div className="flex items-center justify-between gap-1 my-2">
                        {[1, 2, 3, 4, 5].map((s) => {
                          const reached = survivalStats.bestStage >= s;
                          const isBest = survivalStats.bestStage === s;
                          return (
                            <div key={s} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full h-1 rounded-full" style={{ background: reached ? '#fbbf24' : 'rgba(255,255,255,0.08)' }} />
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all`}
                                style={{
                                  background: reached ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.04)',
                                  border: isBest ? '2px solid #fbbf24' : reached ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                  boxShadow: isBest ? '0 0 12px rgba(251,191,36,0.4)' : undefined,
                                }}>
                                {STAGE_ICONS[s]}
                              </div>
                              <p className="text-[8px] text-center leading-tight" style={{ color: reached ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
                                {STAGE_NAMES[s].split(' ')[0]}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <StatPill label="Runs" value={survivalStats.runsPlayed} color="#60a5fa" icon="🎮" />
                        <StatPill label="Champion" value={survivalStats.runsWon} color="#fbbf24" icon="🏆" />
                        <StatPill label="Run Win %" value={`${survivalStats.runWinRate}%`} color="#22c55e" icon="📈" />
                        <StatPill label="Eliminated" value={survivalStats.runsLost} color="#ff6b6b" icon="💀" />
                        <StatPill label="Stage Win %" value={`${survivalStats.stageWinRate}%`} color="#a78bfa" icon="📊" />
                        <StatPill label="Best Stage" value={survivalStats.bestStage > 0 ? STAGE_NAMES[survivalStats.bestStage] : '—'} color="#fbbf24" icon="⭐" />
                      </div>

                      {/* Earnings */}
                      <div className="rounded-xl p-3 grid grid-cols-3 gap-2 text-center"
                        style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.06),rgba(234,88,12,0.06))', border: '1px solid rgba(251,191,36,0.12)' }}>
                        <div>
                          <p className="text-sm font-black text-red-400">−{survivalStats.totalSpent.toLocaleString()}</p>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Spent</p>
                        </div>
                        <div>
                          <p className="text-sm font-black text-green-400">+{survivalStats.totalEarned.toLocaleString()}</p>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Earned</p>
                        </div>
                        <div>
                          <p className="text-sm font-black" style={{ color: survivalStats.netPoints >= 0 ? '#22c55e' : '#ff6b6b' }}>
                            {survivalStats.netPoints >= 0 ? '+' : ''}{survivalStats.netPoints.toLocaleString()}
                          </p>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Net Profit</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── ACHIEVEMENTS TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'achievements' && (
            <motion.div key="ach" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Achievements</p>
                  <span className="text-xs font-bold" style={{ color: rc.color }}>{unlockedIds.size} / {allAchievements.length} unlocked</span>
                </div>
                {allAchievements.length === 0 ? (
                  <p className="text-center text-xs text-dark-muted py-4">Loading achievements…</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {allAchievements.map((ach) => {
                      const unlocked = unlockedIds.has(ach.id);
                      const rarityColor: Record<string, string> = {
                        legendary: '#fbbf24', epic: '#c084fc', rare: '#60a5fa', common: '#9ca3af',
                      };
                      const col = rarityColor[ach.rarity] ?? '#9ca3af';
                      return (
                        <motion.div key={ach.id} layout
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
                          style={{
                            background: unlocked ? `${col}10` : 'rgba(255,255,255,0.02)',
                            border: unlocked ? `1px solid ${col}40` : '1px solid rgba(255,255,255,0.05)',
                            opacity: unlocked ? 1 : 0.45,
                          }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: unlocked ? `${col}20` : 'rgba(255,255,255,0.04)', filter: unlocked ? undefined : 'grayscale(1)' }}>
                            {unlocked ? ach.emoji : '🔒'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{ach.name}</p>
                            <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{ach.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold capitalize"
                              style={{ background: `${col}20`, color: col }}>
                              {ach.rarity}
                            </span>
                            <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>+{ach.xpReward} XP</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <motion.div key="hist" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Recent Games</p>
                {recentGames.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-2">🎮</p>
                    <p className="text-xs text-dark-muted">No games played yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentGames.map((g: any, i) => {
                      const myResult = g.playerResults?.find((r: any) => r.userId === user.id);
                      const won = myResult?.outcome === 'won';
                      const lost = myResult?.outcome === 'lost';
                      const date = new Date(g.createdAt ?? g.endedAt);
                      return (
                        <motion.div key={g._id ?? i}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                          style={{
                            background: won ? 'rgba(0,255,136,0.06)' : lost ? 'rgba(255,107,107,0.06)' : 'rgba(255,255,255,0.03)',
                            border: won ? '1px solid rgba(0,255,136,0.2)' : lost ? '1px solid rgba(255,107,107,0.2)' : '1px solid rgba(255,255,255,0.06)',
                          }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                            style={{ background: won ? 'rgba(0,255,136,0.15)' : lost ? 'rgba(255,107,107,0.15)' : 'rgba(255,255,255,0.05)' }}>
                            {won ? '🏆' : lost ? '💀' : '🤝'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white">{won ? 'Victory' : lost ? 'Defeat' : 'Draw'}</p>
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {g.playerResults?.length ?? '?'} players · {g.rounds?.length ?? 0} rounds
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] font-bold" style={{ color: won ? '#00ff88' : lost ? '#ff6b6b' : '#9ca3af' }}>
                              {myResult?.totalPoints !== undefined ? `${myResult.totalPoints} pts` : '—'}
                            </p>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}
