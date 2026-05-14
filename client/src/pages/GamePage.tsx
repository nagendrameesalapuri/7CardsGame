import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { useTournamentStore } from '../store/tournamentStore';
import { GameBoard } from '../components/game/GameBoard';
import { TournamentResultOverlay } from '../components/game/TournamentResultOverlay';
import { socketGame } from '../services/socket';

export function GamePage() {
  const { game, room, forceEndedMsg, subscribeToEvents, reset } = useGameStore();
  const { isAuthenticated } = useAuthStore();
  const { subscribe: subscribeTournament, gameResult, active: tournamentActive } = useTournamentStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }

    const unsub1 = subscribeToEvents();
    const unsub2 = subscribeTournament();

    // Reconnect if we have a room but lost game state
    if (room && !game) {
      socketGame.reconnect(room.code);
    }

    return () => { unsub1(); unsub2(); };
  }, [isAuthenticated, navigate, subscribeToEvents, subscribeTournament, room, game]);

  // Auto-redirect to lobby when admin force-ends the game
  useEffect(() => {
    if (forceEndedMsg) {
      reset();
      navigate('/lobby', { replace: true });
    }
  }, [forceEndedMsg, navigate, reset]);

  if (!isAuthenticated) return null;

  if (!game && !room && !tournamentActive) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center gap-4">
        <p className="text-dark-muted text-lg">No active game found.</p>
        <button
          onClick={() => navigate('/lobby')}
          className="px-6 py-2 bg-neon-green text-dark-bg rounded-xl font-bold"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <>
      <GameBoard />
      {gameResult && <TournamentResultOverlay />}
    </>
  );
}
