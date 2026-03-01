import { useAppSelector } from '@/store/hooks';

export function useCryptoTickers() {
  return useAppSelector(state => state.cryptoTicker.byProductId);
}
