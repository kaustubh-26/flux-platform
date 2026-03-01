import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CryptoTickerData } from '@/interfaces/cryptoTicker';

type CryptoTickerState = {
  byProductId: Record<string, CryptoTickerData>;
  lastUpdatedById: Record<string, number>;
};

const initialState: CryptoTickerState = {
  byProductId: {},
  lastUpdatedById: {},
};

const cryptoTickerSlice = createSlice({
  name: 'cryptoTicker',
  initialState,
  reducers: {
    tickerReceived(state, action: PayloadAction<CryptoTickerData>) {
      const ticker = action.payload;
      state.byProductId[ticker.product_id] = ticker;
      state.lastUpdatedById[ticker.product_id] = Date.now();
    },
    resetTickers(state) {
      state.byProductId = {};
      state.lastUpdatedById = {};
    },
  },
});

export const { tickerReceived, resetTickers } = cryptoTickerSlice.actions;
export default cryptoTickerSlice.reducer;
