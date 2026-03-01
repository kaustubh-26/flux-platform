import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';

export function usePriceDelta(productId?: string) {
  const entry = useAppSelector(state =>
    productId ? state.cryptoPriceDelta.byProductId[productId] : undefined
  );

  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!entry?.flashUntil) return;

    const remaining = entry.flashUntil - Date.now();
    if (remaining <= 0) return;

    const t = setTimeout(() => {
      forceRender(v => v + 1);
    }, remaining);

    return () => clearTimeout(t);
  }, [entry?.flashUntil]);

  const direction = entry?.direction ?? null;
  const flash =
    entry?.flashUntil && entry.flashUntil > Date.now()
      ? entry.direction
      : null;

  return { direction, flash };
}
