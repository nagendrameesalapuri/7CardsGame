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
import { PlayerProfileModal } from '../components/ui/PlayerProfileModal';

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

// ── Premium Section Card ────────────────────────────────────────────────────
function SectionCard({
  title, icon, accent, delay = 0, children,
}: {
  title: string; icon: string; accent: string; delay?: number; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,12,20,0.97)', border: `1px solid ${accent}28` }}
    >
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${accent}90,transparent)` }} />
      {/* Corner glow */}
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: accent, opacity: 0.08, filter: 'blur(35px)' }} />

      {/* Header */}
      <div className="relative px-5 pt-4 pb-3 flex items-center gap-2.5"
        style={{ borderBottom: `1px solid ${accent}18` }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}>
          {icon}
        </div>
        <p className="text-sm font-black text-white tracking-wide">{title}</p>
        <div className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
      </div>

      <div className="relative p-4">{children}</div>
    </motion.div>
  );
}

// ── Grid stat cell ──────────────────────────────────────────────────────────
function StatCell({ label, value, color, icon }: {
  label: string; value: string | number; color?: string; icon?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="flex flex-col items-center justify-center text-center p-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {icon && <span className="text-lg mb-1">{icon}</span>}
      <p className="text-xl font-black leading-none" style={{ color: color ?? '#fff' }}>{value}</p>
      <p className="text-[9px] mt-1 font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
    </motion.div>
  );
}

// ── Earnings row ────────────────────────────────────────────────────────────
function EarningsBar({ spent, earned, net, accent }: { spent: number; earned: number; net: number; accent: string }) {
  return (
    <div className="rounded-xl p-3 grid grid-cols-3 gap-1 text-center mt-3"
      style={{ background: `linear-gradient(135deg,${accent}08,rgba(0,0,0,0.3))`, border: `1px solid ${accent}20` }}>
      <div>
        <p className="text-sm font-black text-red-400">−{spent.toLocaleString()}</p>
        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Spent</p>
      </div>
      <div>
        <p className="text-sm font-black text-green-400">+{earned.toLocaleString()}</p>
        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Earned</p>
      </div>
      <div>
        <p className="text-sm font-black" style={{ color: net >= 0 ? '#22c55e' : '#ff6b6b' }}>
          {net >= 0 ? '+' : ''}{net.toLocaleString()}
        </p>
        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Net</p>
      </div>
    </div>
  );
}

// ── Stage Journey ───────────────────────────────────────────────────────────
function StageJourney({ bestStage, accent }: { bestStage: number; accent: string }) {
  return (
    <div className="flex items-center gap-1 mb-3">
      {[1, 2, 3, 4, 5].map((s) => {
        const reached = bestStage >= s;
        const isBest = bestStage === s;
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1 rounded-full"
              style={{ background: reached ? accent : 'rgba(255,255,255,0.07)' }} />
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all"
              style={{
                background: reached ? `${accent}20` : 'rgba(255,255,255,0.04)',
                border: isBest ? `2px solid ${accent}` : reached ? `1px solid ${accent}60` : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isBest ? `0 0 14px ${accent}60` : undefined,
              }}>
              {STAGE_ICONS[s]}
            </div>
            <p className="text-[8px] text-center leading-tight" style={{ color: reached ? accent : 'rgba(255,255,255,0.25)' }}>
              {STAGE_NAMES[s].split(' ')[0]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex flex-col items-center py-6 gap-2">
      <span className="text-3xl">{emoji}</span>
      <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>{text}</p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user, loadMe } = useAuthStore();
  const { progress, highestBadge, load: loadProgression } = useProgressionStore();
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar_1');
  const [isSaving, setIsSaving] = useState(false);
  const [survivalStats, setSurvivalStats] = useState<any>(null);
  const [teamStats, setTeamStats] = useState<any>(null);
  const [mpStats, setMpStats] = useState<any>(null);
  const [allAchievements, setAllAchievements] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'history' | 'favorites'>('stats');
  const [tournamentTab, setTournamentTab] = useState<'solo' | 'team'>('solo');
  const [mpTab, setMpTab] = useState<'free' | 'wager'>('free');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Array<{ userId: string; username: string; avatar: string; addedAt: string; lastSeenAt?: string | null; isOnline?: boolean }>>([]);
  const [favRemoving, setFavRemoving] = useState<Set<string>>(new Set());
  const [favAdding, setFavAdding] = useState<Set<string>>(new Set());
  const [favSearch, setFavSearch] = useState('');
  const [favSearchResults, setFavSearchResults] = useState<Array<{ id: string; username: string; avatar: string }>>([]);
  const [favSearchLoading, setFavSearchLoading] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState<{ userId: string; username: string; avatar: string; isOnline: boolean; lastSeenAt: string | null } | null>(null);

  useEffect(() => { if (!user) loadMe(); }, []); // eslint-disable-line

  useEffect(() => {
    if (user) {
      const serverBadge = (user as any).selectedBadgeId as string | null | undefined;
      if (serverBadge) setSelectedBadgeId(serverBadge);
      else {
        const legacy = localStorage.getItem(`profileBadge_${user.id}`);
        if (legacy) setSelectedBadgeId(legacy);
      }
    }
  }, [user?.id]); // eslint-disable-line

  useEffect(() => {
    if (user && !user.isGuest) {
      survivalApi.stats().then(r => setSurvivalStats(r.data)).catch(() => {});
      survivalApi.teamStats().then(r => setTeamStats(r.data)).catch(() => {});
      gamesApi.multiplayerStats().then(r => setMpStats(r.data)).catch(() => {});
      loadProgression();
      progressionApi.achievements().then(r => setAllAchievements(r.data.achievements)).catch(() => {});
      gamesApi.history().then(r => setRecentGames(r.data.games.slice(0, 8))).catch(() => {});
      usersApi.getFavorites().then(r => setFavorites(r.data.favorites)).catch(() => {});
    }
  }, [user?.id]); // eslint-disable-line

  const removeFavorite = async (userId: string) => {
    setFavRemoving(prev => new Set(prev).add(userId));
    try {
      await usersApi.removeFavorite(userId);
      setFavorites(prev => prev.filter(f => f.userId !== userId));
    } catch {}
    setFavRemoving(prev => { const n = new Set(prev); n.delete(userId); return n; });
  };

  const addFavoriteById = async (u: { id: string; username: string; avatar: string }) => {
    setFavAdding(prev => new Set(prev).add(u.id));
    try {
      await usersApi.addFavorite(u.id);
      setFavorites(prev => [...prev, { userId: u.id, username: u.username, avatar: u.avatar, addedAt: new Date().toISOString() }]);
    } catch {}
    setFavAdding(prev => { const n = new Set(prev); n.delete(u.id); return n; });
  };

  useEffect(() => {
    const q = favSearch.trim();
    if (!q) { setFavSearchResults([]); return; }
    setFavSearchLoading(true);
    const t = setTimeout(() => {
      usersApi.search(q)
        .then(r => setFavSearchResults(r.data.users.filter(u => u.id !== user?.id).slice(0, 12)))
        .catch(() => setFavSearchResults([]))
        .finally(() => setFavSearchLoading(false));
    }, 320);
    return () => clearTimeout(t);
  }, [favSearch, user?.id]); // eslint-disable-line

  useEffect(() => {
    if (user && !editMode) {
      setUsername(user.username);
      setSelectedAvatar(user.avatar ?? 'avatar_1');
    }
  }, [user?.username, user?.avatar]); // eslint-disable-line

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
      await usersApi.updateMe({ username, avatar: selectedAvatar, selectedBadgeId: selectedBadgeId ?? null });
      localStorage.removeItem(`profileBadge_${user.id}`);
      await loadMe();
      setEditMode(false);
      notify.success('Profile updated!');
    } catch { notify.error('Failed to save profile'); }
    finally { setIsSaving(false); }
  };

  const gamesPlayed = user.stats?.gamesPlayed ?? 0;
  const gamesWon    = user.stats?.gamesWon ?? 0;
  const winRate     = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const roundsPlayed = user.stats?.roundsPlayed ?? 0;
  const roundsWon    = user.stats?.roundsWon ?? 0;
  const roundWinRate = roundsPlayed > 0 ? Math.round((roundsWon / roundsPlayed) * 100) : 0;
  const showRate     = Math.round(user.stats?.showSuccessRate ?? 0);

  const rank = progress?.rank ?? 'bronze';
  const rc   = RANK_CONFIG[rank] ?? RANK_CONFIG.bronze;
  const level = progress?.level ?? 1;
  const xp    = progress?.xp ?? 0;
  const xpProgress = progress?.xpProgress ?? 0;
  const xpNeeded   = progress?.xpNeeded ?? 100;
  const xpPct      = xpNeeded > 0 ? Math.round((xpProgress / xpNeeded) * 100) : 0;
  const winStreak    = progress?.winStreak ?? 0;
  const maxWinStreak = progress?.maxWinStreak ?? 0;

  const unlockedIds    = new Set((progress?.achievements ?? []).map((a: any) => a.id));
  const unlockedAchDefs = allAchievements.filter(a => unlockedIds.has(a.id));

  const displayBadge = (() => {
    if (selectedBadgeId) {
      const def = allAchievements.find(a => a.id === selectedBadgeId && unlockedIds.has(a.id));
      if (def) return { emoji: def.emoji, name: def.name, rarity: def.rarity };
    }
    return highestBadge;
  })();

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto pb-10">

        {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden mb-5"
          style={{
            background: `linear-gradient(135deg, rgba(12,14,22,0.98) 0%, rgba(20,20,40,0.98) 100%)`,
            border: `1px solid ${rc.color}33`,
            boxShadow: `0 0 40px ${rc.glow}, inset 0 0 60px rgba(0,0,0,0.4)`,
          }}
        >
          <div className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 pointer-events-none"
            style={{ background: rc.color, filter: 'blur(40px)' }} />

          <div className="relative p-6">
            <div className="flex items-start gap-5">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 0 3px ${rc.color}99, 0 0 20px ${rc.glow}` }} />
                <Avatar avatar={editMode ? selectedAvatar : user.avatar} size="xl" username={user.username} />
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2"
                  style={{ background: rc.color, borderColor: '#0d0f1a', color: '#000' }}>
                  {level}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {editMode ? (
                  <input value={username} onChange={e => setUsername(e.target.value.slice(0, 20))}
                    className="w-full bg-white/5 border-2 rounded-xl px-3 py-2 text-white text-xl font-bold focus:outline-none mb-2"
                    style={{ borderColor: rc.color }} />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-2xl font-black text-white">{user.username}</h2>
                    {displayBadge && <AchievementBadge badge={displayBadge} size="md" />}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: `${rc.color}22`, color: rc.color, border: `1px solid ${rc.color}55` }}>
                    {rc.icon} {rc.label} Rank
                  </span>
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {user.isGuest ? '👤 Guest' : '✅ Registered'}
                  </span>
                </div>
                <XPBar progress={xpProgress} xpNeeded={xpNeeded} pct={xpPct} />
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {user.email && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{user.email}</p>}
                  <button onClick={() => { navigator.clipboard.writeText(user.id); notify.success('ID copied!'); }}
                    className="text-[10px] px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                    ID: {user.id.slice(-8)} · Copy
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {editMode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-4">
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
                  {unlockedAchDefs.length > 0 && (
                    <div>
                      <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Choose display badge</p>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {unlockedAchDefs.map((ach) => {
                          const isActive = selectedBadgeId === ach.id;
                          const rc2: Record<string, string> = { legendary: '#fbbf24', epic: '#c084fc', rare: '#60a5fa', common: '#9ca3af' };
                          const col = rc2[ach.rarity] ?? '#9ca3af';
                          return (
                            <button key={ach.id} onClick={() => setSelectedBadgeId(isActive ? null : ach.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all"
                              style={{
                                background: isActive ? `${col}25` : 'rgba(255,255,255,0.05)',
                                border: isActive ? `2px solid ${col}` : `1px solid rgba(255,255,255,0.1)`,
                                color: isActive ? col : 'rgba(255,255,255,0.5)',
                                boxShadow: isActive ? `0 0 8px ${col}55` : 'none',
                              }}>
                              <span>{ach.emoji}</span><span>{ach.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

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

        {/* ── QUICK STATS ROW ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Games', value: gamesPlayed, color: '#60a5fa', icon: '🎮' },
            { label: 'Wins',  value: gamesWon,    color: '#00ff88', icon: '🏆' },
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

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-1.5 mb-5">
          {([
            ['stats', '📊', 'Stats'],
            ['achievements', '🎖️', 'Medals'],
            ['history', '📜', 'History'],
            ['favorites', '⭐', `Favs${favorites.length > 0 ? ` (${favorites.length})` : ''}`],
          ] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className="py-2 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5"
              style={activeTab === key
                ? { background: `${rc.color}22`, color: rc.color, border: `1px solid ${rc.color}55` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STATS TAB ───────────────────────────────────────────────── */}
          {activeTab === 'stats' && (
            <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* ① Multiplayer ─────────────────────────────────────────── */}
              <SectionCard title="Multiplayer" icon="🎮" accent="#60a5fa" delay={0}>
                {/* Free / Wager toggle */}
                <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {(['free', 'wager'] as const).map(t => (
                    <button key={t} onClick={() => setMpTab(t)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={mpTab === t
                        ? { background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)' }
                        : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
                      {t === 'free' ? '🆓 Free' : '💰 Wager'}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {mpTab === 'free' && (
                    <motion.div key="free" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <StatCell label="Games Played" value={mpStats?.free.played ?? gamesPlayed} color="#60a5fa" icon="🎮" />
                        <StatCell label="Total Wins"   value={mpStats?.free.won ?? gamesWon}       color="#00ff88" icon="🏆" />
                        <StatCell label="Win Rate"     value={`${mpStats?.free.winRate ?? winRate}%`} color={(mpStats?.free.winRate ?? winRate) >= 60 ? '#fbbf24' : (mpStats?.free.winRate ?? winRate) >= 40 ? '#60a5fa' : '#9ca3af'} icon="📈" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <StatCell label="Rounds"      value={mpStats?.free.roundsPlayed ?? 0} color="#818cf8" icon="🎲" />
                        <StatCell label="Rounds Won"  value={mpStats?.free.roundsWon ?? 0}    color="#00ff88" icon="✅" />
                        <StatCell label="Round Win %" value={`${mpStats?.free.roundWinRate ?? 0}%`} color={(mpStats?.free.roundWinRate ?? 0) >= 50 ? '#00ff88' : '#ff6b6b'} icon="📊" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <StatCell label="Win Streak"  value={winStreak}    color="#fbbf24" icon="🔥" />
                        <StatCell label="Best Streak" value={maxWinStreak} color="#f97316" icon="⚡" />
                        <StatCell label="Show Rate"   value={`${showRate}%`} color="#a78bfa" icon="🎯" />
                      </div>
                    </motion.div>
                  )}

                  {mpTab === 'wager' && (
                    <motion.div key="wager" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                      {!mpStats || mpStats.wager.played === 0 ? (
                        <EmptyState emoji="💰" text="No wager games played yet — join a paid room!" />
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <StatCell label="Games Played" value={mpStats.wager.played}  color="#60a5fa" icon="🎮" />
                            <StatCell label="Wins"         value={mpStats.wager.won}      color="#00ff88" icon="🏆" />
                            <StatCell label="Win Rate"     value={`${mpStats.wager.winRate}%`} color={mpStats.wager.winRate >= 60 ? '#fbbf24' : mpStats.wager.winRate >= 40 ? '#60a5fa' : '#9ca3af'} icon="📈" />
                          </div>
                          <EarningsBar
                            spent={mpStats.wager.totalSpent}
                            earned={mpStats.wager.totalEarned}
                            net={mpStats.wager.netProfit}
                            accent="#60a5fa"
                          />
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </SectionCard>

              {/* ② Play vs AI ───────────────────────────────────────────── */}
              {!user.isGuest && (
                <SectionCard title="Play vs AI" icon="🤖" accent="#a78bfa" delay={0.08}>
                  {!survivalStats || survivalStats.stagesPlayed === 0 ? (
                    <EmptyState emoji="⚔️" text="No AI battles yet — enter the survival gauntlet!" />
                  ) : (
                    <>
                      <StageJourney bestStage={survivalStats.bestStage} accent="#a78bfa" />
                      <div className="grid grid-cols-1 gap-2 mb-2">
                        <StatCell label="Best Stage"    value={survivalStats.bestStage > 0 ? STAGE_NAMES[survivalStats.bestStage] : '—'} color="#fbbf24" icon="⭐" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <StatCell label="Stages Played" value={survivalStats.stagesPlayed} color="#a78bfa" icon="🎲" />
                        <StatCell label="Stages Won"    value={survivalStats.stagesWon}    color="#00ff88" icon="✅" />
                        <StatCell label="Stage Win %"   value={`${survivalStats.stageWinRate}%`} color={survivalStats.stageWinRate >= 50 ? '#00ff88' : '#ff6b6b'} icon="📊" />
                      </div>
                    </>
                  )}
                </SectionCard>
              )}

              {/* ③ AI Champion Tournament ───────────────────────────────── */}
              {!user.isGuest && (
                <SectionCard title="AI Champion Tournament" icon="🏆" accent="#fbbf24" delay={0.16}>
                  {/* Solo / Team sub-toggle */}
                  <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {(['solo', 'team'] as const).map(t => (
                      <button key={t} onClick={() => setTournamentTab(t)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all capitalize"
                        style={tournamentTab === t
                          ? { background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }
                          : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
                        {t === 'solo' ? '⚔️ Solo' : '👥 Team'}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {tournamentTab === 'solo' && (
                      <motion.div key="solo" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                        {!survivalStats || survivalStats.runsPlayed === 0 ? (
                          <EmptyState emoji="🎯" text="No solo championship runs yet — entry fee required" />
                        ) : (
                          <>
                            <StageJourney bestStage={survivalStats.bestStage} accent="#fbbf24" />
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <StatCell label="Runs"        value={survivalStats.runsPlayed} color="#60a5fa" icon="🎮" />
                              <StatCell label="Champion"    value={survivalStats.runsWon}    color="#fbbf24" icon="🏆" />
                              <StatCell label="Run Win %"   value={`${survivalStats.runWinRate}%`} color="#22c55e" icon="📈" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <StatCell label="Eliminated"  value={survivalStats.runsLost}   color="#ff6b6b" icon="💀" />
                              <StatCell label="Abandoned"   value={survivalStats.runsAbandoned ?? 0} color="#f97316" icon="🚪" />
                              <StatCell label="Stage Win %"  value={`${survivalStats.stageWinRate}%`} color="#a78bfa" icon="📊" />
                            </div>
                            <EarningsBar spent={survivalStats.totalSpent} earned={survivalStats.totalEarned} net={survivalStats.netPoints} accent="#fbbf24" />
                          </>
                        )}
                      </motion.div>
                    )}

                    {tournamentTab === 'team' && (
                      <motion.div key="team" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                        {!teamStats || teamStats.runsPlayed === 0 ? (
                          <EmptyState emoji="👥" text="No team championship runs yet — grab a partner!" />
                        ) : (
                          <>
                            <StageJourney bestStage={teamStats.bestStage} accent="#fbbf24" />
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <StatCell label="Team Runs"   value={teamStats.runsPlayed} color="#60a5fa" icon="🎮" />
                              <StatCell label="Wins"        value={teamStats.runsWon}    color="#fbbf24" icon="🏆" />
                              <StatCell label="Win Rate"    value={`${teamStats.runWinRate}%`} color="#22c55e" icon="📈" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <StatCell label="Stage Win %" value={`${teamStats.stageWinRate}%`} color="#a78bfa" icon="📊" />
                              <StatCell label="Best Stage"  value={teamStats.bestStage > 0 ? STAGE_NAMES[teamStats.bestStage] : '—'} color="#fbbf24" icon="⭐" />
                              <StatCell label="Eliminated"  value={teamStats.runsLost}   color="#ff6b6b" icon="💀" />
                            </div>
                            <EarningsBar spent={teamStats.totalSpent} earned={teamStats.totalEarned} net={teamStats.netPoints} accent="#fbbf24" />
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SectionCard>
              )}
            </motion.div>
          )}

          {/* ── ACHIEVEMENTS TAB ────────────────────────────────────────── */}
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
                      const rc2: Record<string, string> = { legendary: '#fbbf24', epic: '#c084fc', rare: '#60a5fa', common: '#9ca3af' };
                      const col = rc2[ach.rarity] ?? '#9ca3af';
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
                              style={{ background: `${col}20`, color: col }}>{ach.rarity}</span>
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

          {/* ── HISTORY TAB ─────────────────────────────────────────────── */}
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
                      const myResult = g.myResult;
                      const won  = g.winnerId != null && g.winnerId === user.id;
                      const lost = g.winnerId != null && g.winnerId !== user.id;
                      const date = new Date(g.startedAt ?? g.endedAt);
                      return (
                        <motion.div key={g.id ?? i}
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-white">{won ? 'Victory' : lost ? 'Defeat' : 'Draw'}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={g.isAiGame
                                  ? { background: 'rgba(168,85,247,0.15)', color: '#c084fc' }
                                  : { background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                                {g.isAiGame ? '🤖 vs AI' : '👥 Multiplayer'}
                              </span>
                            </div>
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {g.players?.length ?? '?'} players · {g.roundsPlayed ?? g.rounds?.length ?? 0} rounds
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] font-bold" style={{ color: won ? '#00ff88' : lost ? '#ff6b6b' : '#9ca3af' }}>
                              {myResult?.totalScore !== undefined ? `${myResult.totalScore} pts` : '—'}
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

          {/* ── FAVORITES TAB ───────────────────────────────────────────── */}
          {activeTab === 'favorites' && (
            <motion.div key="favorites" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* ── Search bar ── */}
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  {favSearchLoading
                    ? <span className="text-sm animate-spin" style={{ color: 'rgba(250,204,21,0.6)' }}>⟳</span>
                    : <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>🔍</span>
                  }
                </div>
                <input
                  type="text"
                  value={favSearch}
                  onChange={e => setFavSearch(e.target.value)}
                  placeholder="Search players to add…"
                  className="w-full pl-9 pr-4 py-3 rounded-2xl text-sm font-medium outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: favSearch ? '1px solid rgba(250,204,21,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.85)',
                    caretColor: '#facc15',
                  }}
                />
                {favSearch && (
                  <button onClick={() => { setFavSearch(''); setFavSearchResults([]); }}
                    className="absolute inset-y-0 right-3 flex items-center text-xs"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>✕</button>
                )}
              </div>

              {/* ── Search results ── */}
              <AnimatePresence>
                {favSearch.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: 'rgba(10,8,28,0.98)', border: '1px solid rgba(250,204,21,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                  >
                    {favSearchResults.length === 0 && !favSearchLoading ? (
                      <div className="py-8 flex flex-col items-center gap-2">
                        <span style={{ fontSize: 28 }}>🔍</span>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>No players found</p>
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        {favSearchResults.map(u => {
                          const alreadyFav = favorites.some(f => f.userId === u.id);
                          const isAdding = favAdding.has(u.id);
                          return (
                            <div key={u.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                              onClick={() => setViewingPlayer({ userId: u.id, username: u.username, avatar: u.avatar, isOnline: false, lastSeenAt: null })}>
                              <Avatar avatar={u.avatar} size="sm" />
                              <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                {u.username}
                              </span>
                              {alreadyFav ? (
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-xl flex-shrink-0"
                                  style={{ background: 'rgba(250,204,21,0.12)', color: '#facc15', border: '1px solid rgba(250,204,21,0.3)' }}>
                                  ★ Added
                                </span>
                              ) : (
                                <motion.button
                                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                                  onClick={e => { e.stopPropagation(); addFavoriteById(u); }}
                                  disabled={isAdding}
                                  className="flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-xl transition-all"
                                  style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15', border: '1px solid rgba(250,204,21,0.35)' }}
                                >
                                  {isAdding ? '…' : '☆ Add'}
                                </motion.button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Saved favorites grid ── */}
              {!favSearch.trim() && (
                favorites.length === 0 ? (
                  <div className="rounded-2xl py-12 flex flex-col items-center gap-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: 40 }}>⭐</span>
                    <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>No favorites yet</p>
                    <p className="text-xs text-center px-8" style={{ color: 'rgba(255,255,255,0.22)' }}>
                      Search for players above or add opponents after a game
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Saved · {favorites.length}
                    </p>
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                      {favorites.map((fav, i) => {
                        const online = fav.isOnline ?? false;
                        const lastSeen = fav.lastSeenAt ?? null;
                        const lastSeenLabel = (() => {
                          if (online) return 'Online';
                          if (!lastSeen) return null;
                          const diff = Date.now() - new Date(lastSeen).getTime();
                          const mins  = Math.floor(diff / 60000);
                          const hours = Math.floor(diff / 3600000);
                          const days  = Math.floor(diff / 86400000);
                          if (mins  < 2)   return 'Just now';
                          if (mins  < 60)  return `${mins}m ago`;
                          if (hours < 24)  return `${hours}h ago`;
                          if (days  < 7)   return `${days}d ago`;
                          return new Date(lastSeen).toLocaleDateString([], { month: 'short', day: 'numeric' });
                        })();
                        return (
                          <motion.div
                            key={fav.userId}
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                            className="relative rounded-2xl overflow-hidden flex flex-col items-center pt-5 pb-4 px-3 gap-2 cursor-pointer"
                            onClick={() => setViewingPlayer({ userId: fav.userId, username: fav.username, avatar: fav.avatar, isOnline: online, lastSeenAt: lastSeen })}
                            whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(250,204,21,0.14)' }}
                            style={{
                              background: 'linear-gradient(160deg, rgba(15,12,35,0.97) 0%, rgba(10,8,28,0.99) 100%)',
                              border: `1px solid ${online ? 'rgba(74,222,128,0.35)' : 'rgba(250,204,21,0.2)'}`,
                              boxShadow: online ? '0 4px 20px rgba(74,222,128,0.08)' : '0 4px 20px rgba(250,204,21,0.06)',
                            }}
                          >
                            {/* Top accent bar — green if online, gold otherwise */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: online ? 'linear-gradient(90deg, rgba(74,222,128,0.8), rgba(74,222,128,0.1))' : 'linear-gradient(90deg, rgba(250,204,21,0.7), rgba(250,204,21,0.1))' }} />

                            {/* Avatar + online dot */}
                            <div className="relative">
                              <Avatar avatar={fav.avatar} size="lg" />
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                                style={{
                                  background: online ? '#22c55e' : 'rgba(250,204,21,0.25)',
                                  border: '2px solid rgba(8,7,20,0.99)',
                                  boxShadow: online ? '0 0 8px rgba(34,197,94,0.8)' : 'none',
                                  fontSize: online ? 0 : 9,
                                  color: '#facc15',
                                }}>
                                {!online && '★'}
                              </div>
                            </div>

                            {/* Name */}
                            <p className="text-xs font-black text-center truncate w-full" style={{ color: 'rgba(255,255,255,0.88)' }}>
                              {fav.username}
                            </p>

                            {/* Online / Last seen */}
                            {lastSeenLabel && (
                              <p className="text-[9px] font-bold" style={{ color: online ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                                {online && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1 align-middle" style={{ boxShadow: '0 0 4px #4ade80' }} />}
                                {lastSeenLabel}
                              </p>
                            )}

                            {/* Remove button — stop propagation so card click doesn't open modal */}
                            <motion.button
                              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                              onClick={e => { e.stopPropagation(); removeFavorite(fav.userId); }}
                              disabled={favRemoving.has(fav.userId)}
                              className="w-full rounded-xl py-1.5 text-[10px] font-black transition-all mt-0.5"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                            >
                              {favRemoving.has(fav.userId) ? '…' : '✕ Remove'}
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </>
                )
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {viewingPlayer && (
        <PlayerProfileModal
          userId={viewingPlayer.userId}
          username={viewingPlayer.username}
          avatar={viewingPlayer.avatar}
          isOnline={viewingPlayer.isOnline}
          lastSeenAt={viewingPlayer.lastSeenAt}
          onClose={() => setViewingPlayer(null)}
        />
      )}
    </Layout>
  );
}
