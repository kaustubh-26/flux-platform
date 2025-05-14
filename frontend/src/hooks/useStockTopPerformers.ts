import { useEffect, useState } from 'react';
import { useSocket } from '@/context/socketContext';
import type { MetaObject, StockMover } from '@/interfaces/stocks';

interface StockTopMoversState {
  timestamp: string;
  topGainers: StockMover[];
  topLosers: StockMover[];
}

export function useStockTopPerformers() {
  const [data, setData] = useState<StockTopMoversState | null>(null);
  const [metaData, setMetaData] = useState<MetaObject | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handler = (payload: any) => {
      if (
        payload?.status === 'success' &&
        payload?.data
      ) {
        setData({
          timestamp: payload.data.timestamp,
          topGainers: payload.data.topGainers,
          topLosers: payload.data.topLosers,
        });

        setMetaData(payload.data.meta)
      }
    };

    socket.on('stockTopPerformersResponse', handler);

    socket.emit('stockTopPerformersRequest');

    return () => {
      socket.off('stockTopPerformersResponse', handler);
    };
  }, [socket]);

  return { data, metaData }
}
