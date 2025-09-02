import { and, inArray, type SQL } from 'drizzle-orm';
import type {
	Actor,
	CrudOptions,
	DrizzleDatabase,
	DrizzleTableWithId,
	OperationContext,
	ScopeFilters,
} from '../types.ts';
import { getDb } from './utils.ts';

export type BulkRestoreContext<
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
	getSoftDeleteValues: () => { deletedValue: any; notDeletedValue: any } | null;
};

export function createBulkRestoreMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: BulkRestoreContext<TDatabase, T, TActor, TScopeFilters>) {
	const { db, table, options, applyScopeFilters, getSoftDeleteValues } = ctx;
	const { softDelete } = options;

	return async (
		ids: T['$inferSelect']['id'][],
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<{ success: boolean; count: number }> => {
		if (!softDelete) {
			throw new Error(
				'Bulk restore operation requires soft delete to be configured',
			);
		}

		const dbInstance = getDb(db, context);
		const deleteValues = getSoftDeleteValues();
		if (!deleteValues) throw new Error('Soft delete configuration error');

		const conditions: SQL[] = [inArray(table.id, ids)];

		applyScopeFilters(conditions, context);

		const whereClause =
			conditions.length > 1 ? and(...conditions) : conditions[0];

		const result = await dbInstance
			.update(table)
			.set({ [softDelete.field]: deleteValues.notDeletedValue } as any)
			.where(whereClause);

		return { success: true, count: result.rowCount || ids.length };
	};
}
