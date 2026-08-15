---
name: Fnashha audit_trail schema mismatch
description: The bootstrap DDL created audit_trail with (actor_id, action, details) but Drizzle schema expects (changed_by, field_name, old_value, new_value) — required ALTER TABLE fix.
---

## The rule
The `audit_trail` table was originally created with columns: `id, request_id, actor_id, action (NOT NULL), details, created_at`. The Drizzle schema (`auditTrailTable`) was later updated to use: `changed_by, field_name, old_value, new_value` — but the DDL was never updated. This caused EVERY `db.insert(auditTrailTable)` to fail with "column changed_by does not exist" → any route that inserted into audit_trail before sending a response would return 500.

**Why:** The DDL and Drizzle schema drifted because bootstrap.ts uses `CREATE TABLE IF NOT EXISTS` (which skips if table exists) and changes are applied via a separate `alterDDL` block.

**How to apply:**
- Always add schema column changes to the `alterDDL` block in `bootstrap.ts` (not just the Drizzle schema).
- If the Drizzle schema has columns not in the DB, add `ALTER TABLE t ADD COLUMN IF NOT EXISTS col TYPE;`.
- The old `action TEXT NOT NULL` also needed `ALTER TABLE audit_trail ALTER COLUMN action DROP NOT NULL;` so Drizzle inserts (which don't provide `action`) don't hit a NOT NULL violation.

**Fix applied:** Added to alterDDL in bootstrap.ts:
```sql
ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS changed_by INTEGER REFERENCES users(id);
ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS field_name TEXT;
ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE IF EXISTS audit_trail ALTER COLUMN action DROP NOT NULL;
```
