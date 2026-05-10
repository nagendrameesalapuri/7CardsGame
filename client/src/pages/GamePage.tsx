import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { GameBoard } from '../components/game/GameBoard';
import { socketGame } from '../services/socket';

export function GamePage() {
  const { game, room, subscribeToEvents } = useGameStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }

    const unsub = subscribeToEvents();

    // Reconnect if we have a room but lost game state
    if (room && !game) {
      socketGame.reconnect(room.code);
    }

    return unsub;
  }, [isAuthenticated, navigate, subscribeToEvents, room, game]);

  if (!isAuthenticated) return null;

  if (!game && !room) {
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

  return <GameBoard />;
}
