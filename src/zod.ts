import {
	createInsertSchema as drizzleCreateInsertSchema,
	createUpdateSchema as drizzleCreateUpdateSchema,
} from 'drizzle-zod';
import { z } from 'zod/v4';
import type { $ZodType } from 'zod/v4/core';

import type {
	DrizzleColumn,
	DrizzleTable,
	DrizzleTableWithId,
	FilterParams,
	ListParams,
	ListSchemaOptions,
	OrderByParams,
	PaginationOptions,
	PaginationParams,
	ValidationAdapter,
} from './types.ts';
import type { InferSelectModel } from 'drizzle-orm';

// ================================
// ZOD VALIDATION ADAPTER
// ================================

export interface ZodAdapterOptions<T extends DrizzleTableWithId> {
	// Override specific schemas
	insert?: (table: T) => $ZodType<InferSelectModel<T>>;
	update?: (table: T) => $ZodType<Partial<InferSelectModel<T>>>;
	list?: (table: T, options: ListSchemaOptions<T>) => $ZodType<ListParams<T>>;
	pagination?: (options: PaginationOptions) => $ZodType<PaginationParams>;
	id?: (table: T) => $ZodType<InferSelectModel<T>['id']>;
	filter?: (
		allowedFilters?: (keyof InferSelectModel<T>)[],
	) => $ZodType<FilterParams<T>>;
	orderBy?: (
		table: T,
		allowedFields?: (keyof InferSelectModel<T>)[],
	) => $ZodType<OrderByParams<T>>;
}

export function zod<T extends DrizzleTableWithId = DrizzleTableWithId>(
	options: ZodAdapterOptions<T> = {},
): ValidationAdapter<T> {
	return {
		createInsertSchema: (table: T) => {
			return options.insert
				? options.insert(table)
				: drizzleCreateInsertSchema(table);
		},

		createUpdateSchema: (table: T) => {
			return options.update
				? options.update(table)
				: drizzleCreateUpdateSchema(table);
		},

		createListSchema: (table: T, listOptions: ListSchemaOptions<T>) => {
			return options.list
				? options.list(table, listOptions)
				: createDefaultListSchema(table, listOptions);
		},

		createPaginationSchema: (paginationOptions: PaginationOptions) => {
			return options.pagination
				? options.pagination(paginationOptions)
				: createDefaultPaginationSchema(paginationOptions);
		},

		createIdSchema: (table: T) => {
			return options.id ? options.id(table) : createDefaultIdSchema(table);
		},

		createFilterSchema: (allowedFilters?: (keyof InferSelectModel<T>)[]) => {
			return options.filter
				? options.filter(allowedFilters)
				: createDefaultFilterSchema(allowedFilters);
		},

		createOrderBySchema: (
			table: T,
			allowedFields?: (keyof InferSelectModel<T>)[],
		) => {
			return options.orderBy
				? options.orderBy(table, allowedFields)
				: createDefaultOrderBySchema(table, allowedFields);
		},
	} as any;
}

// ================================
// DEFAULT ZOD SCHEMA FACTORIES
// ================================

export function createDefaultPaginationSchema(options: PaginationOptions) {
	const { defaultPageSize = 20, maxPageSize = 100 } = options;

	return z.object({
		page: z.number().int().positive().optional().default(1),
		perPage: z
			.number()
			.int()
			.positive()
			.max(maxPageSize)
			.optional()
			.default(defaultPageSize),
	});
}

export function createDefaultIdSchema<T extends DrizzleTableWithId>(table: T) {
	// Try to infer ID type from table schema
	const idColumn = table.id as DrizzleColumn<any>;

	// Check column type to determine appropriate Zod schema
	if (idColumn.dataType === 'number' || idColumn.dataType === 'bigint') {
		return z.number();
	}

	if (idColumn.dataType === 'uuid') {
		return z.uuid();
	}

	// Default to string for other types (text, varchar, etc.)
	return z.string();
}

export function createDefaultFilterSchema<T extends DrizzleTable>(
	allowedFilters?: (keyof InferSelectModel<T>)[],
) {
	if (!allowedFilters || allowedFilters.length === 0) {
		return z.record(z.never(), z.never()).optional();
	}

	const filterValueSchema = z.union([
		z.any(), // Direct value
		z.object({
			equals: z.any().optional(),
			not: z.any().optional(),
			gt: z.any().optional(),
			gte: z.any().optional(),
			lt: z.any().optional(),
			lte: z.any().optional(),
			in: z.array(z.any()).optional(),
			notIn: z.array(z.any()).optional(),
			like: z.string().optional(),
			ilike: z.string().optional(),
			notLike: z.string().optional(),
		}),
	]);

	const singleFilterSchema = z.object(
		Object.fromEntries(
			allowedFilters.map((field) => [
				field as string,
				filterValueSchema.optional(),
			]),
		),
	);

	// Create a schema that allows AND/OR with the single filter schema
	const filterWithLogicalOperators = singleFilterSchema.extend({
		AND: z.array(singleFilterSchema).optional(),
		OR: z.array(singleFilterSchema).optional(),
	});

	return filterWithLogicalOperators.optional();
}

export function createDefaultOrderBySchema<T extends DrizzleTable>(
	table: T,
	allowedFields?: (keyof InferSelectModel<T>)[],
) {
	const tableFields = Object.keys(table) as (keyof InferSelectModel<T>)[];
	const validFields = allowedFields || tableFields;

	return z
		.array(
			z.object({
				field: z.enum(validFields as [string, ...string[]]),
				direction: z.enum(['asc', 'desc']).default('asc'),
			}),
		)
		.optional();
}

export function createDefaultListSchema<T extends DrizzleTable>(
	table: T,
	options: ListSchemaOptions<T>,
) {
	const {
		searchFields,
		allowedFilters,
		allowedOrderFields,
		defaultPageSize = 20,
		maxPageSize = 100,
		allowIncludeDeleted = false,
	} = options;

	const paginationSchema = createDefaultPaginationSchema({
		defaultPageSize,
		maxPageSize,
	});
	const orderBySchema = createDefaultOrderBySchema(table, allowedOrderFields);
	const filterSchema = createDefaultFilterSchema(allowedFilters);

	const searchSchema =
		searchFields && searchFields.length > 0
			? z.string().optional()
			: z.never().optional();

	const baseSchema = z.object({
		...paginationSchema.shape,
		search: searchSchema,
		filters: filterSchema,
		orderBy: orderBySchema,
	});

	if (allowIncludeDeleted) {
		return baseSchema.extend({
			includeDeleted: z.boolean().optional().default(false),
		});
	}

	return baseSchema;
}
