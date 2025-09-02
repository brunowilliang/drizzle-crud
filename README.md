# Drizzle CRUD Factory

Uma biblioteca TypeScript que cria operações CRUD automatizadas sobre o Drizzle
ORM, especificamente para SQLite/Turso.

## O que é?

O Drizzle CRUD Factory é uma camada de abstração que gera automaticamente
operações CRUD (Create, Read, Update, Delete) completas a partir de suas tabelas
Drizzle. Ele adiciona funcionalidades essenciais como:

- ✅ **Operações CRUD completas** com tipagem TypeScript
- 🔍 **Busca e filtros avançados**
- 📄 **Paginação automática**
- ♻️ **Soft delete** (exclusão lógica)
- ✅ **Validação** com Zod
- 🪝 **Hooks** para customização
- 🔐 **Multi-tenancy** com scope filters
- 📦 **Operações em lote**

## Como funciona?

### 1. Defina sua tabela Drizzle

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

### 2. Crie o CRUD

```typescript
import { drizzleCrud } from "drizzle-crud";
import { zod } from "drizzle-crud/zod";

// Cria a factory
const crud = drizzleCrud(db, { validation: zod() });

// Gera CRUD para a tabela users
const usersCrud = crud(users, {
  searchFields: ["name", "email"], // Campos pesquisáveis
  allowedFilters: ["role"], // Filtros permitidos
  softDelete: { // Configuração de soft delete
    field: "deletedAt",
    deletedValue: new Date(),
    notDeletedValue: null,
  },
});
```

### 3. Use as operações geradas

```typescript
// Criar
const user = await usersCrud.create({
  email: "bruno@example.com",
  name: "Bruno Garcia",
  role: "admin",
});

// Buscar por qualquer campo
const user = await usersCrud.findOne({ email: "bruno@example.com" });

// Listar com paginação e filtros
const result = await usersCrud.list({
  page: 1,
  perPage: 20,
  search: "bruno",
  filters: { role: "admin" },
});

// Atualizar
await usersCrud.update(user.id, { name: "Bruno G." });

// Deletar (soft delete)
await usersCrud.deleteOne(user.id);

// Restaurar
await usersCrud.restore(user.id);
```

## Métodos disponíveis

### Operações básicas

- `create(data)` - Cria um registro
- `findOne(conditions)` - Busca um registro por qualquer campo
- `list(params)` - Lista com paginação, busca e filtros
- `update(id, data)` - Atualiza um registro
- `deleteOne(id)` - Deleta um registro (soft ou hard delete)
- `restore(id)` - Restaura um registro deletado
- `permanentDelete(id)` - Deleta permanentemente

### Operações em lote

- `bulkCreate(items)` - Cria múltiplos registros
- `bulkDelete(ids)` - Deleta múltiplos registros
- `bulkRestore(ids)` - Restaura múltiplos registros

## Recursos avançados

### Filtros complexos

```typescript
// Operadores de comparação
const result = await usersCrud.list({
  filters: {
    age: { gt: 18, lte: 65 }, // maior que 18, menor ou igual a 65
    role: { in: ["admin", "editor"] }, // IN
    email: { like: "%@company.com" }, // LIKE
    status: { not: "suspended" }, // NOT
  },
});

// Lógica AND/OR
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
    // Antes de criar
    beforeCreate: (data) => ({
      ...data,
      email: data.email.toLowerCase(),
    }),

    // Antes de atualizar
    beforeUpdate: (data) => {
      const { password, ...safe } = data;
      return safe; // Remove senha de updates
    },

    // Validação customizada
    validate: ({ operation, data, context }) => {
      if (context.actor?.role === "admin") {
        return false; // Admin pula validação
      }
      return true;
    },
  },
});
```

### Multi-tenancy com Scope Filters

```typescript
const projectsCrud = crud(projects, {
  scopeFilters: {
    // Filtra por tenant automaticamente
    tenantId: (value, actor) => {
      return eq(projects.tenantId, actor.properties.tenantId);
    },
  },
});

// Todas operações serão filtradas pelo tenant
const projects = await projectsCrud.list({}, {
  actor: {
    type: "user",
    properties: { tenantId: 123 },
  },
});
```

### Resposta da paginação

```typescript
const result = await usersCrud.list({ page: 2, perPage: 20 });

// Retorna:
{
  results: User[],         // Dados
  page: 2,                // Página atual
  perPage: 20,            // Items por página
  totalItems: 156,        // Total de registros
  totalPages: 8,          // Total de páginas
  hasNextPage: true,      // Tem próxima página
  hasPreviousPage: true,  // Tem página anterior
}
```

## Validação

A biblioteca integra com Zod para validação automática baseada no schema:

```typescript
import { z } from "zod";

// Validação customizada
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

## Contexto e Segurança

Passe contexto para qualquer operação:

```typescript
// Contexto do usuário autenticado
const context = {
  actor: {
    type: "user",
    properties: {
      id: 123,
      role: "admin",
      tenantId: 456,
    },
  },
  skipValidation: true, // Pula validação se necessário
};

// Usa contexto em qualquer operação
await usersCrud.create(data, context);
await usersCrud.list({}, context);
```

## TypeScript

A biblioteca é 100% tipada e infere tipos automaticamente:

```typescript
// Tipos inferidos do schema Drizzle
const user = await usersCrud.create({
  email: "test@example.com",
  name: "Test",
  role: "admin", // ✅ Validado contra enum
  // role: "super", // ❌ Erro de tipo
});

// user é totalmente tipado
console.log(user.id, user.email); // ✅ Autocomplete funciona
```

## Instalação

```bash
npm install drizzle-crud
# ou
bun add drizzle-crud
```

## Dependências

- `drizzle-orm` - ORM base
- `@libsql/client` - Cliente SQLite/Turso
- `zod` (opcional) - Para validação

## Por que usar?

1. **Reduz boilerplate**: Gera automaticamente todas operações CRUD
2. **Type-safe**: 100% tipado com TypeScript
3. **Flexível**: Hooks e configurações para customizar comportamento
4. **Completo**: Paginação, busca, filtros, soft delete, tudo incluso
5. **Multi-tenant ready**: Suporte nativo para isolamento de dados
6. **Validação integrada**: Com Zod ou seu próprio validador
7. **Performance**: Queries otimizadas para SQLite

## Licença

MIT
