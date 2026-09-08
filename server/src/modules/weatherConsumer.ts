import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import pino from 'pino';

export async function initWeatherConsumer(
  kafka: Kafka,
  io: Server,
  logger: pino.Logger,
  opts?: { fromBeginning?: boolean },
  onCrash?: () => void
) {
  const consumer = kafka.consumer({
    groupId: 'realtime-dashboard-weather',
    sessionTimeout: 60_000,    // 60s gives time during CPU spikes
    heartbeatInterval: 10_000,  // Heartbeat every 10s instead of every 3s
    rebalanceTimeout: 60_000,
  });

  // If Kafka ever disconnects this consumer, report it
  const crashEvent = consumer.events?.CRASH ?? 'consumer.crash';
  consumer.on?.(crashEvent, (e: any) => {
    logger.error({ err: e?.payload?.error }, 'Weather consumer crashed');
    onCrash?.();
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: 'weather.service.event.updated',
    fromBeginning: opts?.fromBeginning ?? false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      const payload = JSON.parse(message.value.toString());
      logger.info(`Payload: ${JSON.stringify(payload)}`)
      const city = payload.data?.city;
      if (!city) {
        logger.warn({ payload }, 'Weather payload missing city');
        return;
      }

      const room = `weather.${city}`;            // "weather.City"
      const eventName = `${room}.update`;        // "weather.City.update"
      logger.debug(`room: ${room}, eventName: ${eventName}`);

      let weatherData: any = {
        data: payload.data
      }
      if (payload.status == "success") {
        weatherData['status'] = 'success';
      }
      io.to(room).emit(eventName, weatherData);
      logger.debug({ topic, room, eventName }, 'Weather update emitted');
    }
  });

  logger.info('Weather consumer started');
  return consumer;
}
