import { useAppSelector } from '@/store/hooks';

export function useCryptoTopCoins() {
  return useAppSelector(state => state.cryptoTopCoins.items);
}
