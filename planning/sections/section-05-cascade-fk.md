# Section 05: CASCADE Foreign Key Migration

**Status:** Pending
**Estimated Effort:** Low
**Dependencies:** None (can start immediately)
**Blocks:** Section 06 (CRUD API)

---

## Background

The FACTOR Digital Twin system uses a hierarchical data model:

```
companies (회사)
    └── factories (공장)
            └── production_lines (라인)
                    └── equipment_scans (설비)
                            └── layout_equipment (레이아웃 설비 위치)
```

Currently, the database schema has foreign key constraints but **some may not have CASCADE delete policies**. This means:

1. Deleting a company will fail if it has factories
2. Deleting a factory will fail if it has production lines
3. Deleting a production line will fail if it has equipment scans

For the Admin Page (Section 08) to allow users to delete entities with a single click, we need:

1. **CASCADE DELETE** on all parent-child foreign keys
2. **Helper functions** to count children before deletion (for confirmation dialogs)

This section implements the database migration to add CASCADE delete behavior and helper functions.

---

## Requirements

When this section is complete, the following must be true:

1. Deleting a company automatically deletes all its factories, lines, and equipment
2. Deleting a factory automatically deletes all its lines and equipment
3. Deleting a production line automatically deletes all its equipment scans
4. Helper functions exist to count children at each level (for delete confirmation UI)
5. All existing data remains intact after migration
6. Migration is idempotent (can be run multiple times safely)

---

## Dependencies

### Requires: None

This section has no dependencies. It can be started immediately and run in parallel with Section 01 (Layout DB Schema).

### Blocks: Section 06 (CRUD API)

Section 06 cannot begin until this section is complete because:

- The CRUD API delete endpoints rely on CASCADE behavior for clean deletion
- The delete-info endpoints call the helper functions created in this section
- Without CASCADE, delete operations would fail with foreign key violations

---

## Current Schema Analysis

### Existing Tables and Their FK Constraints

Based on the migration files (`001_initial_schema.sql` and `002_digital_twin_tables.sql`):

| Table | Foreign Key | References | Current ON DELETE |
|-------|-------------|------------|-------------------|
| factories | company_id | companies(id) | CASCADE |
| sites | factory_id | factories(id) | CASCADE |
| production_lines | factory_id | factories(id) | Unknown (may not have CASCADE) |
| equipment_scans | line_id | production_lines(id) | CASCADE |
| equipment_scans | equipment_id | equipments(id) | SET NULL |
| factory_users | factory_id | factories(id) | CASCADE |
| scan_sessions | line_id | production_lines(id) | CASCADE |
| layouts | factory_id | factories(id) | CASCADE (from Section 01) |
| layout_equipment | layout_id | layouts(id) | CASCADE (from Section 01) |
| layout_equipment | equipment_id | equipment_scans(id) | CASCADE (from Section 01) |

**Note:** The migration ensures all critical FK constraints have CASCADE delete, even if some already do. This makes the migration idempotent.

---

## Implementation Details

### Migration File

**File to Create:** `backend/migrations/004_cascade_fk.sql`

