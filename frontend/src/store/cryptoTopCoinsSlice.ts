import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { TopCoin } from '@/interfaces/crypto';

type CryptoTopCoinsState = {
  items: TopCoin[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  lastUpdated: number | null;
};

const initialState: CryptoTopCoinsState = {
  items: [],
  status: 'idle',
  lastUpdated: null,
};

const cryptoTopCoinsSlice = createSlice({
  name: 'cryptoTopCoins',
  initialState,
  reducers: {
    topCoinsRequested(state) {
      state.status = 'loading';
    },
    topCoinsReceived(state, action: PayloadAction<TopCoin[]>) {
      state.items = action.payload;
      state.status = 'ready';
      state.lastUpdated = Date.now();
    },
    topCoinsFailed(state) {
      state.status = 'error';
    },
  },
});

export const { topCoinsRequested, topCoinsReceived, topCoinsFailed } =
  cryptoTopCoinsSlice.actions;
export default cryptoTopCoinsSlice.reducer;
