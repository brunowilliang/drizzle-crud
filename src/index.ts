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
	options: DrizzleCrudOptions<TDatabase> = {},
) {
	return function createCrud<
		T extends DrizzleTableWithId,
		TActor extends Actor = Actor,
		TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
	>(
		table: T,
		crudOptions: CrudOptions<TDatabase, T, TActor, TScopeFilters> = {},
	) {
		const validation = crudOptions.validation || options.validation;

		return crudFactory(db, table, {
			...options,
			...crudOptions,
			validation,
		});
	};
}
