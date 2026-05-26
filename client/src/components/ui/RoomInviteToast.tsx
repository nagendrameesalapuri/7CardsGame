import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { on, socketRoom, socketTeam } from '../../services/socket';
import { walletApi } from '../../services/api';
import { Avatar } from './Avatar';
import { useGameStore } from '../../store/gameStore';
import { useSurvivalStore } from '../../store/survivalStore';
import { useAuthStore } from '../../store/authStore';

interface Invite {
  id: string;
  type: 'room' | 'team';
  // room
  roomCode?: string;
  roomName?: string;
  // team
  teamCode?: string;
  teamName?: string;
  tier?: string;
  // common
  inviterUsername: string;
  inviterAvatar: string;
  modeName: string;
  entryFee: number;
}

export function RoomInviteToast() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { room, game } = useGameStore();
  const { active: survivalActive, teamState } = useSurvivalStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    try {
      const unsubRoom = on('room:invite_received', data => {
        const invite: Invite = { ...data, type: 'room', id: `${Date.now()}-${Math.random()}` };
        setInvites(prev => [...prev.slice(-2), invite]);
        setTimeout(() => dismiss(invite.id), 30000);
      });
      const unsubTeam = on('survival:team_invite_received', data => {
        const invite: Invite = { ...data, type: 'team', id: `${Date.now()}-${Math.random()}` };
        setInvites(prev => [...prev.slice(-2), invite]);
        setTimeout(() => dismiss(invite.id), 30000);
      });
      return () => { unsubRoom(); unsubTeam(); };
    } catch {
      return undefined;
    }
  }, [user?.id]); // eslint-disable-line

  const dismiss = (id: string) => {
    setInvites(prev => prev.filter(i => i.id !== id));
    setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
  };

  const doJoinRoom = (invite: Invite) => {
    dismiss(invite.id);
    const unsub = on('room:joined', (joinedRoom) => {
      unsub();
      useGameStore.setState({
        room: joinedRoom,
        roomError: null,
        matchResult: null,
        game: null,
        lastAction: null,
        resumeRoomCodes: [],
        roundReadyUpdate: null,
        isMyTurn: false,
        canShow: false,
        underAttack: false,
        handTotal: 0,
        selectedCardIds: [],
      });
      navigate('/lobby');
    });
    socketRoom.join(invite.roomCode!);
  };

  const doJoinTeam = (invite: Invite) => {
    dismiss(invite.id);
    const unsub = on('survival:team_updated', (teamData: any) => {
      unsub();
      useSurvivalStore.setState({ teamState: teamData ?? null, teamError: null });
      navigate('/survival');
    });
    socketTeam.join(invite.teamCode!);
  };

  const accept = async (invite: Invite) => {
    // Free game or guest — join directly
    if (invite.entryFee === 0 || user?.isGuest) {
      invite.type === 'team' ? doJoinTeam(invite) : doJoinRoom(invite);
      return;
    }

    // Cash game — validate available balance first
    setCheckingIds(prev => new Set([...prev, invite.id]));
    setErrors(prev => { const e = { ...prev }; delete e[invite.id]; return e; });
    try {
      const res = await walletApi.get();
      const available = res.data.availableBalance;
      if (available >= invite.entryFee) {
        invite.type === 'team' ? doJoinTeam(invite) : doJoinRoom(invite);
      } else {
        const needed = (invite.entryFee - available).toFixed(2);
        setErrors(prev => ({ ...prev, [invite.id]: `Need ₹${needed} more to join` }));
      }
    } catch {
      setErrors(prev => ({ ...prev, [invite.id]: 'Could not verify balance' }));
    } finally {
      setCheckingIds(prev => { const s = new Set(prev); s.delete(invite.id); return s; });
    }
  };

  // Block invites when in ANY game state: active game, waiting room, survival, or team lobby
  const isInAnyGame = !!game || !!room || survivalActive || !!teamState;
  if (isInAnyGame) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: 340 }}>
      <AnimatePresence>
        {invites.map(invite => {
          const isChecking = checkingIds.has(invite.id);
          const error = errors[invite.id];
          const isCash = invite.entryFee > 0;
          const isTeam = invite.type === 'team';
          const accentColor = isTeam ? '#f59e0b' : '#6366f1';
          const label = isTeam ? '⚔️ Team Invite' : '🎮 Game Invite';
          const displayName = isTeam ? invite.teamName : invite.roomName;
          const displayCode = isTeam ? invite.teamCode : invite.roomCode;

          return (
            <motion.div
              key={invite.id}
              initial={{ opacity: 0, x: 80, scale: 0.92 }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit   ={{ opacity: 0, x: 80, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="pointer-events-auto rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(12,10,32,0.98) 0%, rgba(8,6,22,0.99) 100%)',
                border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : `${accentColor}66`}`,
                boxShadow: error
                  ? '0 8px 40px rgba(239,68,68,0.15), 0 2px 8px rgba(0,0,0,0.8)'
                  : `0 8px 40px ${accentColor}33, 0 2px 8px rgba(0,0,0,0.8)`,
              }}
            >
              {/* Top accent bar */}
              <div style={{
                height: 2,
                background: error
                  ? 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.2))'
                  : `linear-gradient(90deg, ${accentColor}, ${accentColor}33)`,
              }} />

              <div className="px-4 py-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <Avatar avatar={invite.inviterAvatar} size="md" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400"
                      style={{ border: '2px solid rgba(8,6,22,0.99)', boxShadow: '0 0 6px rgba(74,222,128,0.8)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: `${accentColor}99` }}>
                      {label}
                    </p>
                    <p className="text-sm font-black text-white truncate">{invite.inviterUsername}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>invited you to join</p>
                  </div>
                  <button
                    onClick={() => dismiss(invite.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all hover:bg-white/10"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                    ✕
                  </button>
                </div>

                {/* Room / Team info */}
                <div className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between"
                  style={{ background: `${accentColor}1a`, border: `1px solid ${accentColor}33` }}>
                  <div>
                    <p className="text-xs font-black text-white truncate" style={{ maxWidth: 160 }}>{displayName}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: `${accentColor}99` }}>{invite.modeName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isCash ? (
                      <>
                        <p className="text-xs font-black" style={{ color: '#fbbf24' }}>₹{invite.entryFee}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(251,191,36,0.5)' }}>entry fee</p>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                        Free
                      </span>
                    )}
                  </div>
                </div>

                {/* Code pill */}
                <div className="flex items-center gap-1 mb-3">
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Code:</span>
                  <span className="font-mono font-black text-sm tracking-widest" style={{ color: `${accentColor}cc` }}>
                    {displayCode}
                  </span>
                </div>

                {/* Insufficient balance error */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <span className="text-sm">⚠️</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold" style={{ color: '#f87171' }}>{error}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(248,113,113,0.6)' }}>Add funds to your wallet first</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={isChecking ? {} : { scale: 1.04 }}
                    whileTap={isChecking ? {} : { scale: 0.96 }}
                    onClick={() => !isChecking && accept(invite)}
                    disabled={isChecking}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black"
                    style={{
                      background: error
                        ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                        : isChecking
                        ? `${accentColor}66`
                        : isTeam
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#fff',
                      boxShadow: isChecking || error ? 'none' : `0 4px 16px ${accentColor}73`,
                      cursor: isChecking ? 'default' : 'pointer',
                    }}
                  >
                    {isChecking ? (
                      <span style={{ opacity: 0.7 }}>Checking…</span>
                    ) : error ? (
                      '💳 Add Funds'
                    ) : isTeam ? (
                      '⚔️ Join Team'
                    ) : (
                      '🎮 Join Now'
                    )}
                  </motion.button>
                  <button
                    onClick={() => dismiss(invite.id)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
