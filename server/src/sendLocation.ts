import { Producer } from "kafkajs";
import { Socket } from "socket.io";

const DEDUP_WINDOW_MS = 2000; // 2s window
const CACHE_PREFIX = 'loc_dedup:';

export async function sendLocationIfChanged(valkeyClient: any, producer: any, socket: any, payload: any, logger: any) {
    const cacheKey = `${CACHE_PREFIX}${payload.userId}`;
    const now = Date.now();

    const dataHash = JSON.stringify(payload.data);

    // Get last sent data from Valkey
    const lastSent = await valkeyClient.get(cacheKey);

    if (lastSent) {
        const last = JSON.parse(lastSent);
        // Skip if same data within window
        if (last.hash === dataHash && (now - last.timestamp) < DEDUP_WINDOW_MS) {
            return; // duplicate, do not send
        }
    }

    // Cache with TTL (expires automatically)
    const ttlSeconds = Math.ceil(DEDUP_WINDOW_MS / 1000) + 60;
    await valkeyClient.set(
        cacheKey,
        JSON.stringify({ hash: dataHash, timestamp: now }),
        'EX',
        ttlSeconds
    );

    await Promise.all([
        sendLocationToWeather(producer, socket, payload, logger),
        sendLocationToNews(producer, socket, payload, logger)
    ]);

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

async function sendLocationToNews(
    producer: Producer,
    socket: Socket,
    payload: any,
    logger: any
) {
    try {
        // Send to Kafka
        await producer.send({
            topic: 'news.service.command.refresh',
            messages: [{
                key: socket.id,
                value: JSON.stringify(payload)
            }]
        });
        logger.info({ socketId: socket.id }, 'Location update sent to News Service');
    } catch (err) {
        logger.error({ err, socketId: socket.id }, 'Failed to process location update');
    }

}
