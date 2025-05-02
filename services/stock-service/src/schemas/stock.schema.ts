import { z } from "zod";

// -------------------------------------------------
// Types & Schemas
// -------------------------------------------------
export const quoteSchema = z.object({
  c: z.number(),  // current price
  h: z.number(),
  l: z.number(),
  o: z.number(),
  pc: z.number(), // previous close
});

export type Quote = z.infer<typeof quoteSchema>;

export interface StockPerformance {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
}