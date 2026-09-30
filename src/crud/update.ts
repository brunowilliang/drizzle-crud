import {
	and,
	eq,
	type InferInsertModel,
	type InferSelectModel,
	type SQL,
} from 'drizzle-orm';
import type { StandardSchemaV1 } from '../standard-schema.ts';
import type {
	Actor,
	CrudOptions,
	DrizzleDatabase,
	DrizzleTableWithId,
	OperationContext,
	ScopeFilters,
} from '../types.ts';
import { createValidate, getDb } from './utils.ts';

export type UpdateContext<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor,
	TScopeFilters extends ScopeFilters<T, TActor>,
> = {
	db: TDatabase;
	table: T;
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters>;
	schemas: {
		updateSchema?: StandardSchemaV1<Partial<InferInsertModel<T>>>;
	};
	applyScopeFilters: (
		conditions: SQL[],
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	) => SQL[];
	applySoftDeleteFilter: (conditions: SQL[], includeDeleted?: boolean) => SQL[];
};

export function createUpdateMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: UpdateContext<TDatabase, T, TActor, TScopeFilters>) {
	const {
		db,
		table,
		options,
		schemas,
		applyScopeFilters,
		applySoftDeleteFilter,
	} = ctx;
	const { hooks = {} } = options;
	const validate = createValidate(hooks);

	return async (
		id: InferSelectModel<T>['id'],
		updates: Partial<InferInsertModel<T>>,
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	): Promise<InferSelectModel<T>> => {
		const validatedData = await validate(
			'update',
			updates,
			schemas.updateSchema,
			context,
		);

		// Handle async and sync hooks
		const hookResult = hooks.beforeUpdate
			? await hooks.beforeUpdate(validatedData)
			: validatedData;
		const transformed = hookResult ?? validatedData;

		// If no fields to update, just return the existing record
		if (Object.keys(transformed).length === 0) {
			const [existing] = await db
				.select()
				.from(table)
				.where(eq(table.id, id))
				.limit(1);
			return existing as InferSelectModel<T>;
		}

		const dbInstance = getDb(db, context);

		const conditions: SQL[] = [eq(table.id, id)];

		applyScopeFilters(conditions, context);
		applySoftDeleteFilter(conditions, false);

		const whereClause =
			conditions.length > 1 ? and(...conditions) : conditions[0];

		await dbInstance.update(table).set(transformed).where(whereClause);

		// Fetch the updated record
		const [result] = await dbInstance
			.select()
			.from(table)
			.where(eq(table.id, id))
			.limit(1);

		if (!result) {
			throw new Error(`Record with id ${id} not found`);
		}

		return result as InferSelectModel<T>;
	};
}
