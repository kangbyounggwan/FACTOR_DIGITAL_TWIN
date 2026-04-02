-- FACTOR Digital Twin - Layout Versioning Schema
-- Migration: 003_layouts.sql
-- Description: Add layout versioning tables for equipment position snapshots
--
-- Prerequisites:
--   - 001_initial_schema.sql (companies, factories, production_lines)
--   - 002_digital_twin_tables.sql (equipment_scans)
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
-- Stores the position, size, and rotation of each equipment in a layout.
-- When a layout is loaded, these values override equipment_scans.

CREATE TABLE IF NOT EXISTS layout_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent layout (required)
    layout_id UUID NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,

    -- Equipment reference (required)
    equipment_id UUID NOT NULL REFERENCES equipment_scans(id) ON DELETE CASCADE,

    -- 3D Position (world coordinates)
    centroid_x FLOAT NOT NULL,
    centroid_y FLOAT NOT NULL,
    centroid_z FLOAT NOT NULL,

    -- 3D Size (dimensions)
    size_w FLOAT NOT NULL,  -- Width (X-axis)
    size_h FLOAT NOT NULL,  -- Height (Y-axis / up)
    size_d FLOAT NOT NULL,  -- Depth (Z-axis)

    -- 3D Rotation (all axes in radians)
    -- 2026-04-01: DB verified - all 3 rotation axes exist
    rotation_x FLOAT DEFAULT 0,
    rotation_y FLOAT DEFAULT 0,
    rotation_z FLOAT DEFAULT 0,

    -- Ensure each equipment appears only once per layout
    UNIQUE(layout_id, equipment_id)
);

-- Add table comment
COMMENT ON TABLE layout_equipment IS 'Equipment position/size/rotation snapshots within a layout';
COMMENT ON COLUMN layout_equipment.equipment_id IS 'References equipment_scans.id (UUID)';
COMMENT ON COLUMN layout_equipment.rotation_x IS 'X-axis rotation in radians';
COMMENT ON COLUMN layout_equipment.rotation_y IS 'Y-axis rotation in radians';
COMMENT ON COLUMN layout_equipment.rotation_z IS 'Z-axis rotation in radians';


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

-- Drop existing trigger if any (for idempotent re-runs)
DROP TRIGGER IF EXISTS trigger_single_active_layout ON layouts;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_single_active_layout
BEFORE INSERT OR UPDATE ON layouts
FOR EACH ROW EXECUTE FUNCTION ensure_single_active_layout();


-- ============================================
-- 5. Auto-update updated_at Trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_layouts_updated_at ON layouts;

CREATE TRIGGER trigger_layouts_updated_at
BEFORE UPDATE ON layouts
FOR EACH ROW EXECUTE FUNCTION update_layouts_updated_at();


-- ============================================
-- RLS Policies (Optional - enable if needed)
-- ============================================

-- Enable RLS (uncomment if using Row Level Security)
-- ALTER TABLE layouts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE layout_equipment ENABLE ROW LEVEL SECURITY;

-- Policy: All users can read all layouts
-- CREATE POLICY "layouts_read_all" ON layouts FOR SELECT USING (true);

-- Policy: All users can modify all layouts (no auth required per spec)
-- CREATE POLICY "layouts_write_all" ON layouts FOR ALL USING (true);


COMMIT;

-- ============================================
-- Verification Queries (run manually to verify)
-- ============================================
--
-- Check tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('layouts', 'layout_equipment');
--
-- Check columns:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'layout_equipment' ORDER BY ordinal_position;
--
-- Check indexes exist:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('layouts', 'layout_equipment');
--
-- Test single active trigger:
-- INSERT INTO layouts (factory_id, name, is_active)
-- VALUES ('your-factory-uuid', 'Test 1', true);
-- INSERT INTO layouts (factory_id, name, is_active)
-- VALUES ('your-factory-uuid', 'Test 2', true);
-- SELECT name, is_active FROM layouts WHERE factory_id = 'your-factory-uuid';
-- (Test 1 should be false, Test 2 should be true)
