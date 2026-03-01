import { useEffect } from 'react';
import { useSocket } from '@/context/socketContext';
import { useAppDispatch } from '@/store/hooks';
import { tickerReceived } from '@/store/cryptoTickerSlice';
import { priceDeltaUpdated } from '@/store/cryptoPriceDeltaSlice';
import type { CryptoTickerPayload } from '@/interfaces/cryptoTicker';

export function useCryptoTickerSubscription() {
  const { socket, connected, userReady } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket || !connected || !userReady) return;

    const handler = (payload: CryptoTickerPayload | any) => {
      const ticker = payload?.data?.data ?? payload?.data;
      if (ticker?.type !== 'ticker') return;
      dispatch(tickerReceived(ticker));

      const priceNum = Number(ticker.price);
      if (Number.isFinite(priceNum)) {
        const now = Date.now();
        dispatch(
          priceDeltaUpdated({
            productId: ticker.product_id,
            price: priceNum,
            at: now,
          })
        );
      }
    };

    socket.on('cryptoTickerResponse', handler);
    return () => {
      socket.off('cryptoTickerResponse', handler);
    };
  }, [socket, connected, userReady, dispatch]);
}
