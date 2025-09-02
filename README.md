# Drizzle CRUD Factory

A TypeScript library that creates automated CRUD operations over Drizzle ORM,
specifically for SQLite/Turso.

## What is it?

Drizzle CRUD Factory is an abstraction layer that automatically generates
complete CRUD (Create, Read, Update, Delete) operations from your Drizzle
tables. It adds essential features like:

- ✅ **Complete CRUD operations** with TypeScript typing
- 🔍 **Advanced search and filters**
- 📄 **Automatic pagination**
- ♻️ **Soft delete** (logical deletion)
- ✅ **Validation** with Zod
- 🪝 **Hooks** for customization
- 🔐 **Multi-tenancy** with scope filters
- 📦 **Bulk operations**

## How it works?

### 1. Define your Drizzle table

```typescript
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

### 2. Create the CRUD

```typescript
import { drizzleCrud } from "drizzle-crud";
import { zod } from "drizzle-crud/zod";

// Create the factory
const crud = drizzleCrud(db, { validation: zod() });

// Generate CRUD for users table
const usersCrud = crud(users, {
  searchFields: ["name", "email"], // Searchable fields
  allowedFilters: ["role"], // Allowed filters
  softDelete: { // Soft delete configuration
    field: "deletedAt",
    deletedValue: new Date(),
    notDeletedValue: null,
  },
});
```

### 3. Use the generated operations

```typescript
// Create
const user = await usersCrud.create({
  email: "bruno@example.com",
  name: "Bruno Garcia",
  role: "admin",
});

// Find by any field
const user = await usersCrud.findOne({ email: "bruno@example.com" });

// List with pagination and filters
const result = await usersCrud.list({
  page: 1,
  perPage: 20,
  search: "bruno",
  filters: { role: "admin" },
});

// Update
await usersCrud.update(user.id, { name: "Bruno G." });

// Delete (soft delete)
await usersCrud.deleteOne(user.id);

// Restore
await usersCrud.restore(user.id);
```

## Available methods

### Basic operations

- `create(data)` - Creates a record
- `findOne(conditions)` - Finds a record by any field
- `list(params)` - Lists with pagination, search and filters
- `update(id, data)` - Updates a record
- `deleteOne(id)` - Deletes a record (soft or hard delete)
- `restore(id)` - Restores a deleted record
- `permanentDelete(id)` - Permanently deletes

### Bulk operations

- `bulkCreate(items)` - Creates multiple records
- `bulkDelete(ids)` - Deletes multiple records
- `bulkRestore(ids)` - Restores multiple records

## Advanced features

### Complex filters

```typescript
// Comparison operators
const result = await usersCrud.list({
  filters: {
    age: { gt: 18, lte: 65 }, // greater than 18, less or equal to 65
    role: { in: ["admin", "editor"] }, // IN
    email: { like: "%@company.com" }, // LIKE
    status: { not: "suspended" }, // NOT
  },
});

// AND/OR logic
const result = await usersCrud.list({
  filters: {
    OR: [
      { role: "admin" },
      { department: "IT" },
    ],
  },
});
```

### Hooks

```typescript
const usersCrud = crud(users, {
  hooks: {
    // Before creating
    beforeCreate: (data) => ({
      ...data,
      email: data.email.toLowerCase(),
    }),

    // Before updating
    beforeUpdate: (data) => {
      const { password, ...safe } = data;
      return safe; // Remove password from updates
    },

    // Custom validation
    validate: ({ operation, data, context }) => {
      if (context.actor?.role === "admin") {
        return false; // Admin skips validation
      }
      return true;
    },
  },
});
```

### Multi-tenancy with Scope Filters

```typescript
const projectsCrud = crud(projects, {
  scopeFilters: {
    // Filter by tenant automatically
    tenantId: (value, actor) => {
      return eq(projects.tenantId, actor.properties.tenantId);
    },
  },
});

// All operations will be filtered by tenant
const projects = await projectsCrud.list({}, {
  actor: {
    type: "user",
    properties: { tenantId: 123 },
  },
});
```

### Pagination response

```typescript
const result = await usersCrud.list({ page: 2, perPage: 20 });

// Returns:
{
  results: User[],         // Data
  page: 2,                // Current page
  perPage: 20,            // Items per page
  totalItems: 156,        // Total records
  totalPages: 8,          // Total pages
  hasNextPage: true,      // Has next page
  hasPreviousPage: true,  // Has previous page
}
```

## Validation

The library integrates with Zod for automatic validation based on schema:

```typescript
import { z } from "zod";

// Custom validation
const customValidation = {
  ...zod(),
  createInsertSchema: () =>
    z.object({
      email: z.email().transform((v) => v.toLowerCase()),
      name: z.string().min(2).max(50),
      password: z.string().min(8),
    }),
};

const crud = drizzleCrud(db, { validation: customValidation });
```

## Context and Security

Pass context to any operation:

```typescript
// Authenticated user context
const context = {
  actor: {
    type: "user",
    properties: {
      id: 123,
      role: "admin",
      tenantId: 456,
    },
  },
  skipValidation: true, // Skip validation if needed
};

// Use context in any operation
await usersCrud.create(data, context);
await usersCrud.list({}, context);
```

## TypeScript

The library is 100% typed and automatically infers types:

```typescript
// Types inferred from Drizzle schema
const user = await usersCrud.create({
  email: "test@example.com",
  name: "Test",
  role: "admin", // ✅ Validated against enum
  // role: "super", // ❌ Type error
});

// user is fully typed
console.log(user.id, user.email); // ✅ Autocomplete works
```

## Installation

```bash
npm install drizzle-crud
# or
bun add drizzle-crud
```

## Dependencies

- `drizzle-orm` - Base ORM
- `@libsql/client` - SQLite/Turso client
- `zod` (optional) - For validation

## Why use it?

1. **Reduces boilerplate**: Automatically generates all CRUD operations
2. **Type-safe**: 100% typed with TypeScript
3. **Flexible**: Hooks and configurations to customize behavior
4. **Complete**: Pagination, search, filters, soft delete, everything included
5. **Multi-tenant ready**: Native support for data isolation
6. **Integrated validation**: With Zod or your own validator
7. **Performance**: Optimized queries for SQLite

## License

MIT
