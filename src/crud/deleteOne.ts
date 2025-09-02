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

export type DeleteOneContext<
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

export function createDeleteOneMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: DeleteOneContext<TDatabase, T, TActor, TScopeFilters>) {
	const { db, table, options, applyScopeFilters, getSoftDeleteValues } = ctx;
	const { softDelete } = options;

	return async (
		id: T['$inferSelect']['id'],
		context?: Omit<
			OperationContext<TDatabase, T, TActor, TScopeFilters>,
			'skipValidation'
		>,
	): Promise<{ success: boolean }> => {
		const dbInstance = getDb(db, context);

		const conditions: SQL[] = [eq(table.id, id)];
		applyScopeFilters(conditions, context);

		const whereClause =
			conditions.length > 1 ? and(...conditions) : conditions[0];

		if (softDelete) {
			const deleteValues = getSoftDeleteValues();
			if (!deleteValues) throw new Error('Soft delete configuration error');

			await dbInstance
				.update(table)
				.set({ [softDelete.field]: deleteValues.deletedValue } as any)
				.where(whereClause);
		} else {
			await dbInstance.delete(table).where(whereClause);
		}

		return { success: true };
	};
}
