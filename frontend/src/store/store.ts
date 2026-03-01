import { configureStore } from '@reduxjs/toolkit';
import cryptoTickerReducer from './cryptoTickerSlice';
import cryptoTopCoinsReducer from './cryptoTopCoinsSlice';
import cryptoPriceDeltaReducer from './cryptoPriceDeltaSlice';
import cryptoMoversReducer from './cryptoMoversSlice';

export const store = configureStore({
  reducer: {
    cryptoTicker: cryptoTickerReducer,
    cryptoTopCoins: cryptoTopCoinsReducer,
    cryptoPriceDelta: cryptoPriceDeltaReducer,
    cryptoMovers: cryptoMoversReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
