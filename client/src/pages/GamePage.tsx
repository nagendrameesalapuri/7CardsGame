import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { useSurvivalStore } from "../store/survivalStore";
import { GameBoard } from "../components/game/GameBoard";
import { socketGame, on } from "../services/socket";

export function GamePage() {
  const {
    game,
    room,
    matchResult,
    forceEndedMsg,
    subscribeToEvents,
    leaveRoom,
    reset,
    resumeRoomCodes,
    resumeGame,
  } = useGameStore();
  const { isAuthenticated } = useAuthStore();
  const { active: isSurvival } = useSurvivalStore();
  const navigate = useNavigate();

  // Grace period: wait up to 4s for reconnect response before showing "no game"
  const [connecting, setConnecting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setConnecting(false), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    const unsub1 = subscribeToEvents();

    // Reconnect if we have a room but lost game state (skip if match already ended)
    if (room && !game && !matchResult) {
      socketGame.reconnect(room.code);
    }

    return () => {
      unsub1();
    };
  }, [isAuthenticated, navigate, subscribeToEvents, room, game, matchResult]);

  // Auto-redirect to lobby when admin force-ends the game
  useEffect(() => {
    if (forceEndedMsg) {
      reset();
      navigate("/lobby", { replace: true });
    }
  }, [forceEndedMsg, navigate, reset]);

  // Tournament round transition: when a new tournament room is ready, auto-join it
  useEffect(() => {
    const tCode = resumeRoomCodes.find((c) => c.startsWith('T'));
    if (tCode && !game) {
      resumeGame(tCode);
    }
  }, [resumeRoomCodes, game, resumeGame]);

  // When a survival tiebreaker is triggered, set tiebreaker state and go to /survival
  useEffect(() => {
    const unsub = on("survival:tiebreaker", (result: any) => {
      const state = useSurvivalStore.getState();
      const stageNum = typeof result?.stage === "number" ? result.stage : NaN;
      if (
        Number.isNaN(stageNum) ||
        (stageNum !== state.currentStage && stageNum !== state.currentStage - 1)
      ) {
        console.warn("[GamePage] Ignored spurious survival:tiebreaker", {
          receivedStage: result?.stage,
          currentStage: state.currentStage,
        });
        return;
      }

      useSurvivalStore.setState({ tiebreakerResult: result });
      leaveRoom();
      navigate("/survival", { replace: true });
    });
    return unsub;
  }, [leaveRoom, navigate]);

  // When a survival stage ends, leave the room and go to /survival
  useEffect(() => {
    const unsub = on("survival:stage_result", (result) => {
      useSurvivalStore.setState((state) => ({
        currentStage: result.nextStage ?? state.currentStage,
        stageResults: result.stageResults,
        totalPointsEarned: result.totalPointsEarned ?? state.totalPointsEarned,
        stageResult: result as any,
        active: !result.tournamentOver,
      }));
      leaveRoom();
      navigate("/survival", { replace: true });
    });
    return unsub;
  }, [leaveRoom, navigate]);

  // When a team survival stage ends, update store and navigate to /survival so the result overlay can show
  useEffect(() => {
    const unsub = on("survival:team_stage_result", (result: any) => {
      useSurvivalStore.setState((state) => ({
        teamState: state.teamState
          ? {
              ...state.teamState,
              currentStage: result.nextStage ?? state.teamState.currentStage,
              currentRoomCode: result.tournamentOver
                ? null
                : (result.nextRoomCode ?? state.teamState.currentRoomCode),
              stageResults: [
                ...(state.teamState.stageResults ?? []),
                {
                  stage: result.stage,
                  teamScore: result.teamScore,
                  botTotalScore: result.botTotalScore,
                  botScores: result.botScores,
                  botNames: result.botNames,
                  teamWon: result.teamWon,
                  pointsEarned: result.pointsEarned,
                  isTeamMode: true as const,
                },
              ],
              totalPointsEarned:
                result.totalPointsEarned ?? state.teamState.totalPointsEarned,
            }
          : state.teamState,
        teamStageResult: result,
      }));
      leaveRoom();
      navigate("/survival", { replace: true });
    });
    return unsub;
  }, [leaveRoom, navigate]);

  if (!isAuthenticated) return null;

  if (!game && !room && !isSurvival) {
    const hasTournamentRoom = resumeRoomCodes.some((c) => c.startsWith('T'));
    if (hasTournamentRoom || connecting) {
      // Auto-join in progress or still waiting for reconnect response
      return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center gap-3">
          <div className="text-4xl animate-pulse">⚔️</div>
          <p className="text-white font-bold text-lg">
            {hasTournamentRoom ? 'Joining tournament room…' : 'Connecting to game…'}
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Please wait</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center gap-4">
        <p className="text-dark-muted text-lg">No active game found.</p>
        <button
          onClick={() => navigate("/lobby")}
          className="px-6 py-2 bg-neon-green text-dark-bg rounded-xl font-bold"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return <GameBoard />;
}
