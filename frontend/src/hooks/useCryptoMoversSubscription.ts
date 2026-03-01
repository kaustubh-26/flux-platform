import { useEffect } from 'react';
import { useSocket } from '@/context/socketContext';
import { useAppDispatch } from '@/store/hooks';
import {
  moversRequested,
  moversReceived,
  moversFailed,
} from '@/store/cryptoMoversSlice';
import type { CryptoMoversPayload } from '@/interfaces/crypto';

export function useCryptoMoversSubscription() {
  const { socket, connected, userReady } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket || !connected || !userReady) return;

    const handler = (payload: CryptoMoversPayload) => {
      if (
        payload?.status === 'success' &&
        payload.data?.topGainers?.data &&
        payload.data?.topLosers?.data
      ) {
        dispatch(moversReceived(payload.data));
      } else {
        dispatch(moversFailed());
      }
    };

    socket.on('cryptoTopMoversResponse', handler);
    dispatch(moversRequested());
    socket.emit('cryptoTopMoversRequest');

    return () => {
      socket.off('cryptoTopMoversResponse', handler);
    };
  }, [socket, connected, userReady, dispatch]);
}
