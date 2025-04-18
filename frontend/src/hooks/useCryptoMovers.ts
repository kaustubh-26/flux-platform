import { useEffect, useState } from 'react';
import { useSocket } from '@/context/socketContext';
import { CryptoMoversData, CryptoMoversPayload } from '@/interfaces/crypto';

export function useTopMovers() {
    const [movers, setMovers] = useState<CryptoMoversData | null>(null);
    const { socket } = useSocket();

    useEffect(() => {
        const handler = (payload: CryptoMoversPayload) => {
            if (payload.status === 'success' &&
                payload.data?.topGainers?.data &&
                payload.data?.topLosers?.data
            ) {
                setMovers(payload.data);
            }
        };

        socket?.on('cryptoTopMoversResponse', handler);

        // initial fetch
        socket?.emit('cryptoTopMoversRequest');

        return () => {
            void socket?.off('cryptoTopMoversResponse', handler);
        };
    }, [socket]);

    return movers;
}
