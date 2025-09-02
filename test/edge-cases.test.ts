import { describe, expect, test } from 'bun:test';
import { db } from '../exemples/client';
import { users } from '../exemples/schema';
import { drizzleCrud } from '../src/index';
import { zod } from '../src/zod';

const crud = drizzleCrud(db, { validation: zod() });

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

describe('Edge Cases and Error Handling', () => {
	// Clean up before all tests
	test('clean database', async () => {
		await db.delete(users);
		expect(true).toBe(true);
	});

	describe('Create Edge Cases', () => {
		test('should handle duplicate email constraint', async () => {
			// Create first user
			const user1 = await usersCrud.create({
				email: 'duplicate@test.com',
				name: 'User One',
				role: 'viewer',
			});
			expect(user1).toBeDefined();

			// Try to create with same email
			await expect(
				usersCrud.create({
					email: 'duplicate@test.com',
					name: 'User Two',
					role: 'viewer',
				}),
			).rejects.toThrow();
		});

		test('should handle missing required fields', async () => {
			await expect(
				usersCrud.create({
					// Missing email
					name: 'No Email User',
				} as any),
			).rejects.toThrow();
		});

		test('should handle invalid enum values', async () => {
			await expect(
				usersCrud.create({
					email: 'invalid-role@test.com',
					name: 'Invalid Role',
					role: 'superadmin' as any, // Invalid role
				}),
			).rejects.toThrow();
		});
	});

	describe('FindOne Edge Cases', () => {
		test('should return null for non-existent id', async () => {
			const result = await usersCrud.findOne({ id: 999999 });
			expect(result).toBeNull();
		});

		test('should handle multiple conditions', async () => {
			// Create a user
			const user = await usersCrud.create({
				email: 'multi-condition@test.com',
				name: 'Multi Condition',
				role: 'admin',
				status: 'active',
			});

			// Find with multiple conditions
			const found = await usersCrud.findOne({
				email: 'multi-condition@test.com',
				role: 'admin',
			} as any);

			expect(found).toBeDefined();
			expect(found?.id).toBe(user.id);
		});

		test('should throw error when no conditions provided', async () => {
			await expect(usersCrud.findOne({} as any)).rejects.toThrow(
				'findOne requires at least one search condition',
			);
		});
	});

	describe('Update Edge Cases', () => {
		let userId: number;

		test('setup: create user', async () => {
			const user = await usersCrud.create({
				email: 'update-test@test.com',
				name: 'Update Test',
				role: 'viewer',
			});
			userId = user.id;
		});

		test('should handle update with no changes', async () => {
			const result = await usersCrud.update(userId, {});
			expect(result).toBeDefined();
			expect(result.email).toBe('update-test@test.com');
		});

		test('should handle update non-existent record', async () => {
			await expect(
				usersCrud.update(999999, { name: 'Ghost User' }),
			).rejects.toThrow();
		});

		test('should handle invalid field update', async () => {
			await expect(
				usersCrud.update(userId, {
					role: 'superuser' as any, // Invalid role
				}),
			).rejects.toThrow();
		});
	});

	describe('List Edge Cases', () => {
		test('should handle empty results', async () => {
			// Clean database first
			await db.delete(users);

			const result = await usersCrud.list({});
			expect(result.results).toHaveLength(0);
			expect(result.totalItems).toBe(0);
			expect(result.totalPages).toBe(0);
			expect(result.hasNextPage).toBe(false);
			expect(result.hasPreviousPage).toBe(false);
		});

		test('should handle page beyond available data', async () => {
			// Create one user
			await usersCrud.create({
				email: 'single@test.com',
				name: 'Single User',
				role: 'viewer',
			});

			const result = await usersCrud.list({
				page: 10,
				perPage: 10,
			});

			expect(result.results).toHaveLength(0);
			expect(result.page).toBe(10);
			expect(result.totalItems).toBe(1);
			expect(result.hasNextPage).toBe(false);
			expect(result.hasPreviousPage).toBe(true);
		});

		test('should respect maxPageSize', async () => {
			// Try to request more than maxPageSize
			await expect(
				usersCrud.list({
					perPage: 100, // maxPageSize is 50
				}),
			).rejects.toThrow();
		});

		test('should handle negative page numbers', async () => {
			await expect(
				usersCrud.list({
					page: -1,
					perPage: 10,
				}),
			).rejects.toThrow();
		});

		test('should handle search with special characters', async () => {
			// Create user with special characters
			await usersCrud.create({
				email: 'special@test.com',
				name: "O'Brien & Co.",
				role: 'viewer',
			});

			const result = await usersCrud.list({
				search: "O'Brien",
			});

			expect(result.results.length).toBeGreaterThan(0);
		});
	});

	describe('Soft Delete Edge Cases', () => {
		let userId: number;

		test('setup: create user', async () => {
			const user = await usersCrud.create({
				email: 'soft-delete@test.com',
				name: 'Soft Delete Test',
				role: 'viewer',
			});
			userId = user.id;
		});

		test('should not delete already deleted record', async () => {
			// First delete
			await usersCrud.deleteOne(userId);

			// Try to delete again - should not throw but handle gracefully
			await expect(usersCrud.deleteOne(userId)).resolves.toBeDefined();
		});

		test('should not restore non-deleted record', async () => {
			const user = await usersCrud.create({
				email: 'not-deleted@test.com',
				name: 'Not Deleted',
				role: 'viewer',
			});

			// Try to restore a non-deleted record
			await expect(usersCrud.restore(user.id)).resolves.toBeDefined();
		});

		test('should handle permanent delete of non-existent record', async () => {
			await expect(usersCrud.permanentDelete(999999)).rejects.toThrow();
		});
	});

	describe('Bulk Operations Edge Cases', () => {
		test('should handle empty bulk create', async () => {
			const result = await usersCrud.bulkCreate([]);
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		test('should handle bulk create with some invalid data', async () => {
			const data = [
				{ email: 'bulk1@test.com', name: 'Bulk 1', role: 'viewer' as const },
				{ email: 'bulk2@test.com' }, // Missing required name field
				{ email: 'bulk3@test.com', name: 'Bulk 3', role: 'admin' as const },
			];

			await expect(usersCrud.bulkCreate(data as any)).rejects.toThrow();
		});

		test('should handle bulk delete with empty array', async () => {
			const result = await usersCrud.bulkDelete([]);
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		test('should handle bulk delete with non-existent ids', async () => {
			const result = await usersCrud.bulkDelete([999997, 999998, 999999]);
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		test('should handle bulk restore with mixed ids', async () => {
			// Create and delete a user
			const user = await usersCrud.create({
				email: 'bulk-restore@test.com',
				name: 'Bulk Restore',
				role: 'viewer',
			});
			await usersCrud.deleteOne(user.id);

			// Try to restore with mixed valid/invalid ids
			const result = await usersCrud.bulkRestore([user.id, 999999]);
			expect(result.success).toBe(true);
			expect(result.count).toBeGreaterThan(0);
		});
	});

	describe('Complex Filter Edge Cases', () => {
		test('setup: create test data', async () => {
			await db.delete(users);

			await usersCrud.bulkCreate([
				{
					email: 'admin1@test.com',
					name: 'Admin One',
					role: 'admin',
					status: 'active',
				},
				{
					email: 'admin2@test.com',
					name: 'Admin Two',
					role: 'admin',
					status: 'inactive',
				},
				{
					email: 'editor1@test.com',
					name: 'Editor One',
					role: 'editor',
					status: 'active',
				},
				{
					email: 'viewer1@test.com',
					name: 'Viewer One',
					role: 'viewer',
					status: 'active',
				},
			]);
		});

		test('should handle filters with non-allowed fields', async () => {
			// Try to filter by email (not in allowedFilters)
			const result = await usersCrud.list({
				filters: {
					email: 'admin1@test.com',
				} as any,
			});

			// Should ignore non-allowed filter
			expect(result.results.length).toBeGreaterThan(1);
		});

		test('should handle AND filters', async () => {
			const result = await usersCrud.list({
				filters: {
					AND: [{ role: 'admin' }, { status: 'active' }],
				},
			});

			expect(result.results).toHaveLength(1);
			expect(result.results[0].email).toBe('admin1@test.com');
		});

		test('should handle OR filters', async () => {
			const result = await usersCrud.list({
				filters: {
					OR: [{ role: 'admin' }, { role: 'editor' }],
				},
			});

			expect(result.results).toHaveLength(3);
		});

		test('should handle invalid filter operators', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { $invalid: 'admin' },
				} as any,
			});

			// Should ignore invalid operators
			expect(result).toBeDefined();
		});
	});

	// Clean up after all tests
	test('final cleanup', async () => {
		await db.delete(users);
		expect(true).toBe(true);
	});
});
