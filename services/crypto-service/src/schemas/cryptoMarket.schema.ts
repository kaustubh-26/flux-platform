import { z } from "zod";

export const CryptoMarketSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string().url(),

  current_price: z.number(),

  market_cap: z.number().nullable(),
  market_cap_rank: z.number().nullable(),

  fully_diluted_valuation: z.number().nullable().optional(),
  total_volume: z.number().nullable(),

  high_24h: z.number().nullable(),
  low_24h: z.number().nullable(),

  price_change_24h: z.number().nullable(),
  price_change_percentage_24h: z.number().nullable(),

  market_cap_change_24h: z.number().nullable(),
  market_cap_change_percentage_24h: z.number().nullable(),

  circulating_supply: z.number().nullable(),
  total_supply: z.number().nullable(),
  max_supply: z.number().nullable(),

  ath: z.number(),
  ath_change_percentage: z.number(),
  ath_date: z.string().datetime(),

  atl: z.number(),
  atl_change_percentage: z.number(),
  atl_date: z.string().datetime(),

  roi: z
    .object({
      times: z.number(),
      currency: z.string(),
      percentage: z.number(),
    })
    .nullable(),

  last_updated: z.string().datetime(),

  price_change_percentage_1h_in_currency: z.number().nullable().optional(),
});

export const CryptoMarketListSchema = z.array(CryptoMarketSchema);
export type CryptoMarket = z.infer<typeof CryptoMarketSchema>;
