import type { KnownKeysOnly } from 'drizzle-orm';
import { and, eq, type SQL } from 'drizzle-orm';
import type {
	BuildQueryResult,
	DBQueryConfig,
	ExtractTablesWithRelations,
} from 'drizzle-orm/relations';
import type {
	Actor,
	CrudOptions,
	DrizzleColumn,
	DrizzleDatabase,
	DrizzleTableWithId,
	FindByIdParams,
	OperationContext,
	ScopeFilters,
} from '../types.ts';
import { getDb } from './utils.ts';

export type FindOneContext<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor,
	TScopeFilters extends ScopeFilters<T, TActor>,
> = {
	db: TDatabase;
	table: T;
	tableName: keyof TDatabase['_']['fullSchema'];
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters>;
	getColumn: (key: keyof T['$inferInsert']) => DrizzleColumn<any, any, any>;
	applyScopeFilters: (
		conditions: SQL[],
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	) => SQL[];
	applySoftDeleteFilter: (conditions: SQL[], includeDeleted?: boolean) => SQL[];
};

export function createFindOneMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: FindOneContext<TDatabase, T, TActor, TScopeFilters>) {
	const {
		db,
		table,
		tableName,
		getColumn,
		applyScopeFilters,
		applySoftDeleteFilter,
	} = ctx;

	type TSchema = ExtractTablesWithRelations<TDatabase['_']['fullSchema']>;
	type TFields = TSchema[typeof tableName];
	type QueryOneGeneric = DBQueryConfig<'one', true, TSchema, TFields>;
	type FindOneInput<TSelections extends QueryOneGeneric> = KnownKeysOnly<
		TSelections,
		QueryOneGeneric
	>;
	type FindOneResult<TSelections extends QueryOneGeneric> = BuildQueryResult<
		TSchema,
		TFields,
		TSelections
	>;

	function findOne(
		where: Partial<T['$inferSelect']>,
		params?: FindByIdParams,
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<T['$inferSelect'] | null>;
	function findOne<TSelections extends QueryOneGeneric>(
		where: Partial<T['$inferSelect']>,
		params?: FindOneInput<TSelections> & FindByIdParams,
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<FindOneResult<TSelections> | null>;
	async function findOne<TSelections extends QueryOneGeneric = QueryOneGeneric>(
		where: Partial<T['$inferSelect']>,
		params?: (FindOneInput<TSelections> & FindByIdParams) | FindByIdParams,
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<FindOneResult<TSelections> | T['$inferSelect'] | null> {
		const dbInstance = getDb(db, context);
		const conditions: SQL[] = [];

		// Build conditions from the where object
		Object.entries(where).forEach(([key, value]) => {
			if (value !== undefined) {
				const column = getColumn(key as keyof T['$inferInsert']);
				conditions.push(eq(column, value));
			}
		});

		if (conditions.length === 0) {
			throw new Error('findOne requires at least one search condition');
		}

		applyScopeFilters(conditions, context);
		applySoftDeleteFilter(conditions, params?.includeDeleted);

		const whereClause =
			conditions.length > 1 ? and(...conditions) : conditions[0];

		// Use the standard query API for better compatibility
		const query = dbInstance.select().from(table).where(whereClause).limit(1);

		const result = await query;

		return result.length > 0 ? (result[0] as FindOneResult<TSelections>) : null;
	}

	return findOne;
}
