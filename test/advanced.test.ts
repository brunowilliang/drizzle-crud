import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import { eq, relations, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzleCrud } from '../src/index.ts';
import { zod } from '../src/zod.ts';

// Advanced test tables with soft delete and relations
const usersTable = sqliteTable('users', {
	id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull(),
	workspaceId: text('workspace_id').notNull(),
	role: text('role').notNull().default('user'),
	deletedAt: integer('deleted_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(
		sql`(unixepoch() * 1000)`,
	),
});

const postsTable = sqliteTable('posts', {
	id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	content: text('content'),
	authorId: integer('author_id').references(() => usersTable.id),
	workspaceId: text('workspace_id').notNull(),
	deletedAt: integer('deleted_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(
		sql`(unixepoch() * 1000)`,
	),
});

// Relations
const usersRelations = relations(usersTable, ({ many }) => ({
	posts: many(postsTable),
}));

const postsRelations = relations(postsTable, ({ one }) => ({
	author: one(usersTable, {
		fields: [postsTable.authorId],
		references: [usersTable.id],
	}),
}));

// Global test variables
let db: any;
let createCrud: any;

describe('Advanced drizzleCrud Features', () => {
	beforeEach(() => {
		// Fresh database for each test
		const sqlite = new Database(':memory:');
		db = drizzle(sqlite, {
			schema: {
				users: usersTable,
				posts: postsTable,
				usersRelations,
				postsRelations,
			},
		});

		// Create tables
		sqlite.run(`
			CREATE TABLE users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				email TEXT NOT NULL,
				workspace_id TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'user',
				deleted_at INTEGER,
				created_at INTEGER DEFAULT (unixepoch() * 1000)
			)
		`);

		sqlite.run(`
			CREATE TABLE posts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				content TEXT,
				author_id INTEGER REFERENCES users(id),
				workspace_id TEXT NOT NULL,
				deleted_at INTEGER,
				created_at INTEGER DEFAULT (unixepoch() * 1000)
			)
		`);

		createCrud = drizzleCrud(db, { validation: zod() });
	});

	describe('Soft Delete Functionality', () => {
		it('should soft delete a user', async () => {
			const users = createCrud(usersTable, {
				softDelete: { field: 'deletedAt' },
			});

			// Create user
			const user = await users.create({
				name: 'John Doe',
				email: 'john@example.com',
				workspaceId: 'workspace-1',
			});

			// Soft delete
			const deleteResult = await users.deleteOne(user.id);
			expect(deleteResult.success).toBe(true);

			// Should not find deleted user in normal query
			const foundUser = await users.findById(user.id);
			expect(foundUser).toBeUndefined();

			// Should find deleted user when including deleted
			const deletedUser = await users.findById(user.id, {
				includeDeleted: true,
			});
			expect(deletedUser).toBeDefined();
			expect(deletedUser?.deletedAt).toBeInstanceOf(Date);
		});

		it('should restore soft deleted user', async () => {
			const users = createCrud(usersTable, {
				softDelete: { field: 'deletedAt' },
			});

			// Create and delete user
			const user = await users.create({
				name: 'Jane Doe',
				email: 'jane@example.com',
				workspaceId: 'workspace-1',
			});

			await users.deleteOne(user.id);

			// Restore user
			const restoreResult = await users.restore(user.id);
			expect(restoreResult.success).toBe(true);

			// Should find restored user
			const restoredUser = await users.findById(user.id);
			expect(restoredUser).toBeDefined();
			expect(restoredUser?.deletedAt).toBeNull();
		});

		it('should permanently delete user', async () => {
			const users = createCrud(usersTable, {
				softDelete: { field: 'deletedAt' },
			});

			// Create user
			const user = await users.create({
				name: 'Bob Smith',
				email: 'bob@example.com',
				workspaceId: 'workspace-1',
			});

			// Permanent delete
			const deleteResult = await users.permanentDelete(user.id);
			expect(deleteResult.success).toBe(true);

			// Should not find user even with includeDeleted
			const foundUser = await users.findById(user.id, {
				includeDeleted: true,
			});
			expect(foundUser).toBeUndefined();
		});

		it('should bulk delete and restore users', async () => {
			const users = createCrud(usersTable, {
				softDelete: { field: 'deletedAt' },
			});

			// Create multiple users
			const user1 = await users.create({
				name: 'User 1',
				email: 'user1@example.com',
				workspaceId: 'workspace-1',
			});

			const user2 = await users.create({
				name: 'User 2',
				email: 'user2@example.com',
				workspaceId: 'workspace-1',
			});

			// Bulk delete
			const deleteResult = await users.bulkDelete([user1.id, user2.id]);
			expect(deleteResult.success).toBe(true);
			expect(deleteResult.count).toBe(2);

			// Should not find deleted users
			const list = await users.list({});
			expect(list.results).toHaveLength(0);

			// Bulk restore
			const restoreResult = await users.bulkRestore([user1.id, user2.id]);
			expect(restoreResult.success).toBe(true);
			expect(restoreResult.count).toBe(2);

			// Should find restored users
			const restoredList = await users.list({});
			expect(restoredList.results).toHaveLength(2);
		});
	});

	describe('Scope Filters (Multi-Tenant)', () => {
		it('should filter by workspace scope', async () => {
			const users = createCrud(usersTable, {
				scopeFilters: {
					workspaceId: (workspaceId: string, _actor: any) => {
						return eq(usersTable.workspaceId, workspaceId);
					},
				},
			});

			// Create users in different workspaces
			await users.create({
				name: 'User 1',
				email: 'user1@workspace1.com',
				workspaceId: 'workspace-1',
			});

			await users.create({
				name: 'User 2',
				email: 'user2@workspace2.com',
				workspaceId: 'workspace-2',
			});

			// Query with workspace-1 scope
			const context = {
				scope: { workspaceId: 'workspace-1' },
				actor: { type: 'user', properties: { workspaceId: 'workspace-1' } },
			};

			const list = await users.list({}, context);
			expect(list.results).toHaveLength(1);
			expect(list.results[0].workspaceId).toBe('workspace-1');
		});

		it('should filter by role-based access', async () => {
			const users = createCrud(usersTable, {
				scopeFilters: {
					role: (role: string, actor: any) => {
						// Admins can see all, users only themselves
						if (actor.properties.role === 'admin') {
							return undefined; // No restriction
						}
						return eq(usersTable.role, 'user');
					},
				},
			});

			// Create admin and regular user
			await users.create({
				name: 'Admin User',
				email: 'admin@example.com',
				workspaceId: 'workspace-1',
				role: 'admin',
			});

			await users.create({
				name: 'Regular User',
				email: 'user@example.com',
				workspaceId: 'workspace-1',
				role: 'user',
			});

			// Query as regular user (should see only users)
			const userContext = {
				scope: { role: 'user' },
				actor: { type: 'user', properties: { role: 'user' } },
			};

			const userList = await users.list({}, userContext);
			expect(userList.results).toHaveLength(1);
			expect(userList.results[0].role).toBe('user');

			// Query as admin (should see all)
			const adminContext = {
				scope: { role: 'admin' },
				actor: { type: 'user', properties: { role: 'admin' } },
			};

			const adminList = await users.list({}, adminContext);
			expect(adminList.results).toHaveLength(2); // Both admin and user
		});
	});

	describe('Relations Support', () => {
		it('should query users with posts relation', async () => {
			const users = createCrud(usersTable);
			const posts = createCrud(postsTable);

			// Create user
			const user = await users.create({
				name: 'Author',
				email: 'author@example.com',
				workspaceId: 'workspace-1',
			});

			// Create posts for user
			await posts.create({
				title: 'First Post',
				content: 'Hello world',
				authorId: user.id,
				workspaceId: 'workspace-1',
			});

			await posts.create({
				title: 'Second Post',
				content: 'Another post',
				authorId: user.id,
				workspaceId: 'workspace-1',
			});

			// Query user with posts
			const userWithPosts = await users.findById(user.id, {
				with: {
					posts: {
						columns: {
							id: true,
							title: true,
							content: true,
						},
					},
				},
			});

			expect(userWithPosts).toBeDefined();
			expect(userWithPosts?.posts).toHaveLength(2);
			expect(userWithPosts?.posts[0].title).toBe('First Post');
			expect(userWithPosts?.posts[1].title).toBe('Second Post');
		});

		it('should query posts with author relation', async () => {
			const users = createCrud(usersTable);
			const posts = createCrud(postsTable);

			// Create user
			const user = await users.create({
				name: 'John Author',
				email: 'john@example.com',
				workspaceId: 'workspace-1',
			});

			// Create post
			const post = await posts.create({
				title: 'Test Post',
				content: 'Test content',
				authorId: user.id,
				workspaceId: 'workspace-1',
			});

			// Query post with author
			const postWithAuthor = await posts.findById(post.id, {
				with: {
					author: {
						columns: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			});

			expect(postWithAuthor).toBeDefined();
			expect(postWithAuthor?.author).toBeDefined();
			expect(postWithAuthor?.author.name).toBe('John Author');
			expect(postWithAuthor?.author.email).toBe('john@example.com');
		});

		it('should support complex nested relations queries', async () => {
			const users = createCrud(usersTable);
			const posts = createCrud(postsTable);

			// Create user
			const user = await users.create({
				name: 'Complex Author',
				email: 'complex@example.com',
				workspaceId: 'workspace-1',
			});

			// Create post
			await posts.create({
				title: 'Complex Post',
				content: 'Complex content',
				authorId: user.id,
				workspaceId: 'workspace-1',
			});

			// Query user with nested post relations
			const result = await users.findById(user.id, {
				columns: {
					id: true,
					name: true,
				},
				with: {
					posts: {
						columns: {
							id: true,
							title: true,
						},
						with: {
							author: {
								columns: {
									id: true,
									email: true,
								},
							},
						},
					},
				},
			});

			expect(result).toBeDefined();
			expect(result?.posts).toHaveLength(1);
			expect(result?.posts[0].author).toBeDefined();
			expect(result?.posts[0].author.email).toBe('complex@example.com');
		});
	});

	describe('Combined Features', () => {
		it('should combine soft delete + scope filters + relations', async () => {
			const users = createCrud(usersTable, {
				softDelete: { field: 'deletedAt' },
				scopeFilters: {
					workspaceId: (workspaceId: string) =>
						eq(usersTable.workspaceId, workspaceId),
				},
			});

			const posts = createCrud(postsTable, {
				softDelete: { field: 'deletedAt' },
				scopeFilters: {
					workspaceId: (workspaceId: string) =>
						eq(postsTable.workspaceId, workspaceId),
				},
			});

			// Create users in different workspaces
			const user1 = await users.create({
				name: 'User 1',
				email: 'user1@ws1.com',
				workspaceId: 'workspace-1',
			});

			const user2 = await users.create({
				name: 'User 2',
				email: 'user2@ws2.com',
				workspaceId: 'workspace-2',
			});

			// Create posts
			await posts.create({
				title: 'Post 1',
				content: 'Content 1',
				authorId: user1.id,
				workspaceId: 'workspace-1',
			});

			// Soft delete user1
			await users.deleteOne(user1.id, {
				scope: { workspaceId: 'workspace-1' },
			});

			// Query workspace-1 (should not see deleted user)
			const context1 = {
				scope: { workspaceId: 'workspace-1' },
			};

			const ws1Users = await users.list({}, context1);
			expect(ws1Users.results).toHaveLength(0); // User1 is soft deleted

			// Query workspace-2 (should see user2)
			const context2 = {
				scope: { workspaceId: 'workspace-2' },
			};

			const ws2Users = await users.list({}, context2);
			expect(ws2Users.results).toHaveLength(1);
			expect(ws2Users.results[0].id).toBe(user2.id);

			// Query with includeDeleted in workspace-1
			const ws1DeletedUsers = await users.list(
				{ includeDeleted: true },
				context1,
			);
			expect(ws1DeletedUsers.results).toHaveLength(1);
			expect(ws1DeletedUsers.results[0].deletedAt).toBeInstanceOf(Date);
		});

		it('should handle advanced filtering with scope and soft delete', async () => {
			const users = createCrud(usersTable, {
				allowedFilters: ['name', 'email', 'role'],
				softDelete: { field: 'deletedAt' },
				scopeFilters: {
					workspaceId: (workspaceId: string) =>
						eq(usersTable.workspaceId, workspaceId),
				},
			});

			// Create multiple users
			const admin = await users.create({
				name: 'Admin User',
				email: 'admin@ws1.com',
				workspaceId: 'workspace-1',
				role: 'admin',
			});

			const regularUser = await users.create({
				name: 'Regular User',
				email: 'user@ws1.com',
				workspaceId: 'workspace-1',
				role: 'user',
			});

			await users.create({
				name: 'Other User',
				email: 'other@ws2.com',
				workspaceId: 'workspace-2',
				role: 'user',
			});

			// Delete regular user
			await users.deleteOne(regularUser.id, {
				scope: { workspaceId: 'workspace-1' },
			});

			// Complex query: workspace-1 + role=admin + not deleted
			const context = {
				scope: { workspaceId: 'workspace-1' },
			};

			const adminUsers = await users.list(
				{
					filters: { role: 'admin' },
				},
				context,
			);

			expect(adminUsers.results).toHaveLength(1);
			expect(adminUsers.results[0].id).toBe(admin.id);
			expect(adminUsers.results[0].role).toBe('admin');
		});
	});

	describe('Hooks Integration', () => {
		it('should execute beforeCreate and beforeUpdate hooks', async () => {
			const users = createCrud(usersTable, {
				hooks: {
					beforeCreate: (data: any) => ({
						...data,
						name: `Created: ${data.name}`,
					}),
					beforeUpdate: (data: any) => ({
						...data,
						name: data.name ? `Updated: ${data.name}` : data.name,
					}),
				},
			});

			// Test beforeCreate hook
			const user = await users.create({
				name: 'John',
				email: 'john@example.com',
				workspaceId: 'workspace-1',
			});

			expect(user.name).toBe('Created: John');

			// Test beforeUpdate hook
			const updated = await users.update(user.id, {
				name: 'Jane',
			});

			expect(updated.name).toBe('Updated: Jane');
		});
	});
});
