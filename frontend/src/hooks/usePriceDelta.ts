import { useEffect, useRef, useState } from 'react';

export function usePriceDelta(price?: number) {
  const prevRef = useRef<number | null>(null);

  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!flash) return;

    const t = setTimeout(() => setFlash(null), 500);
    return () => clearTimeout(t);
  }, [flash]);


  useEffect(() => {
    if (price == null) return;

    if (prevRef.current != null) {
      if (price > prevRef.current) {
        setDirection('up');
        setFlash('up');
      } else if (price < prevRef.current) {
        setDirection('down');
        setFlash('down');
      }
    }

    prevRef.current = price;
  }, [price]);

  return { direction, flash };
}
