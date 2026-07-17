---
name: drizzle-kit-push-tty
description: drizzle-kit push blocks on column-drop confirmations without a TTY
---

## Rule
Never use `pnpm --filter @workspace/db run push` (or `push-force`) to apply migrations that drop columns or tables from the bash tool — both variants fail without a TTY.

**Why:** Drizzle Kit's push command interactively prompts for confirmation when dropping columns/tables. Without a real TTY the process hangs or exits with a non-zero code, leaving the schema partially applied.

**How to apply:** For any migration involving drops, use `executeSql` in the `code_execution` tool to run the DDL directly:

```js
await executeSql({ sqlQuery: "ALTER TABLE workout_sessions DROP COLUMN IF EXISTS ..." });
```

For non-destructive schema additions (new tables, new columns with defaults), `push-force` may work — but `executeSql` is always safe.
