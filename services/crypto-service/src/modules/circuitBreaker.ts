import { logger } from "../logger"; // adjust import if needed

export type CircuitBreakerConfig = {
    name: string;
    failureThreshold: number;
    cooldownMs: number;
};

export class CircuitBreaker {
    private consecutiveFailures = 0;
    private openUntil = 0;

    constructor(private readonly config: CircuitBreakerConfig) {}

    isOpen(): boolean {
        return this.openUntil > Date.now();
    }

    guard(): boolean {
        if (this.isOpen()) {
            logger.warn(
                {
                    name: this.config.name,
                    openUntil: new Date(this.openUntil).toISOString(),
                },
                'Circuit breaker open, skipping external call'
            );
            return false;
        }
        return true;
    }

    success(): void {
        if (this.consecutiveFailures > 0) {
            logger.info(
                { name: this.config.name },
                'Circuit breaker reset after successful call'
            );
        }
        this.consecutiveFailures = 0;
        this.openUntil = 0;
    }

    failure(err?: unknown): void {
        this.consecutiveFailures++;

        if (this.consecutiveFailures >= this.config.failureThreshold) {
            this.openUntil = Date.now() + this.config.cooldownMs;

            logger.error(
                {
                    name: this.config.name,
                    failures: this.consecutiveFailures,
                    cooldownMs: this.config.cooldownMs,
                },
                'Circuit breaker opened'
            );
        } else {
            logger.warn(
                {
                    name: this.config.name,
                    failures: this.consecutiveFailures,
                    error:
                        err instanceof Error
                            ? err.message
                            : String(err),
                },
                'External call failed'
            );
        }
    }
}
