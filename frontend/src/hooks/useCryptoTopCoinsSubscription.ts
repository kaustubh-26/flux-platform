import { useEffect } from 'react';
import { useSocket } from '@/context/socketContext';
import { useAppDispatch } from '@/store/hooks';
import {
  topCoinsRequested,
  topCoinsReceived,
  topCoinsFailed,
} from '@/store/cryptoTopCoinsSlice';
import type { CryptoTopCoinsPayload } from '@/interfaces/crypto';

export function useCryptoTopCoinsSubscription() {
  const { socket, connected, userReady } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket || !connected || !userReady) return;

    const handler = (payload: CryptoTopCoinsPayload) => {
      if (payload?.status === 'success' && payload.data?.topCoins) {
        dispatch(topCoinsReceived(payload.data.topCoins));
      } else {
        dispatch(topCoinsFailed());
      }
    };

    socket.on('cryptoTopCoinsResponse', handler);
    dispatch(topCoinsRequested());
    socket.emit('cryptoTopCoinsRequest');

    return () => {
      socket.off('cryptoTopCoinsResponse', handler);
    };
  }, [socket, connected, userReady, dispatch]);
}
