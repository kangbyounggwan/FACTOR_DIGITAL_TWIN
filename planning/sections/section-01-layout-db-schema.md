# Section 01: Layout Database Schema

**Status:** Not Started
**Track:** A (Layout Versioning)
**Estimated Time:** 30 minutes

---

## Background

### Why This Section Exists

The FACTOR Digital Twin system currently stores equipment positions directly in the `equipment_scans` table. This means:

1. **No version history** - When positions are changed, the original data is lost
2. **No "what-if" scenarios** - Cannot compare different layout configurations
3. **No safe editing** - Changes immediately affect the production view
4. **No rollback capability** - Cannot restore previous arrangements

This section introduces a **Layout Versioning System** that:
- Stores multiple named snapshots of equipment positions per factory
- Allows switching between layouts without losing data
- Supports one "active" layout per factory for the viewer
- Enables layout comparison and cloning

### Current Database State

```
companies (id, name, code)
    └── factories (id, company_id, name, code)
            └── sites (id, site_id, factory_id, name)
                    └── equipment_scans (id, equipment_id, site_id, centroid_x/y/z, size_w/h/d, ...)
```

### Target Database State

```
companies
    └── factories
            ├── sites
            │       └── equipment_scans (master equipment data)
            │
            └── layouts (NEW - version snapshots)
                    └── layout_equipment (NEW - position snapshots)
```

---

## Requirements

When this section is complete, the following must be true:

1. **layouts table exists** with all specified columns
2. **layout_equipment table exists** with all specified columns
3. **Indexes are created** for performance
4. **Single active layout trigger works** - only one layout per factory can be active
5. **CASCADE delete works** - deleting a layout removes its equipment positions
6. **Migration is idempotent** - can be run multiple times safely

---

## Dependencies

### Requires (must be completed first)
- `backend/migrations/001_initial_schema.sql` - factories table must exist
- `backend/migrations/002_digital_twin_tables.sql` - equipment_scans table must exist

### Blocks (cannot start until this is done)
- `section-02-layout-api` - Layout API endpoints need these tables

### Can Run In Parallel With
- `section-05-cascade-fk` - Independent DB migration (different tables)

---

## Implementation Details

### File to Create

**Path:** `backend/migrations/003_layouts.sql`

### Complete SQL Code

