import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CryptoMoversData } from '@/interfaces/crypto';

type CryptoMoversState = {
  data: CryptoMoversData | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  lastUpdated: number | null;
};

const initialState: CryptoMoversState = {
  data: null,
  status: 'idle',
  lastUpdated: null,
};

const cryptoMoversSlice = createSlice({
  name: 'cryptoMovers',
  initialState,
  reducers: {
    moversRequested(state) {
      state.status = 'loading';
    },
    moversReceived(state, action: PayloadAction<CryptoMoversData>) {
      state.data = action.payload;
      state.status = 'ready';
      state.lastUpdated = Date.now();
    },
    moversFailed(state) {
      state.status = 'error';
    },
    resetMovers(state) {
      state.data = null;
      state.status = 'idle';
      state.lastUpdated = null;
    },
  },
});

export const { moversRequested, moversReceived, moversFailed, resetMovers } =
  cryptoMoversSlice.actions;
export default cryptoMoversSlice.reducer;
