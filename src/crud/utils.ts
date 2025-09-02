import type { StandardSchemaV1 } from '../standard-schema.ts';
import { standardValidate } from '../standard-schema.ts';
import type {
	Actor,
	CrudOperation,
	CrudOptions,
	DrizzleDatabase,
	DrizzleTableWithId,
	OperationContext,
	ScopeFilters,
} from '../types.ts';

export function getDb<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor,
	TScopeFilters extends ScopeFilters<T, TActor>,
>(
	db: TDatabase,
	context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
) {
	return context?.db || db;
}

export function createValidate<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor,
	TScopeFilters extends ScopeFilters<T, TActor>,
>(hooks: CrudOptions<TDatabase, T, TActor, TScopeFilters>['hooks'] = {}) {
	const validateHook = hooks.validate;

	return async <TInput, TOutput>(
		operation: CrudOperation,
		data: TInput,
		schema?: StandardSchemaV1<TInput, TOutput>,
		context: OperationContext<TDatabase, T, TActor, TScopeFilters> = {},
	) => {
		// Skip validation if context says so
		if (context?.skipValidation) {
			return data;
		}

		// Run hook validation if provided
		if (validateHook) {
			const shouldValidate = validateHook({
				data,
				context,
				operation,
			});
			// If hook returns false, skip validation
			if (!shouldValidate) {
				return data;
			}
		}

		// Run schema validation if provided
		if (schema) {
			return standardValidate(schema, data);
		}

		return data;
	};
}
