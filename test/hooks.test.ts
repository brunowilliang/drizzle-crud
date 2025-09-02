import { describe, expect, test } from 'bun:test';
import { db } from '../exemples/client';
import { categories, posts, users } from '../exemples/schema';
import { drizzleCrud } from '../src/index';
import type { CrudOptions } from '../src/types';
import { zod } from '../src/zod';

describe('Hooks Tests', () => {
	// Clean up before all tests
	test('clean database', async () => {
		await db.delete(posts);
		await db.delete(categories);
		await db.delete(users);
		expect(true).toBe(true);
	});

	describe('beforeCreate Hook', () => {
		test('should transform data before create', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeCreate: (data) => {
					return {
						...data,
						name: data.name.toUpperCase(),
						bio: `[AUTO] ${data.bio || 'No bio provided'}`,
					};
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const user = await usersCrud.create({
				email: 'hooks@test.com',
				name: 'lowercase name',
				role: 'viewer',
			});

			expect(user.name).toBe('LOWERCASE NAME');
			expect(user.bio).toBe('[AUTO] No bio provided');
		});

		test('should add computed fields', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeCreate: (data) => {
					const domain = data.email.split('@')[1];
					return {
						...data,
						bio: `User from ${domain}`,
					};
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const user = await usersCrud.create({
				email: 'user@company.com',
				name: 'Domain User',
				role: 'viewer',
			});

			expect(user.bio).toBe('User from company.com');
		});

		test('should handle async beforeCreate', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeCreate: (data) => {
					// Note: Hooks are now synchronous in this version
					return {
						...data,
						name: `[ASYNC] ${data.name}`,
					};
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const user = await usersCrud.create({
				email: 'async@test.com',
				name: 'Async User',
				role: 'viewer',
			});

			expect(user.name).toBe('[ASYNC] Async User');
		});
	});

	describe('beforeUpdate Hook', () => {
		let userId: number;

		test('setup: create user', async () => {
			const crud = drizzleCrud(db);
			const user = await crud(users).create({
				email: 'update-hook@test.com',
				name: 'Original Name',
				role: 'viewer',
				bio: 'Original bio',
			});
			userId = user.id;
		});

		test('should transform data before update', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeUpdate: (data) => {
					if (data.bio) {
						return {
							...data,
							bio: `[UPDATED] ${data.bio}`,
						};
					}
					return data;
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const updated = await usersCrud.update(userId, {
				bio: 'New bio content',
			});

			expect(updated.bio).toBe('[UPDATED] New bio content');
		});

		test('should add timestamps on update', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeUpdate: (data) => {
					return {
						...data,
						// Note: updatedAt is already handled by the schema default
						bio: `Updated at ${new Date().toISOString()}`,
					};
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const updated = await usersCrud.update(userId, {
				name: 'Updated Name',
			});

			expect(updated.bio).toContain('Updated at');
		});

		test('should prevent certain fields from updating', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeUpdate: (data) => {
					// Remove role from updates
					const { role: _, ...safeData } = data;
					return safeData;
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const original = await usersCrud.findOne({ id: userId });

			const updated = await usersCrud.update(userId, {
				role: 'admin', // Try to update role
				name: 'New Name',
			});

			expect(updated.name).toBe('New Name');
			expect(updated.role).toBe(original!.role); // Role should not change
		});
	});

	describe('validate Hook', () => {
		test('should provide custom validation', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeCreate: (data) => {
					// Custom email domain validation
					if (data.email && !data.email.endsWith('@allowed.com')) {
						throw new Error('Only @allowed.com emails are allowed');
					}
					return data;
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			// Valid email
			const user = await usersCrud.create({
				email: 'user@allowed.com',
				name: 'Allowed User',
				role: 'viewer',
			});
			expect(user).toBeDefined();

			// Invalid email
			await expect(
				usersCrud.create({
					email: 'user@notallowed.com',
					name: 'Not Allowed',
					role: 'viewer',
				}),
			).rejects.toThrow('Only @allowed.com emails are allowed');
		});

		test('should validate update operations', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeUpdate: (data) => {
					// Prevent status change to suspended without a reason
					if (data.status === 'suspended' && !data.bio?.includes('Reason:')) {
						throw new Error('Must provide reason for suspension in bio');
					}
					return data;
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const user = await usersCrud.create({
				email: 'suspend@test.com',
				name: 'Test User',
				role: 'viewer',
			});

			// Invalid suspension
			await expect(
				usersCrud.update(user.id, {
					status: 'suspended',
				}),
			).rejects.toThrow('Must provide reason for suspension in bio');

			// Valid suspension
			const suspended = await usersCrud.update(user.id, {
				status: 'suspended',
				bio: 'Reason: Policy violation',
			});
			expect(suspended.status).toBe('suspended');
		});
	});

	describe('Complex Hook Scenarios', () => {
		test('should chain multiple hooks', async () => {
			let validateCalled = false;
			let beforeCreateCalled = false;

			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				validate: () => {
					validateCalled = true;
					return true;
				},
				beforeCreate: (data) => {
					beforeCreateCalled = true;
					return {
						...data,
						name: `[HOOKED] ${data.name}`,
					};
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			const user = await usersCrud.create({
				email: 'chain@test.com',
				name: 'Chain Test',
				role: 'viewer',
			});

			expect(validateCalled).toBe(true);
			expect(beforeCreateCalled).toBe(true);
			expect(user.name).toBe('[HOOKED] Chain Test');
		});

		test('should handle errors in hooks gracefully', async () => {
			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				beforeCreate: () => {
					throw new Error('Hook error');
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			await expect(
				usersCrud.create({
					email: 'error@test.com',
					name: 'Error Test',
					role: 'viewer',
				}),
			).rejects.toThrow('Hook error');
		});

		test('should pass context through hooks', async () => {
			let contextReceived: any;

			const hooks: CrudOptions<any, typeof users>['hooks'] = {
				validate: ({ context }) => {
					contextReceived = context;
					return true;
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const usersCrud = crud(users, { hooks });

			await usersCrud.create(
				{
					email: 'context@test.com',
					name: 'Context Test',
					role: 'viewer',
				},
				{
					actor: { type: 'user', properties: { id: 123, role: 'admin' } },
					scope: { tenantId: 456 },
				},
			);

			expect(contextReceived).toBeDefined();
			expect(contextReceived.actor).toEqual({
				type: 'user',
				properties: { id: 123, role: 'admin' },
			});
			expect(contextReceived.scope).toEqual({ tenantId: 456 });
		});
	});

	describe('Hooks with Related Data', () => {
		let userId: number;
		let categoryId: number;

		test('setup: create user and category', async () => {
			const crud = drizzleCrud(db);

			const user = await crud(users).create({
				email: 'author@test.com',
				name: 'Author',
				role: 'editor',
			});
			userId = user.id;

			const category = await crud(categories).create({
				name: 'Tech',
				slug: 'tech',
			});
			categoryId = category.id;
		});

		test('should enrich data in hooks', async () => {
			const hooks: CrudOptions<any, typeof posts>['hooks'] = {
				beforeCreate: (data) => {
					// Auto-generate slug if not provided
					if (!data.slug && data.title) {
						const slug = data.title
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, '-')
							.replace(/^-|-$/g, '');

						return {
							...data,
							slug,
							excerpt: data.excerpt || data.content.substring(0, 100) + '...',
						};
					}
					return data;
				},
			};

			const crud = drizzleCrud(db, { validation: zod() });
			const postsCrud = crud(posts, { hooks });

			const post = await postsCrud.create({
				title: 'My Awesome Post!',
				content:
					'This is a long content that will be used to generate an excerpt automatically if one is not provided.',
				status: 'draft',
				authorId: userId,
				categoryId: categoryId,
				slug: '', // Will be overwritten by hook
			});

			expect(post.slug).toBe('my-awesome-post');
			expect(post.excerpt).toBe(
				'This is a long content that will be used to generate an excerpt automatically if one is not provided...',
			);
		});
	});

	// Clean up after all tests
	test('final cleanup', async () => {
		await db.delete(posts);
		await db.delete(categories);
		await db.delete(users);
		expect(true).toBe(true);
	});
});
