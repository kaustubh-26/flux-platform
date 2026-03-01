import { useAppSelector } from '@/store/hooks';

export function useTopMovers() {
    return useAppSelector(state => state.cryptoMovers.data);
}
