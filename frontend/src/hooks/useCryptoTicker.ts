import { useEffect, useState } from 'react';
import { useSocket } from '@/context/socketContext';
import { CryptoTickerData } from '@/interfaces/cryptoTicker';

export function useCryptoTickers(isActive: boolean) {
  const [tickers, setTickers] = useState<Record<string, CryptoTickerData>>({});
  const { socket, connected, userReady } = useSocket();

  useEffect(() => {
    if (!socket || !connected || !userReady || !isActive) return;

    const handler = (payload: any) => {
      const ticker = payload?.data?.data;
      if (ticker?.type !== 'ticker') return;

      setTickers(prev => ({
        ...prev,
        [ticker.product_id]: ticker,
      }));
    };

    socket.on('cryptoTickerResponse', handler);

    return () => {
      socket.off('cryptoTickerResponse', handler);
    };
  }, [socket, connected, userReady, isActive]);

  return tickers;
}
