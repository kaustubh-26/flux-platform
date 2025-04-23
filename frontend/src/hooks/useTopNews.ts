import { useEffect, useState } from 'react';
import { useSocket } from '@/context/socketContext';
import { NewsArticle, TopNewsPayload } from '@/interfaces/news';

export function useTopNews() {
  const [news, setNews] = useState<NewsArticle[] | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handler = (payload: TopNewsPayload) => {
        console.log('payload', payload)
      if (payload.status === 'success' && Array.isArray(payload.data)) {
        setNews(payload.data);
        console.log(news)
      }
    };

    // listen for updates
    socket.on('newsUpdate', handler);

    return () => {
      socket.off('newsUpdate', handler);
    };
  }, [socket]);

  return news;
}
