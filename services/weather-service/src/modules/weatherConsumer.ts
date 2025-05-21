import { Producer, Consumer } from 'kafkajs';
import { WeatherService } from '../modules/weather';
import { LocationSchema } from '../interfaces/location';
import { logger } from '../logger';

export async function startWeatherConsumer(
  consumer: Consumer,
  producer: Producer
) {
  const weatherService = new WeatherService();
  let kafkaAvailable = false;

  await consumer.subscribe({
    topic: 'weather.service.command.fetch',
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        if (!kafkaAvailable) {
          kafkaAvailable = true;
          logger.info('Kafka recovered');
        }

        const value = message.value?.toString();
        if (!value) return;

        const raw = JSON.parse(value);
        const parsed = LocationSchema.safeParse(raw.data);

        if (!parsed.success) {
          logger.warn({ raw }, 'Invalid location payload');
          return;
        }

        const city = parsed.data.city;
        if (!city) return;

        const response = await weatherService.getData(city);

        await producer.send({
          topic: 'weather.service.event.updated',
          messages: [{ value: JSON.stringify(response) }],
        });

        logger.info({ city }, 'Weather update published');
      } catch (err) {
        kafkaAvailable = false;
        logger.error(
          { err, topic, value: message.value?.toString() },
          'Weather consumer failed'
        );
      }
    },
  });
}
