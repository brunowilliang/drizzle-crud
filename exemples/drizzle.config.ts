import { defineConfig } from 'drizzle-kit';
import { env } from './env';

export default defineConfig({
	schema: './exemples/schema.ts',
	out: './exemples/migrations',
	dialect: 'turso',
	dbCredentials: {
		url: env.DATABASE_URL,
		authToken: env.DATABASE_AUTH_TOKEN,
	},
});
