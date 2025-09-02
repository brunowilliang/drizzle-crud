import { eq, isNull, like, or, SQL } from 'drizzle-orm';

import { createBulkCreateMethod } from './crud/bulkCreate.ts';
import { createBulkDeleteMethod } from './crud/bulkDelete.ts';
import { createBulkRestoreMethod } from './crud/bulkRestore.ts';
import { createCreateMethod } from './crud/create.ts';
import { createDeleteOneMethod } from './crud/deleteOne.ts';
import { createFindOneMethod } from './crud/findOne.ts';
import { createListMethod } from './crud/list.ts';
import { createPermanentDeleteMethod } from './crud/permanentDelete.ts';
import { createRestoreMethod } from './crud/restore.ts';
import { createUpdateMethod } from './crud/update.ts';
import type {
	Actor,
	CrudOptions,
	DrizzleColumn,
	DrizzleDatabase,
	DrizzleTableWithId,
	ListSchemaOptions,
	OperationContext,
	ScopeFilters,
	ValidationAdapter,
} from './types.ts';

function createSchemas<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
	TValidation extends ValidationAdapter<T> = ValidationAdapter<T>,
>(
	table: T,
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters>,
	validation?: TValidation,
) {
	if (!validation) {
		return {
			insertSchema: undefined,
			updateSchema: undefined,
			listSchema: undefined,
			idSchema: undefined,
		};
	}

	const listOptions: ListSchemaOptions<T> = {
		searchFields: options.searchFields,
		allowedFilters: options.allowedFilters,
		defaultPageSize: options.defaultPageSize,
		maxPageSize: options.maxPageSize,
		allowIncludeDeleted: !!options.softDelete,
	};

	// Check if validation is a custom object with schemas
	const customSchemas = options.validation as any;
	if (customSchemas && !customSchemas.createInsertSchema) {
		// Custom schemas provided directly
		return {
			insertSchema: customSchemas.createSchema || customSchemas.insertSchema,
			updateSchema: customSchemas.updateSchema,
			listSchema: customSchemas.listSchema,
			idSchema: customSchemas.idSchema,
		};
	}

	// Use validation adapter to create schemas
	return {
		insertSchema: validation.createInsertSchema(table),
		updateSchema: validation.createUpdateSchema(table),
		listSchema: validation.createListSchema(table, listOptions),
		idSchema: validation.createIdSchema(table),
	};
}

export function crudFactory<
	TDatabase extends DrizzleDatabase,
	T extends DrizzleTableWithId,
	TActor extends Actor = Actor,
	TScopeFilters extends ScopeFilters<T, TActor> = ScopeFilters<T, TActor>,
>(
	db: TDatabase,
	table: T,
	options: CrudOptions<TDatabase, T, TActor, TScopeFilters> = {},
) {
	if (!table) {
		throw new Error('Table is required for crudFactory');
	}

	const {
		searchFields = [],
		defaultPageSize = 20,
		maxPageSize = 100,
		allowedFilters = [],
		softDelete,
		scopeFilters = {} as TScopeFilters,
		validation,
	} = options;

	// Access table name from Symbol for SQLite compatibility
	const tableNameSymbol = Object.getOwnPropertySymbols(table).find(
		(sym) => sym.toString() === 'Symbol(drizzle:Name)',
	);

	if (!tableNameSymbol) {
		throw new Error('Unable to find table name symbol');
	}

	const tableName = (table as any)[
		tableNameSymbol
	] as keyof TDatabase['_']['fullSchema'];

	const schemas = createSchemas(table, options, validation);

	const getColumn = (key: keyof T['$inferInsert']) => {
		return table[key as keyof T] as DrizzleColumn<any, any, any>;
	};

	const applySearch = (conditions: SQL[], search?: string) => {
		if (search?.trim() && searchFields.length > 0) {
			const searchConditions = searchFields.map((field) =>
				// Use 'like' for SQLite compatibility (case-sensitive)
				// TODO: In the future, implement dialect detection for proper case-insensitive search
				like(getColumn(field), `%${search}%`),
			);
			conditions.push(or(...searchConditions)!);
		}
	};

	const applyScopeFilters = (
		conditions: SQL[],
		context?: OperationContext<TDatabase, T, TActor, TScopeFilters>,
	) => {
		Object.entries(scopeFilters).forEach(([key, filterFn]) => {
			const condition = filterFn(
				context?.scope?.[key],
				context?.actor as TActor,
			);

			if (condition) {
				conditions.push(condition);
			}
		});

		return conditions;
	};

	const applySoftDeleteFilter = (conditions: SQL[], includeDeleted = false) => {
		if (!softDelete || includeDeleted) return conditions;

		const column = getColumn(softDelete.field);
		const notDeletedValue = softDelete.notDeletedValue ?? null;

		// Use isNull for null values, eq for other values
		if (notDeletedValue === null) {
			conditions.push(isNull(column));
		} else {
			conditions.push(eq(column, notDeletedValue));
		}
		return conditions;
	};

	const getSoftDeleteValues = () => {
		if (!softDelete) return null;

		const deletedValue = softDelete.deletedValue ?? new Date();
		const notDeletedValue = softDelete.notDeletedValue ?? null;

		return { deletedValue, notDeletedValue };
	};

	const create = createCreateMethod({
		db,
		table,
		options,
		schemas,
	});

	const findOne = createFindOneMethod({
		db,
		table,
		tableName,
		options,
		getColumn,
		applyScopeFilters,
		applySoftDeleteFilter,
	});

	const list = createListMethod({
		db,
		table,
		tableName,
		options,
		schemas,
		defaultPageSize,
		maxPageSize,
		searchFields,
		allowedFilters,
		getColumn,
		applySearch,
		applyScopeFilters,
		applySoftDeleteFilter,
	});

	const update = createUpdateMethod({
		db,
		table,
		options,
		schemas,
		applyScopeFilters,
		applySoftDeleteFilter,
	});

	const deleteOne = createDeleteOneMethod({
		db,
		table,
		options,
		applyScopeFilters,
		getSoftDeleteValues,
	});

	const restore = createRestoreMethod({
		db,
		table,
		options,
		applyScopeFilters,
		getSoftDeleteValues,
	});

	const permanentDelete = createPermanentDeleteMethod({
		db,
		table,
		options,
		applyScopeFilters,
	});

	const bulkCreate = createBulkCreateMethod({
		db,
		table,
		options,
		schemas,
	});

	const bulkDelete = createBulkDeleteMethod({
		db,
		table,
		options,
		applyScopeFilters,
		getSoftDeleteValues,
	});

	const bulkRestore = createBulkRestoreMethod({
		db,
		table,
		options,
		applyScopeFilters,
		getSoftDeleteValues,
	});

	return {
		create,
		findOne,
		list,
		update,
		deleteOne,
		restore,
		permanentDelete,
		bulkCreate,
		bulkDelete,
		bulkRestore,
	};
}
