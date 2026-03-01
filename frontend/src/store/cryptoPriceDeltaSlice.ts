import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type PriceDeltaEntry = {
  lastPrice: number | null;
  direction: 'up' | 'down' | null;
  flashUntil: number | null;
};

type CryptoPriceDeltaState = {
  byProductId: Record<string, PriceDeltaEntry>;
};

const FLASH_MS = 500;

const initialState: CryptoPriceDeltaState = {
  byProductId: {},
};

const cryptoPriceDeltaSlice = createSlice({
  name: 'cryptoPriceDelta',
  initialState,
  reducers: {
    priceDeltaUpdated(
      state,
      action: PayloadAction<{ productId: string; price: number; at: number }>
    ) {
      const { productId, price, at } = action.payload;
      if (!productId || !Number.isFinite(price)) return;

      const entry = state.byProductId[productId] ?? {
        lastPrice: null,
        direction: null,
        flashUntil: null,
      };

      if (entry.lastPrice != null && price !== entry.lastPrice) {
        entry.direction = price > entry.lastPrice ? 'up' : 'down';
        entry.flashUntil = at + FLASH_MS;
      }

      entry.lastPrice = price;
      state.byProductId[productId] = entry;
    },
    resetPriceDelta(state) {
      state.byProductId = {};
    },
  },
});

export const { priceDeltaUpdated, resetPriceDelta } =
  cryptoPriceDeltaSlice.actions;
export default cryptoPriceDeltaSlice.reducer;
