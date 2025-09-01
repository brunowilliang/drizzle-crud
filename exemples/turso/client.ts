import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { drizzleCrud } from '../../src';
import { zod } from '../../src/zod.ts';
import { users } from './schema';

const client = createClient({
	url: 'libsql://drizzle-crud-brunowilliang.aws-eu-west-1.turso.io',
	authToken:
		'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTY3Mjg2ODcsImlkIjoiNDBlYmQyZWEtYjZiNi00NTFhLThmZDgtNjhkYjlhNzc0NWEwIiwicmlkIjoiY2ZiZWY0MmQtMjczMS00NWQzLWIwMjUtMTliYjg1NTI4ODkzIn0.1oVahTqEuwv9rSMIVk6W5qLUYT8vR0P5t6zqb5Dc4cbBycl4vt1cxQRJxed6EwM6PvEY3H9u7CRsILlT1F6kAw',
});

const db = drizzle(client, { schema: { users } });

export const createCrud = drizzleCrud(db, { validation: zod() });

export const usersCrud = createCrud(users, {
	defaultItemsPerPage: 50,
	// maxItemsPerPage: 30,
	softDelete: { field: 'deletedAt' },
});
