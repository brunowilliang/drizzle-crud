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

export type CreateContext<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor,
	TScopeFilters extends ScopeFilters<T, TActor>,
> = {
	db: TDatabase;
	table: T;
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters>;
	schemas: {
		insertSchema?: StandardSchemaV1<T['$inferInsert']>;
	};
};

export function createCreateMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: CreateContext<TDatabase, T, TActor, TScopeFilters>) {
	const { db, table, options, schemas } = ctx;
	const { hooks = {} } = options;
	const validate = createValidate(hooks);

	return async (
		data: T['$inferInsert'],
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	): Promise<T['$inferSelect']> => {
		const validatedData = await validate(
			'create',
			data,
			schemas.insertSchema,
			context,
		);

		// Handle async and sync hooks
		const hookResult = hooks.beforeCreate
			? await hooks.beforeCreate(validatedData)
			: validatedData;
		const transformed = hookResult ?? validatedData;

		const dbInstance = getDb(db, context);

		const [result] = await dbInstance
			.insert(table)
			.values(transformed)
			.returning();

		return result as T['$inferSelect'];
	};
}