```sql
-- FACTOR Digital Twin - Layout Versioning Schema
-- Migration: 003_layouts.sql
-- Description: Add layout versioning tables for equipment position snapshots
--
-- Prerequisites:
--   - 001_initial_schema.sql (companies, factories, sites, equipment_scans)
--   - 002_digital_twin_tables.sql (equipment_scans enhancements)
--
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================
-- 1. layouts (Layout Version Metadata)
-- ============================================
-- Stores named snapshots of equipment arrangements per factory.
-- Each factory can have multiple layouts, but only one can be "active".
-- The active layout is used by the 3D/2D viewer.

CREATE TABLE IF NOT EXISTS layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Factory reference (required)
    factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,

    -- Layout metadata
    name VARCHAR(100) NOT NULL,           -- User-friendly name (e.g., "2024-Q1 Arrangement")
    description TEXT,                      -- Optional notes about this layout

    -- Active status (only one per factory)
    is_active BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add table comment
COMMENT ON TABLE layouts IS 'Layout version snapshots for equipment arrangements';
COMMENT ON COLUMN layouts.factory_id IS 'Factory this layout belongs to';
COMMENT ON COLUMN layouts.is_active IS 'Only one layout per factory can be active';


-- ============================================
-- 2. layout_equipment (Equipment Position Snapshots)
-- ============================================
-- Stores the position and size of each equipment in a layout.
-- When a layout is loaded, these values override equipment_scans.

CREATE TABLE IF NOT EXISTS layout_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent layout (required)
    layout_id UUID NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,

    -- Equipment reference (required)
    -- Uses equipment_scans.id, not equipment_id string
    equipment_id UUID NOT NULL REFERENCES equipment_scans(id) ON DELETE CASCADE,

    -- 3D Position (world coordinates)
    centroid_x FLOAT NOT NULL,
    centroid_y FLOAT NOT NULL,
    centroid_z FLOAT NOT NULL,

    -- 3D Size (dimensions)
    size_w FLOAT NOT NULL,  -- Width (X-axis)
    size_h FLOAT NOT NULL,  -- Height (Y-axis / up)
    size_d FLOAT NOT NULL,  -- Depth (Z-axis)

    -- Ensure each equipment appears only once per layout
    UNIQUE(layout_id, equipment_id)
);

-- Add table comment
COMMENT ON TABLE layout_equipment IS 'Equipment position/size snapshots within a layout';
COMMENT ON COLUMN layout_equipment.equipment_id IS 'References equipment_scans.id (UUID)';


-- ============================================
-- 3. Indexes for Query Performance
-- ============================================

-- Find all layouts for a factory (layout list query)
CREATE INDEX IF NOT EXISTS idx_layouts_factory
    ON layouts(factory_id);

-- Find the active layout for a factory (viewer query)
-- Partial index: only indexes rows where is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_layouts_active
    ON layouts(factory_id, is_active)
    WHERE is_active = TRUE;

-- Find all equipment positions in a layout (layout detail query)
CREATE INDEX IF NOT EXISTS idx_layout_equipment_layout
    ON layout_equipment(layout_id);

-- Find all layouts containing a specific equipment (equipment delete check)
CREATE INDEX IF NOT EXISTS idx_layout_equipment_equipment
    ON layout_equipment(equipment_id);


-- ============================================
-- 4. Single Active Layout Trigger
-- ============================================
-- Ensures only one layout per factory can be active at a time.
-- When a layout is activated, all other layouts in the same factory
-- are automatically deactivated.

CREATE OR REPLACE FUNCTION ensure_single_active_layout()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act when setting is_active to TRUE
    IF NEW.is_active = TRUE THEN
        -- Deactivate all other layouts in the same factory
        UPDATE layouts
        SET is_active = FALSE, updated_at = NOW()
        WHERE factory_id = NEW.factory_id
          AND id != NEW.id
          AND is_active = TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present (for idempotency)
DROP TRIGGER IF EXISTS trigger_single_active_layout ON layouts;

-- Create the trigger (fires before INSERT or UPDATE)
CREATE TRIGGER trigger_single_active_layout
    BEFORE INSERT OR UPDATE ON layouts
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_active_layout();

COMMENT ON FUNCTION ensure_single_active_layout() IS
    'Ensures only one layout per factory can be active';


-- ============================================
-- 5. Auto-update updated_at Trigger
-- ============================================
-- Automatically sets updated_at when a layout is modified.

CREATE OR REPLACE FUNCTION update_layouts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_layouts_updated_at ON layouts;

CREATE TRIGGER trigger_layouts_updated_at
    BEFORE UPDATE ON layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_layouts_timestamp();


-- ============================================
-- 6. Row Level Security (RLS) - Optional
-- ============================================
-- Enable RLS if using Supabase Auth
-- Uncomment these lines if RLS is required

-- ALTER TABLE layouts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE layout_equipment ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all layouts
-- CREATE POLICY "layouts_read_all" ON layouts
--     FOR SELECT USING (true);

-- Policy: Users can insert/update/delete their own layouts
-- (Requires user_id column or factory_users join)


COMMIT;

-- ============================================
-- Verification Queries (run manually to verify)
-- ============================================
--
-- Check tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('layouts', 'layout_equipment');
--
-- Check indexes exist:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('layouts', 'layout_equipment');
--
-- Check triggers exist:
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name LIKE '%layout%';
--
-- Test single active trigger:
-- INSERT INTO layouts (factory_id, name, is_active)
-- VALUES ('22222222-2222-2222-2222-222222222222', 'Test 1', true);
-- INSERT INTO layouts (factory_id, name, is_active)
-- VALUES ('22222222-2222-2222-2222-222222222222', 'Test 2', true);
-- SELECT name, is_active FROM layouts WHERE factory_id = '22222222-2222-2222-2222-222222222222';
-- (Test 1 should be false, Test 2 should be true)
```

---

## Step-by-Step Implementation

### Step 1: Create Migration File

1. Navigate to `backend/migrations/`
2. Create new file `003_layouts.sql`
3. Copy the complete SQL code above

### Step 2: Run Migration in Supabase

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the migration SQL
4. Click "Run" to execute
5. Check for any errors in the output

### Step 3: Verify Tables Created

