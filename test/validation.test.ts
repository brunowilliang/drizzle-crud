import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { db } from '../exemples/client';
import { categories, posts, users } from '../exemples/schema';
import { drizzleCrud } from '../src/index';
import { zod } from '../src/zod';

describe('Validation Tests', () => {
	// Clean up before all tests
	test('clean database', async () => {
		await db.delete(posts);
		await db.delete(categories);
		await db.delete(users);
		expect(true).toBe(true);
	});

	describe('Custom Validation Schemas', () => {
		test('should validate with custom create schema', async () => {
			const customCreateSchema = z.object({
				email: z.email().transform((val) => val.toLowerCase()),
				name: z.string().min(2).max(50),
				role: z.enum(['admin', 'editor', 'viewer']),
				status: z.enum(['active', 'inactive', 'suspended']).optional(),
				bio: z.string().max(500).optional(),
			});

			// Create a custom validation adapter with specific schema
			const customValidation = {
				...zod(),
				createInsertSchema: () => customCreateSchema as any,
			};

			const crud = drizzleCrud(db, { validation: customValidation });
			const usersCrud = crud(users);

			// Valid data
			const user = await usersCrud.create({
				email: 'VALID@TEST.COM', // Should be lowercased
				name: 'Valid User',
				role: 'admin',
			});

			expect(user.email).toBe('valid@test.com');

			// Invalid data - name too short
			await expect(
				usersCrud.create({
					email: 'short@test.com',
					name: 'A', // Too short
					role: 'admin',
				}),
			).rejects.toThrow();

			// Invalid data - invalid email
			await expect(
				usersCrud.create({
					email: 'not-an-email',
					name: 'Invalid Email',
					role: 'admin',
				}),
			).rejects.toThrow();
		});

		test('should validate with custom update schema', async () => {
			const customUpdateSchema = z.object({
				name: z.string().min(2).max(50).optional(),
				bio: z.string().max(500).optional(),
				status: z.enum(['active', 'inactive', 'suspended']).optional(),
			});

			// Create a custom validation adapter with specific schema
			const customValidation = {
				...zod(),
				createUpdateSchema: () => customUpdateSchema as any,
			};

			const crud = drizzleCrud(db, { validation: customValidation });
			const usersCrud = crud(users);

			// Create a user first
			const user = await usersCrud.create({
				email: 'update-validation@test.com',
				name: 'Update Test',
				role: 'viewer',
			});

			// Valid update
			const updated = await usersCrud.update(user.id, {
				name: 'Updated Name',
				bio: 'New bio',
			});

			expect(updated.name).toBe('Updated Name');
			expect(updated.bio).toBe('New bio');

			// Invalid update - try to update role (not in schema)
			const result = await usersCrud.update(user.id, {
				role: 'admin',
			} as any);

			// Role should not be updated
			expect(result.role).toBe('viewer');
		});

		test('should validate list parameters', async () => {
			const customListSchema = z.object({
				page: z.number().int().positive().default(1),
				perPage: z.number().int().min(1).max(20).default(10),
				search: z.string().max(50).optional(),
				filters: z.any().optional(),
				orderBy: z
					.array(
						z.object({
							field: z.string(),
							direction: z.enum(['asc', 'desc']),
						}),
					)
					.optional(),
				includeDeleted: z.boolean().optional(),
			});

			// Create a custom validation adapter with specific schema
			const customValidation = {
				...zod(),
				createListSchema: () => customListSchema as any,
			};

			const crud = drizzleCrud(db, { validation: customValidation });
			const usersCrud = crud(users, {
				searchFields: ['name', 'email'],
			});

			// Valid list params
			const result = await usersCrud.list({
				page: 1,
				perPage: 10,
			});

			expect(result.perPage).toBe(10);

			// Invalid - perPage too large
			await expect(
				usersCrud.list({
					perPage: 50, // Max is 20
				}),
			).rejects.toThrow();

			// Invalid - search too long
			await expect(
				usersCrud.list({
					search: 'a'.repeat(100), // Max is 50
				}),
			).rejects.toThrow();
		});
	});

	describe('Data Transformation', () => {
		test('should transform data on create', async () => {
			const createSchema = z.object({
				email: z
					.preprocess(
						(val) => (typeof val === 'string' ? val.trim() : val),
						z.email(),
					)
					.transform((val) => val.toLowerCase()),
				name: z
					.string()
					.trim()
					.transform((val) => val.replace(/\s+/g, ' ')),
				role: z.enum(['admin', 'editor', 'viewer']),
				bio: z.string().trim().optional(),
			});

			// Create a custom validation adapter
			const customAdapter = {
				...zod(),
				createInsertSchema: () => createSchema as any,
			};

			const crud = drizzleCrud(db, { validation: customAdapter });
			const usersCrud = crud(users);

			const user = await usersCrud.create({
				email: '  SPACES@TEST.COM  ',
				name: '  Multiple   Spaces   ',
				role: 'viewer',
				bio: '  Trimmed bio  ',
			});

			expect(user.email).toBe('spaces@test.com');
			expect(user.name).toBe('Multiple Spaces');
			expect(user.bio).toBe('Trimmed bio');
		});

		test('should handle complex nested validation', async () => {
			// Categories with parent validation
			const categorySchema = z.object({
				name: z.string().min(2).max(50),
				slug: z.string().regex(/^[a-z0-9-]+$/),
				description: z.string().max(200).optional(),
				parentId: z.number().int().positive().nullable().optional(),
				order: z.number().int().min(0).default(0),
			});

			// Create a custom validation adapter with specific schema
			const customValidation = {
				...zod(),
				createInsertSchema: () => categorySchema as any,
			};

			const crud = drizzleCrud(db, { validation: customValidation });
			const categoriesCrud = crud(categories);

			// Valid category
			const category = await categoriesCrud.create({
				name: 'Valid Category',
				slug: 'valid-category',
				order: 1,
			});

			expect(category).toBeDefined();

			// Invalid slug
			await expect(
				categoriesCrud.create({
					name: 'Invalid Slug',
					slug: 'Invalid Slug!', // Contains space and !
					order: 2,
				}),
			).rejects.toThrow();
		});
	});

	describe('Validation with Relations', () => {
		let userId: number;
		let categoryId: number;

		test('setup: create user and category', async () => {
			const crud = drizzleCrud(db, { validation: zod() });

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

		test('should validate foreign key constraints', async () => {
			const postSchema = z.object({
				title: z.string().min(5).max(100),
				slug: z.string(),
				content: z.string().min(10),
				excerpt: z.string().max(200).optional(),
				status: z.enum(['draft', 'published', 'archived']),
				authorId: z.number().int().positive(),
				categoryId: z.number().int().positive().nullable().optional(),
				publishedAt: z.date().nullable().optional(),
			});

			// Create a custom validation adapter with specific schema
			const customValidation = {
				...zod(),
				createInsertSchema: () => postSchema as any,
			};

			const crud = drizzleCrud(db, { validation: customValidation });
			const postsCrud = crud(posts);

			// Valid post
			const post = await postsCrud.create({
				title: 'Valid Post Title',
				slug: 'valid-post',
				content: 'This is valid content for the post.',
				status: 'draft',
				authorId: userId,
				categoryId: categoryId,
			});

			expect(post).toBeDefined();

			// Invalid - non-existent author
			await expect(
				postsCrud.create({
					title: 'Invalid Author',
					slug: 'invalid-author',
					content: 'Content with invalid author',
					status: 'draft',
					authorId: 999999,
				}),
			).rejects.toThrow();
		});
	});

	describe('Validation Error Messages', () => {
		test('should provide clear error messages', async () => {
			const schema = z.object({
				email: z.email('Invalid email format'),
				name: z.string().min(2, 'Name must be at least 2 characters'),
				role: z.enum(['admin', 'editor', 'viewer'], {
					message: 'Role must be admin, editor, or viewer',
				}),
			});

			// Create a custom validation adapter with specific schema
			const customValidation = {
				...zod(),
				createInsertSchema: () => schema as any,
			};

			const crud = drizzleCrud(db, { validation: customValidation });
			const usersCrud = crud(users);

			try {
				await usersCrud.create({
					email: 'not-email',
					name: 'A',
					role: 'invalid' as any,
				});
				expect(true).toBe(false); // Should not reach here
			} catch (error: any) {
				expect(error).toBeDefined();
				// Check if error contains validation details
				expect(error.message).toContain('Invalid email format');
				expect(error.message).toContain('Name must be at least 2 characters');
			}
		});
	});

	describe('Optional Validation', () => {
		test('should work without validation adapter', async () => {
			const crud = drizzleCrud(db); // No validation
			const usersCrud = crud(users);

			const user = await usersCrud.create({
				email: 'no-validation@test.com',
				name: 'No Validation',
				role: 'viewer',
			});

			expect(user).toBeDefined();
			expect(user.email).toBe('no-validation@test.com');
		});

		test('should skip validation when specified in context', async () => {
			const schema = z.object({
				email: z.email(),
				name: z.string().min(10), // Normally too strict
				role: z.enum(['admin', 'editor', 'viewer']),
			});

			// Create a custom validation adapter with specific schema
			const customValidation = {
				...zod(),
				createInsertSchema: () => schema as any,
			};

			const crud = drizzleCrud(db, { validation: customValidation });
			const usersCrud = crud(users);

			// Should work with skipValidation
			const user = await usersCrud.create(
				{
					email: 'skip@test.com',
					name: 'Short', // Too short normally
					role: 'viewer',
				},
				{ skipValidation: true },
			);

			expect(user).toBeDefined();
			expect(user.name).toBe('Short');
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
