import { CircuitBreaker } from "./circuitBreaker";

export const coinGeckoBreaker = new CircuitBreaker({
    name: "coingecko-markets-api",
    failureThreshold: 3,
    cooldownMs: 60_000, // 1 minute
});
