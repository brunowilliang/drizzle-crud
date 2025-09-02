import { and, eq, type SQL } from 'drizzle-orm';
import type {
	Actor,
	CrudOptions,
	DrizzleDatabase,
	DrizzleTableWithId,
	OperationContext,
	ScopeFilters,
} from '../types.ts';
import { getDb } from './utils.ts';

export type PermanentDeleteContext<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor,
	TScopeFilters extends ScopeFilters<T, TActor>,
> = {
	db: TDatabase;
	table: T;
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters>;
	applyScopeFilters: (
		conditions: SQL[],
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	) => SQL[];
};

export function createPermanentDeleteMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: PermanentDeleteContext<TDatabase, T, TActor, TScopeFilters>) {
	const { db, table, applyScopeFilters } = ctx;

	return async (
		id: T['$inferSelect']['id'],
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<{ success: boolean }> => {
		const dbInstance = getDb(db, context);

		// Check if record exists
		const existing = await dbInstance
			.select({ id: table.id })
			.from(table)
			.where(eq(table.id, id))
			.limit(1);

		if (existing.length === 0) {
			throw new Error(`Record with id ${id} not found`);
		}

		// Build where conditions
		const conditions: SQL[] = [eq(table.id, id)];
		applyScopeFilters(conditions, context);
		const whereClause =
			conditions.length > 1 ? and(...conditions) : conditions[0];

		await dbInstance.delete(table).where(whereClause);
		return { success: true };
	};
}
