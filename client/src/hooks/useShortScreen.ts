import { useState, useEffect } from 'react';

/** Returns true when viewport height ≤ 479px (i.e. landscape phones). */
export function useShortScreen(): boolean {
  const [isShort, setIsShort] = useState(
    () => typeof window !== 'undefined' && window.innerHeight < 480
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-height: 479px)');
    const handler = (e: MediaQueryListEvent) => setIsShort(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isShort;
}
