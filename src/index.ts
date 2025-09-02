import { crudFactory } from './crud-factory.ts';
import type {
	Actor,
	CrudOptions,
	DrizzleCrudOptions,
	DrizzleDatabase,
	DrizzleTableWithId,
	ScopeFilters,
} from './types.ts';

export { filtersToWhere } from './filters.ts';
export type * from './types.ts';

export function drizzleCrud<TDatabase extends DrizzleDatabase>(
	db: TDatabase,
	options: DrizzleCrudOptions = {},
) {
	return function createCrud<
		T extends DrizzleTableWithId,
		TActor extends Actor = Actor,
		TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
	>(
		table: T,
		crudOptions: CrudOptions<TDatabase, T, TActor, TScopeFilters> = {},
	) {
		if (!table) {
			throw new Error('Table is required for createCrud');
		}

		const validation = crudOptions.validation || options.validation;

		const mergedOptions: CrudOptions<TDatabase, T, TActor, TScopeFilters> = {
			...options,
			...crudOptions,
			validation: validation as any,
		};

		return crudFactory(db, table, mergedOptions);
	};
}