Run this verification query:

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('layouts', 'layout_equipment')
ORDER BY table_name, ordinal_position;
```

Expected output:
| table_name | column_name | data_type | is_nullable |
|------------|-------------|-----------|-------------|
| layouts | id | uuid | NO |
| layouts | factory_id | uuid | NO |
| layouts | name | character varying | NO |
| layouts | description | text | YES |
| layouts | is_active | boolean | YES |
| layouts | created_at | timestamp with time zone | YES |
| layouts | updated_at | timestamp with time zone | YES |
| layout_equipment | id | uuid | NO |
| layout_equipment | layout_id | uuid | NO |
| layout_equipment | equipment_id | uuid | NO |
| layout_equipment | centroid_x | double precision | NO |
| layout_equipment | centroid_y | double precision | NO |
| layout_equipment | centroid_z | double precision | NO |
| layout_equipment | size_w | double precision | NO |
| layout_equipment | size_h | double precision | NO |
| layout_equipment | size_d | double precision | NO |

### Step 4: Verify Indexes Created

Run this verification query:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('layouts', 'layout_equipment')
ORDER BY indexname;
```

Expected indexes:
- `idx_layouts_factory`
- `idx_layouts_active`
- `idx_layout_equipment_layout`
- `idx_layout_equipment_equipment`
- `layout_equipment_layout_id_equipment_id_key` (unique constraint)
- `layout_equipment_pkey`
- `layouts_pkey`

### Step 5: Test Single Active Layout Trigger

```sql
-- Clean up any test data first
DELETE FROM layouts WHERE name LIKE 'Test Layout%';

-- Insert first layout as active
INSERT INTO layouts (factory_id, name, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', 'Test Layout A', true)
RETURNING id, name, is_active;

-- Insert second layout as active (should deactivate first)
INSERT INTO layouts (factory_id, name, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', 'Test Layout B', true)
RETURNING id, name, is_active;

-- Verify: Layout A should be false, Layout B should be true
SELECT name, is_active
FROM layouts
WHERE factory_id = '22222222-2222-2222-2222-222222222222'
ORDER BY created_at;

-- Clean up test data
DELETE FROM layouts WHERE name LIKE 'Test Layout%';
```

### Step 6: Test CASCADE Delete

```sql
-- Create test layout
INSERT INTO layouts (id, factory_id, name, is_active)
VALUES ('99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'Delete Test', false);

-- Create test equipment position (requires existing equipment_scans record)
-- Use an existing equipment_scans.id from your database
-- INSERT INTO layout_equipment (layout_id, equipment_id, centroid_x, centroid_y, centroid_z, size_w, size_h, size_d)
-- VALUES ('99999999-9999-9999-9999-999999999999', '<equipment_scan_id>', 0, 0, 0, 1, 1, 1);

-- Delete layout (should cascade to layout_equipment)
DELETE FROM layouts WHERE id = '99999999-9999-9999-9999-999999999999';

-- Verify: No orphaned layout_equipment rows
SELECT COUNT(*) FROM layout_equipment WHERE layout_id = '99999999-9999-9999-9999-999999999999';
-- Should return 0
```

---

## Acceptance Criteria

Complete all items before marking this section as done:

- [ ] File `backend/migrations/003_layouts.sql` created
- [ ] Migration executed successfully in Supabase (no errors)
- [ ] `layouts` table exists with all 7 columns
- [ ] `layout_equipment` table exists with all 9 columns
- [ ] Index `idx_layouts_factory` exists
- [ ] Index `idx_layouts_active` exists (partial index)
- [ ] Index `idx_layout_equipment_layout` exists
- [ ] Index `idx_layout_equipment_equipment` exists
- [ ] Unique constraint `(layout_id, equipment_id)` enforced
- [ ] Single active layout trigger works (verified with test)
- [ ] CASCADE delete works (deleting layout removes positions)
- [ ] updated_at auto-updates on layout modification

---

## Files Summary

| Action | Path | Description |
|--------|------|-------------|
| CREATE | `backend/migrations/003_layouts.sql` | Complete migration file |

---

## Troubleshooting

### Error: "relation 'factories' does not exist"

The factories table must exist before running this migration. Run migrations in order:
1. `001_initial_schema.sql`
2. `002_digital_twin_tables.sql`
3. `003_layouts.sql`

### Error: "relation 'equipment_scans' does not exist"

Same as above - run migrations in order.

### Error: "trigger function 'ensure_single_active_layout' does not exist"

The function must be created before the trigger. If running partial SQL, ensure the function is created first.

### Warning: "table 'layouts' already exists"

This is expected on re-runs (migration is idempotent). The `IF NOT EXISTS` clause prevents errors.

### Trigger not working

Verify the trigger exists:
```sql
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'layouts';
```

Should show: `trigger_single_active_layout` for INSERT and UPDATE.

---

## Schema Reference

### layouts Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| factory_id | UUID | NO | - | FK to factories |
| name | VARCHAR(100) | NO | - | Display name |
| description | TEXT | YES | NULL | Optional notes |
| is_active | BOOLEAN | YES | FALSE | Active flag |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update |

