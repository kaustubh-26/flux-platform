import pino from "pino";
import dotenv from "dotenv";

dotenv.config();

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
    level: isDev ? "debug" : "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { pid: process.pid },
    transport: isDev
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
