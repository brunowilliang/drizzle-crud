import { beforeAll, describe, expect, test } from 'bun:test';
import { db } from '../exemples/client';
import { users } from '../exemples/schema';
import { drizzleCrud } from '../src/index';
import { zod } from '../src/zod';

// Initialize CRUD factory with Zod validation
const crud = drizzleCrud(db, { validation: zod() });

// Create CRUD instance
const usersCrud = crud(users, {
	searchFields: ['name', 'email'],
	allowedFilters: ['role', 'status'],
	defaultPageSize: 10,
});

describe('IN and NOT IN Filter Operations', () => {
	// Clean up and setup before all tests
	beforeAll(async () => {
		await db.delete(users);

		// Create users with different roles and statuses
		const testUsers = [
			{
				email: 'admin1@test.com',
				name: 'Admin One',
				role: 'admin' as const,
				status: 'active' as const,
			},
			{
				email: 'admin2@test.com',
				name: 'Admin Two',
				role: 'admin' as const,
				status: 'inactive' as const,
			},
			{
				email: 'editor1@test.com',
				name: 'Editor One',
				role: 'editor' as const,
				status: 'active' as const,
			},
			{
				email: 'editor2@test.com',
				name: 'Editor Two',
				role: 'editor' as const,
				status: 'suspended' as const,
			},
			{
				email: 'viewer1@test.com',
				name: 'Viewer One',
				role: 'viewer' as const,
				status: 'active' as const,
			},
			{
				email: 'viewer2@test.com',
				name: 'Viewer Two',
				role: 'viewer' as const,
				status: 'inactive' as const,
			},
			{
				email: 'viewer3@test.com',
				name: 'Viewer Three',
				role: 'viewer' as const,
				status: 'active' as const,
			},
		];

		for (const user of testUsers) {
			await usersCrud.create(user);
		}
	});

	describe('IN operator tests', () => {
		test('filter users with specific roles using IN', async () => {
			const targetRoles: ('admin' | 'editor' | 'viewer')[] = [
				'admin',
				'editor',
			];

			const result = await usersCrud.list({
				filters: {
					role: { in: targetRoles },
				},
				orderBy: [{ field: 'name', direction: 'asc' }],
			});

			expect(result.totalItems).toBe(4);
			expect(result.results).toHaveLength(4);

			// Verify all results have the specified roles
			result.results.forEach((user) => {
				expect(targetRoles).toContain(user.role);
			});

			// Verify we got the right users
			const userNames = result.results.map((u) => u.name);
			expect(userNames).toEqual([
				'Admin One',
				'Admin Two',
				'Editor One',
				'Editor Two',
			]);
		});

		test('filter users with specific statuses using IN', async () => {
			const targetStatuses: ('active' | 'inactive' | 'suspended')[] = [
				'inactive',
				'suspended',
			];

			const result = await usersCrud.list({
				filters: {
					status: { in: targetStatuses },
				},
				orderBy: [{ field: 'email', direction: 'asc' }],
			});

			expect(result.totalItems).toBe(3);
			expect(result.results).toHaveLength(3);

			// Verify all results have the specified statuses
			result.results.forEach((user) => {
				expect(targetStatuses).toContain(user.status);
			});
		});

		test('combine multiple IN filters', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { in: ['admin', 'editor'] },
					status: { in: ['active'] },
				},
				orderBy: [{ field: 'role', direction: 'asc' }],
			});

			// Should only get active admins and editors
			expect(result.totalItems).toBe(2);
			expect(result.results).toHaveLength(2);

			result.results.forEach((user) => {
				expect(['admin', 'editor']).toContain(user.role);
				expect(user.status).toBe('active');
			});
		});

		test('single value in IN array', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { in: ['viewer'] },
				},
			});

			expect(result.totalItems).toBe(3);
			result.results.forEach((user) => {
				expect(user.role).toBe('viewer');
			});
		});

		test('empty IN array returns no results', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { in: [] },
				},
			});

			expect(result.totalItems).toBe(0);
			expect(result.results).toHaveLength(0);
		});
	});

	describe('NOT IN operator tests', () => {
		test('exclude specific roles using NOT IN', async () => {
			const excludedRoles: ('admin' | 'editor' | 'viewer')[] = ['viewer'];

			const result = await usersCrud.list({
				filters: {
					role: { notIn: excludedRoles },
				},
				orderBy: [{ field: 'name', direction: 'asc' }],
			});

			expect(result.totalItems).toBe(4);
			expect(result.results).toHaveLength(4);

			// Verify none of the results have excluded roles
			result.results.forEach((user) => {
				expect(excludedRoles).not.toContain(user.role);
			});

			// Should only have admins and editors
			const roles = [...new Set(result.results.map((u) => u.role))].sort();
			expect(roles).toEqual(['admin', 'editor']);
		});

		test('exclude multiple statuses using NOT IN', async () => {
			const excludedStatuses: ('active' | 'inactive' | 'suspended')[] = [
				'inactive',
				'suspended',
			];

			const result = await usersCrud.list({
				filters: {
					status: { notIn: excludedStatuses },
				},
			});

			expect(result.totalItems).toBe(4);
			expect(result.results).toHaveLength(4);

			// All results should be active
			result.results.forEach((user) => {
				expect(user.status).toBe('active');
			});
		});

		test('combine NOT IN with other filters', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { notIn: ['admin'] },
					status: 'active',
				},
				orderBy: [{ field: 'name', direction: 'asc' }],
			});

			// Should get active users that are not admins
			expect(result.totalItems).toBe(3);

			result.results.forEach((user) => {
				expect(user.role).not.toBe('admin');
				expect(user.status).toBe('active');
			});

			// Should have editor and viewers
			const userNames = result.results.map((u) => u.name);
			expect(userNames).toEqual(['Editor One', 'Viewer One', 'Viewer Three']);
		});

		test('empty NOT IN array returns all results', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { notIn: [] },
				},
			});

			expect(result.totalItems).toBe(7);
			expect(result.results).toHaveLength(7);
		});
	});

	describe('Complex scenarios', () => {
		test('combine IN and NOT IN on different fields', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { in: ['admin', 'editor', 'viewer'] }, // all roles
					status: { notIn: ['suspended'] }, // exclude suspended
				},
				orderBy: [{ field: 'status', direction: 'asc' }],
			});

			expect(result.totalItems).toBe(6);

			result.results.forEach((user) => {
				expect(user.status).not.toBe('suspended');
			});
		});

		test('use OR with IN operators', async () => {
			const result = await usersCrud.list({
				filters: {
					OR: [{ role: { in: ['admin'] } }, { status: { in: ['suspended'] } }],
				},
				orderBy: [{ field: 'name', direction: 'asc' }],
			});

			// Should get all admins OR all suspended users
			expect(result.totalItems).toBe(3);

			result.results.forEach((user) => {
				const isAdmin = user.role === 'admin';
				const isSuspended = user.status === 'suspended';
				expect(isAdmin || isSuspended).toBe(true);
			});
		});

		test('practical example: filter countries array', async () => {
			// Example showing how you would filter if country was a single field
			// If you have: country = "BR" or "PT" or "ES"
			// You can filter like this:

			const countries = ['PT', 'BR', 'ES'];

			// To get users FROM these countries:
			// filters: { country: { in: countries } }

			// To get users NOT FROM these countries:
			// filters: { country: { notIn: countries } }

			// This test just demonstrates the concept
			expect(countries).toEqual(['PT', 'BR', 'ES']);
		});
	});
});
