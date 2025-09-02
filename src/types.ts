import type {
	Column as DrizzleColumn,
	Table as DrizzleTable,
	SQL,
} from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type { StandardSchemaV1 } from './standard-schema.ts';

export type DrizzleDatabase = BaseSQLiteDatabase<any, any, any, any>;

export type { DrizzleTable, DrizzleColumn };

export type DrizzleTableWithId = DrizzleTable & {
	id: DrizzleColumn<any>;
};

export type FilterOperator =
	| 'eq'
	| 'ne'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'in'
	| 'like'
	| 'ilike';

export type FilterValue<T> =
	| T
	| {
			op: FilterOperator;
			value: T | T[];
	  };

export type ColumnsSelection<T extends DrizzleTableWithId> = Partial<
	Record<keyof T['$inferSelect'], boolean>
>;

export type SoftDeleteConfig<T extends DrizzleTable> = {
	field: keyof T['$inferSelect']; // e.g., 'deletedAt' or 'isDeleted'
	deletedValue?: any; // What to set when soft deleting (defaults to new Date() for timestamps, true for booleans)
	notDeletedValue?: any; // What represents "not deleted" (defaults to null for timestamps, false for booleans)
};

export type DrizzleCrudOptions = {
	validation?: ValidationAdapter;
};

export type CrudOperation =
	| 'create'
	| 'update'
	| 'findById'
	| 'list'
	| 'deleteOne'
	| 'restore'
	| 'permanentDelete'
	| 'bulkCreate'
	| 'bulkDelete'
	| 'bulkRestore';

export type CrudOptions<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
> = {
	searchFields?: (keyof T['$inferSelect'])[];
	/**
	 * The default page size (items per page).
	 * @default 20
	 */
	defaultPageSize?: number;
	/**
	 * The maximum page size allowed.
	 * @default 100
	 */
	maxPageSize?: number;
	/**
	 * The allowed fields to be used in the filters parameter.
	 * e.g., ['name', 'email']
	 */
	allowedFilters?: (keyof T['$inferSelect'])[];
	/**
	 * Enable soft delete for the table.
	 * e.g., { field: 'deletedAt', deletedValue: new Date(), notDeletedValue: null }
	 */
	softDelete?: SoftDeleteConfig<T>;
	/**
	 * Scope filters are used to filter the data based on the actor.
	 * e.g., { workspaceId: (value) => eq(table.workspaceId, value) }
	 */
	scopeFilters?: TScopeFilters;
	/**
	 * Hooks are used to run code before crud operations.
	 */
	hooks?: {
		validate?: (params: {
			data: any;
			context: OperationContext<TDatabase, T, TActor, TScopeFilters>;
			operation: CrudOperation | 'custom';
		}) => boolean;
		beforeCreate?: (data: T['$inferInsert']) => T['$inferInsert'];
		beforeUpdate?: (
			data: Partial<T['$inferInsert']>,
		) => Partial<T['$inferInsert']>;
	};
	/**
	 * Validation adapter is used to validate the data.
	 */
	validation?: ValidationAdapter<T>;
};

export type ListParams<T extends DrizzleTableWithId> = {
	page?: number;
	perPage?: number;
	search?: string;
	filters?: FilterParams<T['$inferSelect']>;
	orderBy?: {
		field: keyof T['$inferSelect'];
		direction: 'asc' | 'desc';
	}[];
	includeDeleted?: boolean;
};

export type FindByIdParams = {
	includeDeleted?: boolean;
};

export interface Actor<
	T extends string = string,
	TProperties extends Record<string, any> = Record<string, any>,
	TMetadata extends Record<string, any> = Record<string, any>,
> {
	type: T;
	properties: TProperties;
	metadata?: TMetadata;
}

export type ScopeFilters<
	T extends DrizzleTable,
	TActor extends Actor = Actor,
> = Partial<{
	[K in keyof T['$inferSelect']]: (
		value: T['$inferSelect'][K],
		actor: TActor,
	) => SQL | undefined;
}> &
	Record<string, (value: any, actor: TActor) => SQL | undefined>;

type ScopeFromFilters<T> = T extends Record<infer K, any>
	? Partial<Record<K, any>>
	: Record<string, any>;

export type OperationContext<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTable,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
> = {
	db?: TDatabase;
	scope?: ScopeFromFilters<TScopeFilters>; // Context-based filters like { workspaceId: 'workspace-123' }
	actor?: TActor;
	skipValidation?: boolean;
};

export type PaginationParams = {
	page?: number;
	perPage?: number;
};

export type PaginatedResponse<T> = {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	page: number;
	perPage: number;
	results: T[];
	totalItems: number;
	totalPages: number;
};

export type OrderByParams<T extends DrizzleTable> = {
	field: keyof T['$inferSelect'];
	direction: 'asc' | 'desc';
};

export type Filter<T = any> = {
	equals?: T;
	not?: T;
	gt?: T;
	gte?: T;
	lt?: T;
	lte?: T;
	in?: T[];
	like?: string;
	ilike?: string;
};

export type FilterParams<T extends Record<string, any>> = {
	[K in keyof T]?: T[K] | Filter<T[K]>;
} & {
	AND?: FilterParams<T>[];
	OR?: FilterParams<T>[];
};

export interface ValidationAdapter<
	T extends DrizzleTableWithId = DrizzleTableWithId,
> {
	createInsertSchema: <TSchema extends StandardSchemaV1<T['$inferInsert']>>(
		table: T,
	) => TSchema;
	createUpdateSchema: <
		TSchema extends StandardSchemaV1<Partial<T['$inferInsert']>>,
	>(
		table: T,
	) => TSchema;
	createListSchema: <TSchema extends StandardSchemaV1<ListParams<T>>>(
		table: T,
		options: ListSchemaOptions<T>,
	) => TSchema;
	createPaginationSchema: <TSchema extends StandardSchemaV1<PaginationParams>>(
		options: PaginationOptions,
	) => TSchema;
	createIdSchema: <TSchema extends StandardSchemaV1<T['$inferSelect']['id']>>(
		table: T,
	) => TSchema;
	createFilterSchema: <TSchema extends StandardSchemaV1<FilterParams<T>>>(
		allowedFilters?: (keyof T['$inferSelect'])[],
	) => TSchema;
	createOrderBySchema: <TSchema extends StandardSchemaV1<OrderByParams<T>>>(
		table: T,
		allowedFields?: (keyof T['$inferSelect'])[],
	) => TSchema;
}

export interface PaginationOptions {
	defaultPageSize: number;
	maxPageSize: number;
}

export interface ListSchemaOptions<T extends DrizzleTable> {
	searchFields?: (keyof T['$inferSelect'])[];
	allowedFilters?: (keyof T['$inferSelect'])[];
	allowedOrderFields?: (keyof T['$inferSelect'])[];
	defaultPageSize?: number;
	maxPageSize?: number;
	allowIncludeDeleted?: boolean;
}
