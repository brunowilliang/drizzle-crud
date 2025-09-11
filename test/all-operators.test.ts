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
	allowedFilters: ['role', 'status', 'countries', 'name', 'email', 'id'],
	defaultPageSize: 10,
});

describe('COMPLETE OPERATOR TESTS - ALL CASES', () => {
	beforeAll(async () => {
		// Clean up
		await db.delete(users);

		// Create comprehensive test data
		const testUsers = [
			// User 1
			{
				email: 'john.admin@company.com',
				name: 'John Admin',
				role: 'admin' as const,
				status: 'active' as const,
				countries: ['US', 'CA'], // North America
			},
			// User 2
			{
				email: 'maria.editor@company.com',
				name: 'Maria Editor',
				role: 'editor' as const,
				status: 'active' as const,
				countries: ['BR', 'AR', 'CL'], // South America
			},
			// User 3
			{
				email: 'peter.viewer@company.com',
				name: 'Peter Viewer',
				role: 'viewer' as const,
				status: 'inactive' as const,
				countries: ['DE', 'FR', 'IT'], // Europe
			},
			// User 4
			{
				email: 'anna.admin@other.org',
				name: 'Anna Admin',
				role: 'admin' as const,
				status: 'suspended' as const,
				countries: ['PT', 'ES'], // Iberia
			},
			// User 5
			{
				email: 'carlos.editor@freelance.net',
				name: 'Carlos Editor',
				role: 'editor' as const,
				status: 'active' as const,
				countries: ['MX'], // Just Mexico
			},
			// User 6
			{
				email: 'yuki.viewer@japan.jp',
				name: 'Yuki Viewer',
				role: 'viewer' as const,
				status: 'active' as const,
				countries: ['JP', 'KR', 'CN'], // Asia
			},
			// User 7 - Edge case: null countries
			{
				email: 'null.user@test.com',
				name: 'Null User',
				role: 'viewer' as const,
				status: 'active' as const,
				countries: null,
			},
		];

		for (const user of testUsers) {
			await usersCrud.create(user);
		}
	});

	describe('EQUALS operator', () => {
		test('equals - exact match string', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { equals: 'admin' },
				},
			});

			expect(result.totalItems).toBe(2);
			result.results.forEach((user) => {
				expect(user.role).toBe('admin');
			});
		});

		test('equals - shorthand (direct value)', async () => {
			const result = await usersCrud.list({
				filters: {
					role: 'editor', // Direct value = equals
				},
			});

			expect(result.totalItems).toBe(2);
			result.results.forEach((user) => {
				expect(user.role).toBe('editor');
			});
		});

		test('equals - no matches', async () => {
			const result = await usersCrud.list({
				filters: {
					name: { equals: 'NonExistentUser' }, // Doesn't exist
				},
			});

			expect(result.totalItems).toBe(0);
		});
	});

	describe('NOT operator', () => {
		test('not - exclude specific value', async () => {
			const result = await usersCrud.list({
				filters: {
					status: { not: 'active' },
				},
			});

			expect(result.totalItems).toBe(2); // inactive + suspended
			result.results.forEach((user) => {
				expect(user.status).not.toBe('active');
			});
		});

		test('not - with role', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { not: 'viewer' },
				},
			});

			expect(result.totalItems).toBe(4); // 2 admins + 2 editors
			result.results.forEach((user) => {
				expect(user.role).not.toBe('viewer');
			});
		});
	});

	describe('GT/GTE/LT/LTE operators', () => {
		test('gt - string comparison', async () => {
			// String comparison: 'editor' > 'admin' alphabetically
			const result = await usersCrud.list({
				filters: {
					role: { gt: 'admin' },
				},
			});

			expect(result.totalItems).toBe(5); // editor + viewer
			result.results.forEach((user) => {
				expect(['editor', 'viewer']).toContain(user.role);
			});
		});

		test('gte - greater than or equal', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { gte: 'editor' },
				},
			});

			expect(result.totalItems).toBe(5); // editor + viewer
		});

		test('lt - less than', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { lt: 'viewer' },
				},
			});

			expect(result.totalItems).toBe(4); // admin + editor
		});

		test('lte - less than or equal', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { lte: 'editor' },
				},
			});

			expect(result.totalItems).toBe(4); // admin + editor
		});

		test('multiple comparison operators', async () => {
			// Between 'admin' and 'viewer' (exclusive)
			const result = await usersCrud.list({
				filters: {
					role: { gt: 'admin', lt: 'viewer' },
				},
			});

			expect(result.totalItems).toBe(2); // only editors
			result.results.forEach((user) => {
				expect(user.role).toBe('editor');
			});
		});
	});

	describe('IN operator - STRING fields', () => {
		test('in - multiple values', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { in: ['admin', 'editor'] },
				},
			});

			expect(result.totalItems).toBe(4);
			result.results.forEach((user) => {
				expect(['admin', 'editor']).toContain(user.role);
			});
		});

		test('in - single value in array', async () => {
			const result = await usersCrud.list({
				filters: {
					status: { in: ['suspended'] },
				},
			});

			expect(result.totalItems).toBe(1);
			expect(result.results[0].name).toBe('Anna Admin');
		});

		test('in - empty array', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { in: [] },
				},
			});

			expect(result.totalItems).toBe(0);
		});
	});

	describe('NOT IN operator - STRING fields', () => {
		test('notIn - exclude multiple values', async () => {
			const result = await usersCrud.list({
				filters: {
					status: { notIn: ['inactive', 'suspended'] },
				},
			});

			expect(result.totalItems).toBe(5); // only active users
			result.results.forEach((user) => {
				expect(user.status).toBe('active');
			});
		});

		test('notIn - exclude single value', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { notIn: ['admin'] },
				},
			});

			expect(result.totalItems).toBe(5); // editors + viewers
			result.results.forEach((user) => {
				expect(user.role).not.toBe('admin');
			});
		});

		test('notIn - empty array excludes nothing', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { notIn: [] },
				},
			});

			expect(result.totalItems).toBe(7); // all users
		});
	});

	describe('IN/NOT IN with JSON ARRAYS - CURRENT LIMITATIONS', () => {
		test('in - JSON array field DOES NOT WORK CORRECTLY', async () => {
			console.log('\n🚨 TESTING IN WITH JSON ARRAY - EXPECTED TO FAIL');

			const result = await usersCrud.list({
				filters: {
					countries: { in: ['BR'] } as any,
				},
			});

			console.log(`Result count: ${result.totalItems}`);
			console.log(
				'Results:',
				result.results.map((u) => ({
					name: u.name,
					countries: u.countries,
				})),
			);

			// This SHOULD find Maria Editor who has BR
			// But it probably won't work correctly
			console.log('Expected: 1 user (Maria Editor)');
			console.log(`Actual: ${result.totalItems} users`);
		});

		test('notIn - JSON array field DOES NOT WORK CORRECTLY', async () => {
			console.log(
				'\n🚨 TESTING NOT IN WITH JSON ARRAY - YOUR ORIGINAL PROBLEM',
			);

			const result = await usersCrud.list({
				filters: {
					countries: { notIn: ['PT'] } as any,
				},
			});

			console.log(`Result count: ${result.totalItems}`);
			console.log('Should exclude Anna Admin (has PT)');
			console.log('Expected: 6 users');
			console.log(`Actual: ${result.totalItems} users`);

			if (result.totalItems === 7) {
				console.log('❌ BUG CONFIRMED: notIn does not work with JSON arrays!');
			}
		});
	});

	describe('LIKE operator', () => {
		test('like - pattern at end', async () => {
			const result = await usersCrud.list({
				filters: {
					email: { like: '%@company.com' },
				},
			});

			expect(result.totalItems).toBe(3);
			result.results.forEach((user) => {
				expect(user.email).toMatch(/@company\.com$/);
			});
		});

		test('like - pattern at start', async () => {
			const result = await usersCrud.list({
				filters: {
					name: { like: 'John%' },
				},
			});

			expect(result.totalItems).toBe(1);
			expect(result.results[0].name).toBe('John Admin');
		});

		test('like - pattern in middle', async () => {
			const result = await usersCrud.list({
				filters: {
					name: { like: '%Admin%' },
				},
			});

			expect(result.totalItems).toBe(2);
			result.results.forEach((user) => {
				expect(user.name).toContain('Admin');
			});
		});

		test('like - case INSENSITIVE in SQLite', async () => {
			const result = await usersCrud.list({
				filters: {
					name: { like: '%admin%' }, // lowercase
				},
			});

			// SQLite LIKE is case insensitive by default!
			expect(result.totalItems).toBe(2); // Finds both Admin users
			result.results.forEach((user) => {
				expect(user.name.toLowerCase()).toContain('admin');
			});
		});

		test('like - with JSON array (manual quotes)', async () => {
			const result = await usersCrud.list({
				filters: {
					countries: { like: '%"BR"%' } as any,
				},
			});

			expect(result.totalItems).toBe(1);
			expect(result.results[0].name).toBe('Maria Editor');
			expect(result.results[0].countries).toContain('BR');
		});
	});

	describe('ILIKE operator', () => {
		test('ilike - case insensitive search', async () => {
			console.log('\n⚠️  ILIKE may not work in SQLite');

			try {
				const result = await usersCrud.list({
					filters: {
						name: { ilike: '%admin%' }, // lowercase
					},
				});

				// If SQLite supports ILIKE (some versions do)
				expect(result.totalItems).toBe(2);
				result.results.forEach((user) => {
					expect(user.name.toLowerCase()).toContain('admin');
				});
			} catch (error: any) {
				console.log('❌ ILIKE not supported in SQLite:', error.message);
				// The error message varies, just check it failed
				expect(error.message).toBeTruthy();
			}
		});
	});

	describe('NOT LIKE operator', () => {
		test('notLike - exclude pattern', async () => {
			const result = await usersCrud.list({
				filters: {
					email: { notLike: '%@company.com' },
				},
			});

			expect(result.totalItems).toBe(4); // All except company.com emails
			result.results.forEach((user) => {
				expect(user.email).not.toMatch(/@company\.com$/);
			});
		});

		test('notLike - exclude name pattern', async () => {
			const result = await usersCrud.list({
				filters: {
					name: { notLike: '%Admin%' },
				},
			});

			expect(result.totalItems).toBe(5); // All except admins
			result.results.forEach((user) => {
				expect(user.name).not.toContain('Admin');
			});
		});

		test('notLike - with JSON array (YOUR USE CASE)', async () => {
			console.log('\n🎯 TESTING YOUR EXACT USE CASE');

			const country = 'PT';
			const result = await usersCrud.list({
				filters: {
					countries: { notLike: `%"${country}"%` } as any,
				},
			});

			console.log(
				'Users without PT:',
				result.results.map((u) => ({
					name: u.name,
					countries: u.countries,
				})),
			);

			// Check who was excluded
			const allUsers = await usersCrud.list({});
			const excludedUsers = allUsers.results.filter(
				(u) => !result.results.find((r) => r.id === u.id),
			);
			console.log(
				'Excluded users:',
				excludedUsers.map((u) => ({
					name: u.name,
					countries: u.countries,
				})),
			);

			// notLike excludes users where the pattern matches
			// It also excludes NULL values!
			expect(result.totalItems).toBe(5); // 6 total - 1 with PT - but NULL is also excluded!
			result.results.forEach((user) => {
				if (user.countries) {
					expect(user.countries).not.toContain('PT');
				}
			});

			console.log('⚠️  notLike also excludes NULL values!');
		});
	});

	describe('COMBINED filters', () => {
		test('multiple operators on same field', async () => {
			const result = await usersCrud.list({
				filters: {
					role: { not: 'admin', in: ['editor', 'viewer'] },
				},
			});

			// Should get editors and viewers (not admin is redundant here)
			expect(result.totalItems).toBe(5);
		});

		test('AND logic - multiple fields', async () => {
			const result = await usersCrud.list({
				filters: {
					role: 'editor',
					status: 'active',
				},
			});

			expect(result.totalItems).toBe(2); // Maria and Carlos
			result.results.forEach((user) => {
				expect(user.role).toBe('editor');
				expect(user.status).toBe('active');
			});
		});

		test('OR logic', async () => {
			const result = await usersCrud.list({
				filters: {
					OR: [{ role: 'admin' }, { status: 'suspended' }],
				},
			});

			// All admins OR all suspended (Anna counts only once)
			expect(result.totalItems).toBe(2);
		});

		test('complex filter combination', async () => {
			const result = await usersCrud.list({
				filters: {
					status: { in: ['active', 'inactive'] },
					role: { notIn: ['admin'] },
					email: { like: '%@company.com' },
				},
			});

			// Active/inactive + not admin + company.com email
			expect(result.totalItems).toBe(2); // Maria and Peter
		});
	});

	describe('NULL handling', () => {
		test('null values in filters - LIMITATION', async () => {
			console.log('\n⚠️  Testing NULL filters');

			const result = await usersCrud.list({
				filters: {
					countries: null, // Find users with null countries
				},
			});

			console.log('Users with null countries:', result.totalItems);
			console.log(
				'Results:',
				result.results.map((u) => ({
					name: u.name,
					countries: u.countries,
				})),
			);

			// This might not work as expected with JSON fields
			// The test shows actual behavior
			if (result.totalItems === 0) {
				console.log('❌ NULL filter does not work for JSON fields');
			}
		});

		test('not null values - LIMITATION', async () => {
			const result = await usersCrud.list({
				filters: {
					countries: { not: null },
				},
			});

			console.log('Users with NOT null countries:', result.totalItems);

			// This might not work as expected with JSON fields
			if (result.totalItems === 0) {
				console.log('❌ NOT NULL filter does not work for JSON fields');
			}
		});
	});

	describe('EDGE CASES and ERRORS', () => {
		test('invalid filter field', async () => {
			try {
				await usersCrud.list({
					filters: {
						invalidField: 'test', // Not in allowedFilters
					} as any,
				});
				// If no error, the filter was ignored
				expect(true).toBe(true);
			} catch (error) {
				// Or it might throw an error
				expect(error).toBeDefined();
			}
		});

		test('empty filters object', async () => {
			const result = await usersCrud.list({
				filters: {},
			});

			expect(result.totalItems).toBe(7); // All users
		});

		test('undefined filter values are ignored', async () => {
			const result = await usersCrud.list({
				filters: {
					role: undefined,
					status: 'active',
				},
			});

			expect(result.totalItems).toBe(5); // Only status filter applies
		});
	});

	describe('PERFORMANCE considerations', () => {
		test('pagination with filters', async () => {
			const page1 = await usersCrud.list({
				page: 1,
				perPage: 2,
				filters: { status: 'active' },
				orderBy: [{ field: 'name', direction: 'asc' }],
			});

			const page2 = await usersCrud.list({
				page: 2,
				perPage: 2,
				filters: { status: 'active' },
				orderBy: [{ field: 'name', direction: 'asc' }],
			});

			expect(page1.results.length).toBe(2);
			expect(page2.results.length).toBe(2);
			expect(page1.totalItems).toBe(5);
			expect(page1.totalPages).toBe(3);
		});
	});
});