```sql
-- ============================================
-- FACTOR Digital Twin - CASCADE FK Migration
-- Migration 004: Add CASCADE delete to foreign keys
-- ============================================
--
-- Purpose:
--   Ensure all parent-child foreign key constraints have CASCADE delete behavior
--   This enables clean deletion of entities with all their children
--
-- Tables affected:
--   - factories (company_id -> companies)
--   - production_lines (factory_id -> factories)
--   - equipment_scans (line_id -> production_lines)
--   - scan_sessions (line_id -> production_lines)
--   - factory_users (factory_id -> factories)
--
-- Helper functions created:
--   - count_company_children(company_uuid) -> factories, lines, equipment counts
--   - count_factory_children(factory_uuid) -> lines, equipment counts
--   - count_line_children(line_uuid) -> equipment count
--
-- Note: This migration is idempotent - safe to run multiple times
-- ============================================

BEGIN;

-- ============================================
-- 1. factories -> companies CASCADE
-- ============================================
-- Drop existing constraint (if exists) and recreate with CASCADE

ALTER TABLE factories
    DROP CONSTRAINT IF EXISTS factories_company_id_fkey;

ALTER TABLE factories
    ADD CONSTRAINT factories_company_id_fkey
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE;

COMMENT ON CONSTRAINT factories_company_id_fkey ON factories IS
    'Cascade delete: deleting a company deletes all its factories';

-- ============================================
-- 2. production_lines -> factories CASCADE
-- ============================================
-- Check if production_lines table exists before altering
-- (Some deployments might use 'sites' table instead)

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'production_lines'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE production_lines
            DROP CONSTRAINT IF EXISTS production_lines_factory_id_fkey;

        -- Add CASCADE constraint
        ALTER TABLE production_lines
            ADD CONSTRAINT production_lines_factory_id_fkey
            FOREIGN KEY (factory_id)
            REFERENCES factories(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- 3. equipment_scans -> production_lines CASCADE
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_scans' AND column_name = 'line_id'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE equipment_scans
            DROP CONSTRAINT IF EXISTS equipment_scans_line_id_fkey;

        -- Add CASCADE constraint
        ALTER TABLE equipment_scans
            ADD CONSTRAINT equipment_scans_line_id_fkey
            FOREIGN KEY (line_id)
            REFERENCES production_lines(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- 4. scan_sessions -> production_lines CASCADE
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scan_sessions' AND column_name = 'line_id'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE scan_sessions
            DROP CONSTRAINT IF EXISTS scan_sessions_line_id_fkey;

        -- Add CASCADE constraint
        ALTER TABLE scan_sessions
            ADD CONSTRAINT scan_sessions_line_id_fkey
            FOREIGN KEY (line_id)
            REFERENCES production_lines(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- 5. factory_users -> factories CASCADE
-- ============================================

ALTER TABLE factory_users
    DROP CONSTRAINT IF EXISTS factory_users_factory_id_fkey;

ALTER TABLE factory_users
    ADD CONSTRAINT factory_users_factory_id_fkey
    FOREIGN KEY (factory_id)
    REFERENCES factories(id)
    ON DELETE CASCADE;

-- ============================================
-- 6. sites -> factories CASCADE (if using sites table)
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'sites'
    ) THEN
        ALTER TABLE sites
            DROP CONSTRAINT IF EXISTS sites_factory_id_fkey;

        ALTER TABLE sites
            ADD CONSTRAINT sites_factory_id_fkey
            FOREIGN KEY (factory_id)
            REFERENCES factories(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- 7. Helper Function: Count Company Children
-- ============================================
-- Returns count of factories, lines, and equipment under a company
-- Used by API to show deletion impact in confirmation dialog

CREATE OR REPLACE FUNCTION count_company_children(company_uuid UUID)
RETURNS TABLE(
    factories_count INTEGER,
    lines_count INTEGER,
    equipment_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM factories
            WHERE company_id = company_uuid
        ), 0) AS factories_count,
        COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM production_lines pl
            JOIN factories f ON pl.factory_id = f.id
            WHERE f.company_id = company_uuid
        ), 0) AS lines_count,
        COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM equipment_scans es
            JOIN production_lines pl ON es.line_id = pl.id
            JOIN factories f ON pl.factory_id = f.id
            WHERE f.company_id = company_uuid
        ), 0) AS equipment_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION count_company_children(UUID) IS
    'Count all children (factories, lines, equipment) under a company for delete confirmation';

-- ============================================
-- 8. Helper Function: Count Factory Children
-- ============================================
-- Returns count of lines and equipment under a factory

CREATE OR REPLACE FUNCTION count_factory_children(factory_uuid UUID)
RETURNS TABLE(
    lines_count INTEGER,
    equipment_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM production_lines
            WHERE factory_id = factory_uuid
        ), 0) AS lines_count,
        COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM equipment_scans es
            JOIN production_lines pl ON es.line_id = pl.id
            WHERE pl.factory_id = factory_uuid
        ), 0) AS equipment_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION count_factory_children(UUID) IS
    'Count all children (lines, equipment) under a factory for delete confirmation';

-- ============================================
-- 9. Helper Function: Count Line Children
-- ============================================
-- Returns count of equipment under a production line

CREATE OR REPLACE FUNCTION count_line_children(line_uuid UUID)
RETURNS TABLE(
    equipment_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM equipment_scans
            WHERE line_id = line_uuid
        ), 0) AS equipment_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION count_line_children(UUID) IS
    'Count equipment under a production line for delete confirmation';

-- ============================================
-- 10. Verification Query (for testing)
-- ============================================
-- Run this after migration to verify all constraints

DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('factories', 'production_lines', 'equipment_scans', 'scan_sessions', 'factory_users', 'sites');

    RAISE NOTICE 'Migration complete. Total FK constraints on hierarchy tables: %', constraint_count;
END $$;

COMMIT;
```

