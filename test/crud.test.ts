import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod/v4';
import { drizzleCrud, filtersToWhere } from '../src/index.ts';
import { zod } from '../src/zod.ts';

const usersTable = sqliteTable('users', {
	id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
	name: text('name'),
	email: text('email'),
});

// Global variables for isolated test setup
let db: any;
let createCrud: any;

describe('drizzleCrud', () => {
	beforeEach(() => {
		// Fresh database for each test
		const sqlite = new Database(':memory:');
		db = drizzle(sqlite, { schema: { users: usersTable } });

		// Create table
		sqlite.run(`
			CREATE TABLE users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT,
				email TEXT
			)
		`);

		createCrud = drizzleCrud(db);
	});
	it('should create a crud instance', () => {
		expect(createCrud).toBeDefined();
	});

	it('should create a user without validation', async () => {
		const users = createCrud(usersTable);

		const user = await users.create({
			name: 'John Doe',
			email: 'john.doe@example.com',
		});

		expect(user).toEqual({
			id: 1,
			name: 'John Doe',
			email: 'john.doe@example.com',
		});
	});

	it('should validate with zod', async () => {
		const validation = zod();
		const crudWithValidation = drizzleCrud(db, { validation });
		const users = crudWithValidation(usersTable);

		const user = await users.create({
			name: 'John Doe',
			email: 'john.doe@example.com',
		});

		expect(user).toEqual({
			id: 1,
			name: 'John Doe',
			email: 'john.doe@example.com',
		});
	});

	it('should validate with custom zod schemas', async () => {
		const validation = zod({
			insert: () =>
				z.object({
					name: z.string(),
					email: z.email(),
				}),
			pagination(options) {
				return z.object({
					page: z.number().int().positive().optional().default(1),
					perPage: z
						.number()
						.int()
						.positive()
						.optional()
						.default(options.defaultItemsPerPage ?? 10),
				});
			},
		});

		const crudWithValidation = drizzleCrud(db, { validation });
		const users = crudWithValidation(usersTable);

		const user = await users.create({
			name: 'John Doe',
			email: 'john.doe@example.com',
		});

		expect(user).toEqual({
			id: 1,
			name: 'John Doe',
			email: 'john.doe@example.com',
		});
	});

	it('should validate with custom local zod schemas', async () => {
		const crudWithValidation = drizzleCrud(db, { validation: zod() });
		const users = crudWithValidation(usersTable, {
			validation: zod({
				insert: () =>
					z.object({
						name: z.string().optional(),
						email: z.email().optional().nullable(),
					}),
			}),
		});

		const user = await users.create({
			name: 'John Doe',
			email: 'john.doe@example.com',
		});

		expect(user).toEqual({
			id: 1,
			name: 'John Doe',
			email: 'john.doe@example.com',
		});
	});

	it('should find by id', async () => {
		const crudWithValidation = drizzleCrud(db, { validation: zod() });
		const users = crudWithValidation(usersTable);

		// First create a user to find
		await users.create({
			name: 'John Doe',
			email: 'john.doe@example.com',
		});

		const user = await users.findById(1, {
			columns: {
				id: true,
				name: true,
				email: false,
			},
		});

		if (user === null) {
			throw new Error('User not found');
		}

		console.log(user);

		expect(user).toEqual({
			id: 1,
			name: 'John Doe',
		});
	});

	it('should apply filters', async () => {
		const crudWithValidation = drizzleCrud(db, { validation: zod() });
		const users = crudWithValidation(usersTable);

		// Create a user first
		await users.create({
			name: 'Johnny',
			email: 'john.doe@example.com',
		});

		const where = filtersToWhere(usersTable, {
			OR: [
				{
					email: {
						equals: 'john.doe@example.com',
					},
				},
				{
					email: {
						equals: 'jane.doe@example.com',
					},
				},
			],
			AND: [
				{
					id: {
						not: 1337,
					},
				},
				{
					name: 'Johnny',
				},
			],
		});

		const list = await users.list({
			columns: {
				id: true,
			},
			where,
		});

		expect(list.results).toEqual([
			{
				id: 1,
			},
		]);
	});

	it('should accept filters', async () => {
		const crudWithValidation = drizzleCrud(db, { validation: zod() });
		const users = crudWithValidation(usersTable, {
			allowedFilters: ['id', 'name', 'email'], // ✅ Permite filtros
		});

		// Create a user first
		await users.create({
			name: 'John Doe',
			email: 'john.doe@example.com',
		});

		const list = await users.list({
			columns: {
				id: true,
				name: true,
			},
			filters: {
				id: {
					equals: 1,
				},
				OR: [
					{
						email: {
							equals: 'john.doe@example.com',
						},
					},
					{
						name: 'Johnny',
					},
				],
			},
		});

		expect(list.results[0]).toEqual({
			id: 1,
			name: 'John Doe',
		});
	});
});
