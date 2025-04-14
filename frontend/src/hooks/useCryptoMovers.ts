import { useEffect, useState } from 'react';
import { useSocket } from '@/context/socketContext';
import { CryptoMoversData, CryptoMoversPayload } from '@/interfaces/crypto';

export function useTopMovers() {
    const [movers, setMovers] = useState<CryptoMoversData | null>(null);
    const { socket } = useSocket();

    useEffect(() => {
        const handler = (payload: CryptoMoversPayload) => {
            console.log('payload', payload)
            if (payload.status === 'success' &&
                payload.data?.topGainers?.data &&
                payload.data?.topLosers?.data
            ) {
                setMovers(payload.data);
            }
        };

        socket?.on('topMoversResponse', handler);

        // initial fetch
        socket?.emit('topMoversRequest');

        return () => {
            void socket?.off('topMoversResponse', handler);
        };
    }, [socket]);

    return movers;
}
