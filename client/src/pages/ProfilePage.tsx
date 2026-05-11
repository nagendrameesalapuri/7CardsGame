import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { Avatar, AVATARS } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { notify } from '../services/notify';

export function ProfilePage() {
  const { user, loadMe } = useAuthStore();
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar_1');
  const [isSaving, setIsSaving] = useState(false);

  // Load user data on mount only if not already loaded
  useEffect(() => {
    if (!user) loadMe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
                <h2 className="text-2xl font-bold text-dark-text mb-1">{user.username}</h2>
              )}

              <p className="text-dark-muted text-sm mb-1">
                {user.isGuest ? '👤 Guest Account' : '🟢 Registered'}
              </p>
              {user.email && <p className="text-dark-muted text-sm">{user.email}</p>}

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

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
      </motion.div>
    </Layout>
  );
}
