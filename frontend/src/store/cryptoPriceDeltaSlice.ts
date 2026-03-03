import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type PricePoint = {
  price: number;
  at: number;
};

type PriceDeltaEntry = {
  lastPrice: number | null;
  direction: 'up' | 'down' | null;
  flashUntil: number | null;
  history: PricePoint[];
};

type CryptoPriceDeltaState = {
  byProductId: Record<string, PriceDeltaEntry>;
};

const FLASH_MS = 500;

const HISTORY_MAX_POINTS = 60;

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
        history: [],
      };

      if (entry.lastPrice != null && price !== entry.lastPrice) {
        entry.direction = price > entry.lastPrice ? 'up' : 'down';
        entry.flashUntil = at + FLASH_MS;
      }

      entry.lastPrice = price;

      const history = entry.history ?? [];
      const lastPoint = history[history.length - 1];

      if (!lastPoint || lastPoint.price !== price) {
        history.push({ price, at });

        if (history.length > HISTORY_MAX_POINTS) {
          history.splice(0, history.length - HISTORY_MAX_POINTS);
        }
      }

      entry.history = history;
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
