import { config } from 'dotenv';
import { z } from 'zod';

config({ quiet: true });

const MockConfigSchema = z.object({
  MOCK_SERVER_PORT: z.coerce.number().int().positive(),
  API_TOKEN: z.string().min(1),
});

export const mockConfig = Object.freeze(MockConfigSchema.parse(process.env));
