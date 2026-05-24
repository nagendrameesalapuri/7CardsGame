import { useState, useEffect } from 'react';
import { getNetworkQuality, subscribeNetworkQuality, NetworkQuality } from '../services/socket';

export function useNetworkQuality(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>(getNetworkQuality);
  useEffect(() => {
    setQuality(getNetworkQuality());
    return subscribeNetworkQuality(setQuality);
  }, []);
  return quality;
}
