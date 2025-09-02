import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../exemples/client';
import { users } from '../exemples/schema';
import { drizzleCrud } from '../src/index';
import { zod } from '../src/zod';

// Initialize CRUD factory with Zod validation
const crud = drizzleCrud(db, { validation: zod() });

// Create CRUD instances
const usersCrud = crud(users, {
	searchFields: ['name', 'email'],
	allowedFilters: ['role', 'status'],
	softDelete: {
		field: 'deletedAt',
		deletedValue: new Date(),
		notDeletedValue: null,
	},
	defaultPageSize: 10,
	maxPageSize: 50,
});

describe('Basic CRUD Operations', () => {
	let userId: number;

	// Clean up before all tests
	test('clean database', async () => {
		await db.delete(users);
		expect(true).toBe(true);
	});

	describe('Users CRUD', () => {
		test('create user', async () => {
			const user = await usersCrud.create({
				email: 'bruno@test.com',
				name: 'Bruno Garcia',
				role: 'admin',
				status: 'active',
				bio: 'Senior developer',
			});

			expect(user).toBeDefined();
			expect(user.email).toBe('bruno@test.com');
			expect(user.name).toBe('Bruno Garcia');
			expect(user.role).toBe('admin');
			expect(user.deletedAt).toBeNull();
			userId = user.id;
		});

		test('find user by id', async () => {
			const user = await usersCrud.findOne({ id: userId });
			expect(user).toBeDefined();
			expect(user?.id).toBe(userId);
			expect(user?.email).toBe('bruno@test.com');
		});

		test('find user by email', async () => {
			const user = await usersCrud.findOne({ email: 'bruno@test.com' });
			expect(user).toBeDefined();
			expect(user?.id).toBe(userId);
			expect(user?.name).toBe('Bruno Garcia');
		});

		test('update user', async () => {
			const updated = await usersCrud.update(userId, {
				bio: 'Super Senior Developer',
				status: 'inactive',
			});

			expect(updated).toBeDefined();
			expect(updated.bio).toBe('Super Senior Developer');
			expect(updated.status).toBe('inactive');
		});

		test('list users with pagination', async () => {
			// Create more users for pagination test
			await usersCrud.create({
				email: 'user2@test.com',
				name: 'User Two',
				role: 'editor',
			});

			await usersCrud.create({
				email: 'user3@test.com',
				name: 'User Three',
				role: 'viewer',
			});

			const result = await usersCrud.list({
				page: 1,
				perPage: 2,
			});

			expect(result.results).toHaveLength(2);
			expect(result.page).toBe(1);
			expect(result.perPage).toBe(2);
			expect(result.totalItems).toBe(3);
			expect(result.totalPages).toBe(2);
			expect(result.hasNextPage).toBe(true);
			expect(result.hasPreviousPage).toBe(false);
		});

		test('search users', async () => {
			const result = await usersCrud.list({
				search: 'Bruno',
				page: 1,
				perPage: 10,
			});

			expect(result.results).toHaveLength(1);
			expect(result.results[0].name).toBe('Bruno Garcia');
		});

		test('filter users', async () => {
			const result = await usersCrud.list({
				filters: {
					role: 'admin',
				},
			});

			expect(result.results).toHaveLength(1);
			expect(result.results[0].role).toBe('admin');
		});

		test('soft delete user', async () => {
			const secondUserId = (
				await db.select().from(users).where(eq(users.email, 'user2@test.com'))
			)[0].id;

			await usersCrud.deleteOne(secondUserId);

			// Should not find deleted user
			const deletedUser = await usersCrud.findOne({ id: secondUserId });
			expect(deletedUser).toBeNull();

			// Should find with includeDeleted
			const withDeleted = await usersCrud.findOne(
				{ id: secondUserId },
				{ includeDeleted: true },
			);
			expect(withDeleted).toBeDefined();
			expect(withDeleted?.deletedAt).not.toBeNull();
		});

		test('restore soft deleted user', async () => {
			const secondUserId = (
				await db.select().from(users).where(eq(users.email, 'user2@test.com'))
			)[0].id;

			await usersCrud.restore(secondUserId);

			const restoredUser = await usersCrud.findOne({ id: secondUserId });
			expect(restoredUser).toBeDefined();
			expect(restoredUser?.deletedAt).toBeNull();
		});
	});
});
