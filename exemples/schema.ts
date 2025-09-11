import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Users table with soft delete
export const users = sqliteTable(
	'users',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		email: text('email').notNull().unique(),
		name: text('name').notNull(),
		role: text('role', { enum: ['admin', 'editor', 'viewer'] })
			.notNull()
			.default('viewer'),
		status: text('status', { enum: ['active', 'inactive', 'suspended'] })
			.notNull()
			.default('active'),
		bio: text('bio'),
		avatarUrl: text('avatar_url'),
		countries: text('countries', { mode: 'json' }).default(['PT', 'BR', 'ES']),
		deletedAt: integer('deleted_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index('email_idx').on(table.email),
		index('name_idx').on(table.name),
	],
);

// Categories table
export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	slug: text('slug').notNull().unique(),
	description: text('description'),
	parentId: integer('parent_id').references(() => categories.id),
	order: integer('order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Posts table with relations
export const posts = sqliteTable(
	'posts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		title: text('title').notNull(),
		slug: text('slug').notNull().unique(),
		content: text('content').notNull(),
		excerpt: text('excerpt'),
		status: text('status', { enum: ['draft', 'published', 'archived'] })
			.notNull()
			.default('draft'),
		authorId: integer('author_id')
			.notNull()
			.references(() => users.id),
		categoryId: integer('category_id').references(() => categories.id),
		featuredImageUrl: text('featured_image_url'),
		viewCount: integer('view_count').notNull().default(0),
		publishedAt: integer('published_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index('slug_idx').on(table.slug),
		index('author_idx').on(table.authorId),
		index('status_idx').on(table.status),
	],
);

// Comments table with workspace/tenant support
export const comments = sqliteTable(
	'comments',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		content: text('content').notNull(),
		postId: integer('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		authorId: integer('author_id')
			.notNull()
			.references(() => users.id),
		parentId: integer('parent_id').references(() => comments.id),
		status: text('status', { enum: ['pending', 'approved', 'spam'] })
			.notNull()
			.default('pending'),
		// For multi-tenancy testing
		workspaceId: integer('workspace_id').notNull().default(1),
		likes: integer('likes').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index('post_idx').on(table.postId),
		index('workspace_idx').on(table.workspaceId),
	],
);

// Tags table for many-to-many relations
export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	slug: text('slug').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Post tags junction table
export const postTags = sqliteTable(
	'post_tags',
	{
		postId: integer('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [index('post_tag_pk').on(table.postId, table.tagId)],
);

// Relations (for Drizzle ORM query builder)

export const usersRelations = relations(users, ({ many }) => ({
	posts: many(posts),
	comments: many(comments),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
	parent: one(categories, {
		fields: [categories.parentId],
		references: [categories.id],
	}),
	children: many(categories),
	posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
	author: one(users, {
		fields: [posts.authorId],
		references: [users.id],
	}),
	category: one(categories, {
		fields: [posts.categoryId],
		references: [categories.id],
	}),
	comments: many(comments),
	tags: many(postTags),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
	post: one(posts, {
		fields: [comments.postId],
		references: [posts.id],
	}),
	author: one(users, {
		fields: [comments.authorId],
		references: [users.id],
	}),
	parent: one(comments, {
		fields: [comments.parentId],
		references: [comments.id],
	}),
	replies: many(comments),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	posts: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
	post: one(posts, {
		fields: [postTags.postId],
		references: [posts.id],
	}),
	tag: one(tags, {
		fields: [postTags.tagId],
		references: [tags.id],
	}),
}));
