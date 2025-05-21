import pino from "pino";
import dotenv from "dotenv";

dotenv.config({
    quiet: process.env.NODE_ENV === 'test',
});

const env = process.env.NODE_ENV;

export const logger = pino({
    level: env === "test" ? "silent" : env === "development" ? "debug" : "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { pid: process.pid },
    transport: env === "development"
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "yyyy-mm-dd HH:MM:ss",
                ignore: "pid,hostname",
            },
        }
        : undefined,
});
