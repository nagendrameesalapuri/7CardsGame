import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { useSurvivalStore } from '../store/survivalStore';
import { GameBoard } from '../components/game/GameBoard';
import { socketGame, on } from '../services/socket';

export function GamePage() {
  const { game, room, forceEndedMsg, subscribeToEvents, leaveRoom, reset } = useGameStore();
  const { isAuthenticated } = useAuthStore();
  const { active: isSurvival } = useSurvivalStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }

    const unsub1 = subscribeToEvents();

    // Reconnect if we have a room but lost game state
    if (room && !game) {
      socketGame.reconnect(room.code);
    }

    return () => { unsub1(); };
  }, [isAuthenticated, navigate, subscribeToEvents, room, game]);

  // Auto-redirect to lobby when admin force-ends the game
  useEffect(() => {
    if (forceEndedMsg) {
      reset();
      navigate('/lobby', { replace: true });
    }
  }, [forceEndedMsg, navigate, reset]);

  // When a survival stage ends, leave the room and go to /survival
  // so the StageResultOverlay shows and the user can start the next stage.
  useEffect(() => {
    const unsub = on('survival:stage_result', (result) => {
      useSurvivalStore.setState((state) => ({
        currentStage: result.nextStage ?? state.currentStage,
        stageResults: result.stageResults,
        totalPointsEarned: result.totalPointsEarned ?? state.totalPointsEarned,
        stageResult: result as any,
        active: !result.tournamentOver,
      }));
      leaveRoom();
      navigate('/survival', { replace: true });
    });
    return unsub;
  }, [leaveRoom, navigate]);

  if (!isAuthenticated) return null;

  if (!game && !room && !isSurvival) {
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