---

## How to Run the Migration

### Option 1: Supabase SQL Editor (Recommended)

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the entire contents of `004_cascade_fk.sql`
5. Click **Run**
6. Verify the "Migration complete" notice appears

### Option 2: psql Command Line

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Run the migration
\i backend/migrations/004_cascade_fk.sql
```

### Option 3: Python Script (for automated deployment)

```python
# run_migration.py
import os
from supabase import create_client

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"]  # Use service key for DDL
)

with open("backend/migrations/004_cascade_fk.sql", "r") as f:
    sql = f.read()

# Execute via Supabase REST API (requires service key)
result = supabase.rpc("exec_sql", {"sql": sql}).execute()
print("Migration complete:", result)
```

---

## Testing the Migration

### 1. Verify FK Constraints

Run this query after migration to list all FK constraints:

```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('factories', 'production_lines', 'equipment_scans', 'scan_sessions', 'factory_users', 'sites')
ORDER BY tc.table_name;
```

**Expected Output:**

| table_name | column_name | references_table | delete_rule |
|------------|-------------|------------------|-------------|
| factories | company_id | companies | CASCADE |
| production_lines | factory_id | factories | CASCADE |
| equipment_scans | line_id | production_lines | CASCADE |
| scan_sessions | line_id | production_lines | CASCADE |
| factory_users | factory_id | factories | CASCADE |

### 2. Test Helper Functions

```sql
-- Test count_company_children
SELECT * FROM count_company_children('11111111-1111-1111-1111-111111111111');
-- Expected: Returns factories_count, lines_count, equipment_count

-- Test count_factory_children
SELECT * FROM count_factory_children('22222222-2222-2222-2222-222222222222');
-- Expected: Returns lines_count, equipment_count

-- Test count_line_children (use a valid line_id from your data)
SELECT * FROM count_line_children('your-line-uuid-here');
-- Expected: Returns equipment_count
```

### 3. Test CASCADE Delete Behavior

**Warning:** Only run these tests in a development environment with test data!

```sql
-- Create test hierarchy
INSERT INTO companies (id, name, code)
VALUES ('test-company-111', 'Test Company', 'TEST_DEL')
ON CONFLICT (code) DO NOTHING;

INSERT INTO factories (id, company_id, name, code)
VALUES ('test-factory-222', 'test-company-111', 'Test Factory', 'TEST_FAC_DEL')
ON CONFLICT (code) DO NOTHING;

-- Verify children exist
SELECT * FROM count_company_children('test-company-111');

-- Delete company - should cascade to factory
DELETE FROM companies WHERE id = 'test-company-111';

