import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzleCrud } from '../src/index.ts';
import { zod } from '../src/zod.ts';

const usersTable = sqliteTable('users', {
	id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull(),
	workspaceId: text('workspace_id').notNull(),
	role: text('role', { enum: ['admin', 'user'] })
		.notNull()
		.default('user'),
	deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

const client = createClient({
	url: 'libsql://drizzle-crud-brunowilliang.aws-eu-west-1.turso.io',
	authToken:
		'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTY3Mjg2ODcsImlkIjoiNDBlYmQyZWEtYjZiNi00NTFhLThmZDgtNjhkYjlhNzc0NWEwIiwicmlkIjoiY2ZiZWY0MmQtMjczMS00NWQzLWIwMjUtMTliYjg1NTI4ODkzIn0.1oVahTqEuwv9rSMIVk6W5qLUYT8vR0P5t6zqb5Dc4cbBycl4vt1cxQRJxed6EwM6PvEY3H9u7CRsILlT1F6kAw',
});

const db = drizzle(client, { schema: { users: usersTable } });

const createCrud = drizzleCrud(db, { validation: zod() });

const users = createCrud(usersTable, {
	allowedFilters: ['name', 'email'],
});

export async function testBulkCreate() {
	console.log('🏗️ Creating table...');

	// Create table first
	await client.execute(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL,
			workspace_id TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user',
			deleted_at INTEGER
		)
	`);

	console.log('👥 Testing bulkCreate...');

	// Bulk create users
	const result = await users.bulkCreate([
		{
			name: 'Bruno Garcia 1',
			email: 'bruno1@turso.com',
			workspaceId: 'workspace-test',
			role: 'admin',
		},
		{
			name: 'Bruno Garcia 2',
			email: 'bruno2@turso.com',
			workspaceId: 'workspace-test',
			role: 'user',
		},
		{
			name: 'Bruno Garcia 3',
			email: 'bruno3@turso.com',
			workspaceId: 'workspace-test',
			role: 'user',
		},
	]);

	console.log('✅ BulkCreate result:', result);
	console.log('🌍 Check your Turso dashboard - should have 3 new users!');

	return result;
}
