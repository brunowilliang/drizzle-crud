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

export type BulkCreateContext<
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

export function createBulkCreateMethod<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(ctx: BulkCreateContext<TDatabase, T, TActor, TScopeFilters>) {
	const { db, table, options, schemas } = ctx;
	const { hooks = {} } = options;
	const validate = createValidate(hooks);

	return async (
		data: T['$inferInsert'][],
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	): Promise<{
		success: boolean;
		count: number;
		items: T['$inferSelect'][];
	}> => {
		// Handle empty array
		if (data.length === 0) {
			return {
				success: true,
				count: 0,
				items: [],
			};
		}

		const dbInstance = getDb(db, context);

		const transformedData = await Promise.all(
			data.map(async (item) => {
				const validated = await validate(
					'bulkCreate',
					item,
					schemas.insertSchema,
					context,
				);

				return hooks.beforeCreate
					? await hooks.beforeCreate(validated)
					: validated;
			}),
		);

		const items = await dbInstance
			.insert(table)
			.values(transformedData)
			.returning();

		return {
			success: true,
			count: items.length,
			items: items as T['$inferSelect'][],
		};
	};
}
