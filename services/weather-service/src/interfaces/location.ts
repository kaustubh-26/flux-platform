import { z } from 'zod';

export const LocationSchema = z.object({
  city: z.string().min(1),
  region: z.string().min(1),
  country: z.string().min(1),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  ip: z.string().ip(),
});

export type Location = z.infer<typeof LocationSchema>;
