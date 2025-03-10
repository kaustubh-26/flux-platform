const DEDUP_WINDOW_MS = 2000; // 2s window
const CACHE_PREFIX = 'loc_dedup:';

export async function sendLocationIfChanged(valkeyClient: any, producer: any, socket: any, payload: any, logger: any) {
    const cacheKey = `${CACHE_PREFIX}${socket.id}`;
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
 
    try {
        // Send to Kafka
        await producer.send({
            topic: 'user.location.reported',
            messages: [{
                key: socket.id,
                value: JSON.stringify(payload)
            }]
        });
        logger.info({ socketId: socket.id }, 'Location update sent to Kafka');
    } catch (err) {
        logger.error({ err, socketId: socket.id }, 'Failed to process location update');
    }
    
}
