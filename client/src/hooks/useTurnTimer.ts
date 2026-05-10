import { useEffect, useState } from 'react';

export function useTurnTimer(
  turnStartTime: string | undefined,
  turnTimeLimit: number,  // seconds
  active: boolean,
) {
  const [secondsLeft, setSecondsLeft] = useState(turnTimeLimit);
  const [progress, setProgress] = useState(1); // 0–1

  useEffect(() => {
    if (!active || !turnStartTime) {
      setSecondsLeft(turnTimeLimit);
      setProgress(1);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - new Date(turnStartTime).getTime()) / 1000;
      const remaining = Math.max(0, turnTimeLimit - elapsed);
      setSecondsLeft(Math.ceil(remaining));
      setProgress(remaining / turnTimeLimit);
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [turnStartTime, turnTimeLimit, active]);

  const isWarning = secondsLeft <= 10;
  const isCritical = secondsLeft <= 5;

  return { secondsLeft, progress, isWarning, isCritical };
}
