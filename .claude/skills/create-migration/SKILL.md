---
name: create-migration
description: Scaffold a Supabase SQL migration with up/down sections and type-sync reminder
disable-model-invocation: true
---

Invoked with `/create-migration nome-da-mudanca` — generates a timestamped migration file in `supabase/migrations/` with an "up" section (the change) and a commented "down" section (rollback), then reminds the user to run `npx supabase gen types typescript` to sync `types/database.ts` after applying.

Format:
```sql
-- Migration: {timestamp}_{nome-da-mudanca}.sql

-- UP
-- (write the actual change here)

-- DOWN (rollback reference, not auto-executed)
-- (write the reverse operation here)
```

After creating the file, remind the user:
1. Review the SQL before applying
2. Apply via Supabase dashboard SQL editor or CLI
3. Run type sync: `npx supabase gen types typescript --project-id fwdhnipekbmeqozkpfyh > types/database.ts`
