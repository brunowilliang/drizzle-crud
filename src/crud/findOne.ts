import type {
	InferInsertModel,
	InferSelectModel,
	KnownKeysOnly,
} from 'drizzle-orm';
import { and, eq, type SQL } from 'drizzle-orm';
import type { BuildQueryResult, DBQueryConfig } from 'drizzle-orm/relations';
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
	tableName: keyof TDatabase['_']['relations'];
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters>;
	getColumn: (key: keyof InferInsertModel<T>) => DrizzleColumn<any, any>;
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

	type TSchema = TDatabase['_']['relations'];
	type TFields = TSchema[typeof tableName];
	type QueryOneGeneric = DBQueryConfig<'one', TSchema, TFields>;
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
		where: Partial<InferSelectModel<T>>,
		params?: FindByIdParams,
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<InferSelectModel<T> | null>;
	function findOne<TSelections extends QueryOneGeneric>(
		where: Partial<InferSelectModel<T>>,
		params?: FindOneInput<TSelections> & FindByIdParams,
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<FindOneResult<TSelections> | null>;
	async function findOne<TSelections extends QueryOneGeneric = QueryOneGeneric>(
		where: Partial<InferSelectModel<T>>,
		params?: (FindOneInput<TSelections> & FindByIdParams) | FindByIdParams,
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<FindOneResult<TSelections> | InferSelectModel<T> | null> {
		const dbInstance = getDb(db, context);
		const conditions: SQL[] = [];

		// Build conditions from the where object
		Object.entries(where).forEach(([key, value]) => {
			if (value !== undefined) {
				const column = getColumn(key as keyof InferInsertModel<T>);
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
