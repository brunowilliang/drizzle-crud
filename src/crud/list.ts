import type { KnownKeysOnly } from 'drizzle-orm';
import { and, asc, count, desc, type SQL } from 'drizzle-orm';
import type {
	BuildQueryResult,
	DBQueryConfig,
	ExtractTablesWithRelations,
} from 'drizzle-orm/relations';
import { parseFilters } from '../filters.ts';
import type { StandardSchemaV1 } from '../standard-schema.ts';
import type {
	Actor,
	CrudOptions,
	DrizzleColumn,
	DrizzleDatabase,
	DrizzleTableWithId,
	ListParams,
	OperationContext,
	ScopeFilters,
} from '../types.ts';
import { createValidate, getDb } from './utils.ts';

export type ListContext<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor,
	TScopeFilters extends ScopeFilters<T, TActor>,
> = {
	db: TDatabase;
	table: T;
	tableName: keyof TDatabase['_']['fullSchema'];
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters>;
	schemas: {
		listSchema?: StandardSchemaV1<ListParams<T>>;
	};
	defaultPageSize: number;
	maxPageSize: number;
	searchFields: (keyof T['$inferSelect'])[];
	allowedFilters: (keyof T['$inferSelect'])[];
	getColumn: (key: keyof T['$inferInsert']) => DrizzleColumn<any, any, any>;
	applySearch: (conditions: SQL[], search?: string) => void;
	applyScopeFilters: (
		conditions: SQL[],
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	) => SQL[];
	applySoftDeleteFilter: (conditions: SQL[], includeDeleted?: boolean) => SQL[];
};

export function createListMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: ListContext<TDatabase, T, TActor, TScopeFilters>) {
	const {
		db,
		table,
		tableName,
		options,
		schemas,
		defaultPageSize,
		maxPageSize,
		allowedFilters,
		getColumn,
		applySearch,
		applyScopeFilters,
		applySoftDeleteFilter,
	} = ctx;

	const validate = createValidate(options.hooks);

	type TSchema = ExtractTablesWithRelations<TDatabase['_']['fullSchema']>;
	type TFields = TSchema[typeof tableName];
	type QueryManyGeneric = DBQueryConfig<'many', true, TSchema, TFields>;
	type ListGeneric = Omit<QueryManyGeneric, 'offset' | 'where'> &
		ListParams<T> & {
			where?: SQL;
		};
	type ListInput<TSelections extends ListGeneric> = KnownKeysOnly<
		TSelections,
		ListGeneric
	>;
	type ListResult<TSelections extends QueryManyGeneric> = BuildQueryResult<
		TSchema,
		TFields,
		TSelections
	>[];

	function list(
		params: ListParams<T>,
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	): Promise<{
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		page: number;
		perPage: number;
		results: T['$inferSelect'][];
		totalItems: number;
		totalPages: number;
	}>;
	function list<TSelections extends ListGeneric>(
		params: ListInput<TSelections>,
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	): Promise<{
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		page: number;
		perPage: number;
		results: ListResult<TSelections>;
		totalItems: number;
		totalPages: number;
	}>;
	async function list<TSelections extends ListGeneric = ListGeneric>(
		params: ListInput<TSelections> | ListParams<T>,
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	): Promise<{
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		page: number;
		perPage: number;
		results: ListResult<TSelections> | T['$inferSelect'][];
		totalItems: number;
		totalPages: number;
	}> {
		const dbInstance = getDb(db, context);
		// const builder = (dbInstance as any).query[tableName];

		const validatedParams = await validate(
			'list',
			params,
			schemas.listSchema,
			context,
		);

		// Build where conditions
		const conditions: SQL[] = [];

		if ('where' in params && params.where) {
			conditions.push(params.where);
		}

		const parsedFilters = parseFilters(
			table,
			validatedParams.filters,
			allowedFilters,
		);
		conditions.push(...parsedFilters);

		applySearch(conditions, validatedParams.search);
		applyScopeFilters(conditions, context);
		applySoftDeleteFilter(conditions, validatedParams.includeDeleted);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const perPage = Math.min(
			validatedParams.perPage || defaultPageSize,
			maxPageSize,
		);
		const page = validatedParams.page || 1;
		const offset = (page - 1) * perPage;

		const orderBy = validatedParams.orderBy?.map(({ field, direction }) => {
			const column = getColumn(field as keyof T['$inferInsert']);
			return direction === 'desc' ? desc(column) : asc(column);
		});

		// Use standard query API for SQLite compatibility
		const baseQuery = dbInstance.select().from(table);

		const queryWithWhere = whereClause
			? baseQuery.where(whereClause)
			: baseQuery;

		const queryWithOrder =
			orderBy && orderBy.length > 0
				? queryWithWhere.orderBy(...orderBy)
				: queryWithWhere;

		const data = await queryWithOrder.limit(perPage).offset(offset);

		let countQuery = (dbInstance as any).select({ count: count() }).from(table);

		const countConditions: SQL[] = [...conditions];

		if (countConditions.length > 0) {
			countQuery = countQuery.where(and(...countConditions));
		}

		const totalResult = await countQuery;

		const totalItems = totalResult[0].count as number;
		const totalPages = Math.ceil(totalItems / perPage);
		const hasNextPage = page < totalPages;
		const hasPreviousPage = page > 1;

		return {
			hasNextPage,
			hasPreviousPage,
			page,
			perPage,
			results: data,
			totalItems,
			totalPages,
		};
	}

	return list;
}