### layout_equipment Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| layout_id | UUID | NO | - | FK to layouts |
| equipment_id | UUID | NO | - | FK to equipment_scans |
| centroid_x | FLOAT | NO | - | X position |
| centroid_y | FLOAT | NO | - | Y position |
| centroid_z | FLOAT | NO | - | Z position |
| size_w | FLOAT | NO | - | Width |
| size_h | FLOAT | NO | - | Height |
| size_d | FLOAT | NO | - | Depth |

---

## Next Section

After completing this section, proceed to:

**Section 02: Layout API** (`section-02-layout-api.md`)
- Creates FastAPI endpoints for layout CRUD operations
- Uses the tables created in this section

---

## Update Log

### 2026-04-01: Schema Review with equipment_models

**Source:** `C:\Users\USER\factor-MES\anomaly-eye-monitor\docs\digital-twin-3d-model-schema.md`

**Findings:**

anomaly-eye-monitor 프로젝트에서 설비 유형별 3D 모델 저장을 위한 `equipment_models` 테이블을 설계함:

```sql
-- equipment_models (3D 모델 메타데이터)
CREATE TABLE equipment_models (
  id UUID PRIMARY KEY,
  equipment_type VARCHAR(50) NOT NULL,  -- 'plc', 'enclosure', 'panel', 'rack', 'hub', 'machine'
  name VARCHAR(100) NOT NULL,
  model_format VARCHAR(10) NOT NULL,    -- 'obj', 'glb', 'gltf'
  model_path TEXT NOT NULL,
  texture_path TEXT,
  normal_map_path TEXT,
  default_scale NUMERIC[3] DEFAULT '{1,1,1}',
  is_default BOOLEAN DEFAULT false,
  factory_id UUID REFERENCES factories(id),  -- NULL이면 전역 모델
  ...
);
```

**분석 결과:**

| 항목 | 현재 layout_equipment | equipment_models | 결론 |
|------|----------------------|------------------|------|
| 위치 (x,y,z) | O | - | 충분 |
| 크기 (w,h,d) | O | - | 충분 |
| **회전 (rotation)** | **X** | - | **추가 필요** |
| 3D 모델 참조 | X | O (model_path) | 선택적 |
| 스케일 오버라이드 | X | O (default_scale) | 선택적 |

**권장 스키마 변경:**

`layout_equipment` 테이블에 회전 필드 추가:

```sql
-- 추가 필드 (layout_equipment)
rotation_y FLOAT DEFAULT 0,  -- Y축 회전 (라디안, 0 = 회전 없음)

-- 선택적: 3D 모델 오버라이드 (equipment_models 연동 시)
-- model_id UUID REFERENCES equipment_models(id),  -- 특정 모델 지정 (NULL = 기본 모델)
```

**수정된 layout_equipment 테이블:**

```sql
CREATE TABLE IF NOT EXISTS layout_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment_scans(id) ON DELETE CASCADE,

    -- 3D Position (world coordinates)
    centroid_x FLOAT NOT NULL,
    centroid_y FLOAT NOT NULL,
    centroid_z FLOAT NOT NULL,

    -- 3D Size (dimensions)
    size_w FLOAT NOT NULL,
    size_h FLOAT NOT NULL,
    size_d FLOAT NOT NULL,

    -- 3D Rotation (NEW)
    rotation_y FLOAT DEFAULT 0,  -- Y축 회전 (라디안)

    -- Optional: Model override (if equipment_models table exists)
    -- model_id UUID REFERENCES equipment_models(id),

    UNIQUE(layout_id, equipment_id)
);
```

**영향받는 파일:**

1. `backend/migrations/003_layouts.sql` - rotation_y 컬럼 추가
2. `backend/app/schemas/layout.py` - rotation_y 필드 추가
3. `frontend/src/lib/api.ts` - LayoutEquipmentPosition 인터페이스 수정
4. `frontend/src/hooks/useLayouts.ts` - rotation 값 처리
5. `frontend/src/components/LayoutCanvas.tsx` - 회전 표시/편집 UI
6. 3D 뷰어 - 회전 적용

**구현 우선순위:**

1. **필수**: rotation_y 추가 (레이아웃 완전 복원에 필요)
2. **선택적**: model_id 참조 (equipment_models 테이블이 구현된 후)

**결론:**

레이아웃 버전 관리가 설비 배치를 완전히 복원하려면 **rotation_y 필드 추가가 필수**입니다. model_id 참조는 equipment_models 테이블이 factor-digital-twin에 구현된 후 추가할 수 있습니다.
