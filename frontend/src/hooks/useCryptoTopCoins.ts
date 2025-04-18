import { useEffect, useState } from 'react';
import { useSocket } from '@/context/socketContext';
import { CryptoTopCoinsPayload, TopCoin } from '@/interfaces/crypto';

export function useCryptoTopCoins() {
    const [coins, setTopCoins] = useState<TopCoin[] | null>(null);
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handler = (payload: CryptoTopCoinsPayload) => {
            if (payload.status === 'success' &&
                payload.data?.topCoins
            ) {
                setTopCoins(payload.data.topCoins);
            }
        };

        socket.on('cryptoTopCoinsResponse', handler);

        // initial subscribe / fetch
        socket.emit('cryptoTopCoinsRequest');

        return () => {
            socket.off('cryptoTopCoinsResponse', handler);
        };
    }, [socket]);

    return coins;
}
