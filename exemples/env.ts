import { z } from 'zod';

// Schema completo
const envSchema = z.object({
	DATABASE_URL: z.url().startsWith('libsql://'),
	DATABASE_AUTH_TOKEN: z.string().min(1),
});

export const env = envSchema.parse(process.env);