-- Verify factory was also deleted
SELECT * FROM factories WHERE id = 'test-factory-222';
-- Expected: No rows returned
```

---

## Files to Create

| File Path | Description |
|-----------|-------------|
| `backend/migrations/004_cascade_fk.sql` | CASCADE FK migration with helper functions |

## Files to Modify

None - this section only creates new migration files.

---

## Acceptance Criteria

- [ ] Migration file `004_cascade_fk.sql` created in `backend/migrations/`
- [ ] Migration runs without errors in Supabase SQL Editor
- [ ] All FK constraints have `ON DELETE CASCADE` (verified with query)
- [ ] `count_company_children` function works correctly
- [ ] `count_factory_children` function works correctly
- [ ] `count_line_children` function works correctly
- [ ] CASCADE delete works: deleting company deletes all children
- [ ] CASCADE delete works: deleting factory deletes all children
- [ ] CASCADE delete works: deleting line deletes all equipment
- [ ] Migration is idempotent (running twice doesn't cause errors)
- [ ] Existing data is preserved after migration

---

## Rollback Plan

If issues are discovered after migration:

```sql
-- Rollback: Remove CASCADE and restore default RESTRICT behavior
-- WARNING: Only run if CASCADE is causing unintended deletions

BEGIN;

-- Revert factories FK
ALTER TABLE factories DROP CONSTRAINT IF EXISTS factories_company_id_fkey;
ALTER TABLE factories ADD CONSTRAINT factories_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

-- Revert production_lines FK
ALTER TABLE production_lines DROP CONSTRAINT IF EXISTS production_lines_factory_id_fkey;
ALTER TABLE production_lines ADD CONSTRAINT production_lines_factory_id_fkey
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;

-- Revert equipment_scans FK
ALTER TABLE equipment_scans DROP CONSTRAINT IF EXISTS equipment_scans_line_id_fkey;
ALTER TABLE equipment_scans ADD CONSTRAINT equipment_scans_line_id_fkey
    FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE RESTRICT;

-- Drop helper functions
DROP FUNCTION IF EXISTS count_company_children(UUID);
DROP FUNCTION IF EXISTS count_factory_children(UUID);
DROP FUNCTION IF EXISTS count_line_children(UUID);

COMMIT;
```

---

## Technical Notes

### Why CASCADE Delete?

1. **User Experience:** Users expect deleting a company to delete all related data
2. **Data Integrity:** Orphaned records (factories without companies) cause issues
3. **API Simplicity:** No need for recursive delete logic in application code
4. **Performance:** Database handles cascade more efficiently than app-level loops

### Why Helper Functions?

1. **Confirmation UI:** Admin page shows "This will delete 3 factories, 12 lines, 156 equipment"
2. **Audit Trail:** Knowing impact before deletion helps prevent mistakes
3. **Performance:** Single SQL query is faster than multiple API calls

### Function Stability

All helper functions are marked as `STABLE`:
- They only read data, never modify it
- Safe to call multiple times with same result
- PostgreSQL can optimize query plans

### Error Handling

The migration uses `DO $$ ... $$` blocks with `IF EXISTS` checks to:
- Handle cases where tables might not exist (different deployment configurations)
- Make the migration idempotent (safe to run multiple times)
- Avoid errors if constraints already exist with correct settings

---

## API Usage (Preview for Section 06)

After this migration, Section 06 will implement these API endpoints:

```python
# Get deletion impact for confirmation dialog
@router.get("/companies/{company_id}/delete-info")
async def get_company_delete_info(company_id: str, db: Client = Depends(get_supabase)):
    """Returns count of children that will be deleted"""
    result = db.rpc("count_company_children", {"company_uuid": company_id}).execute()
    return {
        "factories_count": result.data[0]["factories_count"],
        "lines_count": result.data[0]["lines_count"],
        "equipment_count": result.data[0]["equipment_count"]
    }

# Delete company (CASCADE handles children automatically)
@router.delete("/companies/{company_id}")
async def delete_company(company_id: str, db: Client = Depends(get_supabase)):
    """Delete company and all children (CASCADE)"""
    result = db.table("companies").delete().eq("id", company_id).execute()
    if not result.data:
        raise HTTPException(404, "Company not found")
    return {"message": "Company and all children deleted"}
```

---

## Parallel Execution Note

This section can be executed in parallel with:
- **Section 01 (Layout DB Schema):** Both are database migrations with no conflicts

Recommended execution order:
1. Run Section 01 and Section 05 migrations together
2. Proceed to Section 02 and Section 06 in parallel
