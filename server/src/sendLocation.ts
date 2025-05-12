import { Producer } from "kafkajs";
import { Socket } from "socket.io";
import { cacheGet, cacheSet } from "./cache";
import pino from "pino";
import { Location } from "./interfaces/location";

const DEDUP_WINDOW_MS = 2000; // 2s window
const CACHE_PREFIX = 'loc_dedup:';

type LocationDedup = {
    hash: string;
    timestamp: number;
};
type Payload = {
    event: string,
    userId: string;
    data: Location,
    timestamp: string;
};

export async function sendLocationIfChanged(producer: Producer, socket: Socket, payload: Payload, logger: pino.Logger, isKafkaReady: () => boolean) {

    if (!isKafkaReady()) {
        logger.debug(
            { socketId: socket.id },
            "Kafka down, skipping location fan-out"
        );
        return;
    }

    const cacheKey = `${CACHE_PREFIX}${payload.userId}`;
    const now = Date.now();

    const dataHash = JSON.stringify(payload.data);

    // Get last sent data from Valkey
    const lastSent = await cacheGet<LocationDedup>(cacheKey);

    if (lastSent) {
        // Skip if same data within window
        if (lastSent.hash === dataHash && (now - lastSent.timestamp) < DEDUP_WINDOW_MS) {
            return; // duplicate, do not send
        }
    }

    // Cache with TTL (expires automatically)
    const ttlSeconds = Math.ceil(DEDUP_WINDOW_MS / 1000) + 60;
    await cacheSet(
        cacheKey,
        { hash: dataHash, timestamp: now },
        ttlSeconds
    );

   sendLocationToWeather(producer, socket, payload, logger);
}

async function sendLocationToWeather(
    producer: Producer,
    socket: Socket,
    payload: any,
    logger: any
) {
    try {
        // Send to Kafka
        await producer.send({
            topic: 'weather.service.command.fetch',
            messages: [{
                key: socket.id,
                value: JSON.stringify(payload)
            }]
        });
        logger.info({ socketId: socket.id }, 'Location update sent to Weather Service');
    } catch (err) {
        logger.error({ err, socketId: socket.id }, 'Failed to process location update');
    }
}
