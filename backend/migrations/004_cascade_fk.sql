-- FACTOR Digital Twin - CASCADE FK and Delete Info Functions
-- Migration: 004_cascade_fk.sql
-- Description: Ensure CASCADE delete constraints and add helper functions for delete confirmation
--
-- Prerequisites:
--   - 001_initial_schema.sql (companies, factories, sites, equipment_scans)
--
-- Note: The initial schema already has CASCADE on most FKs.
-- This migration adds helper functions to count children before delete.

BEGIN;

-- ============================================
-- 1. Verify/Add CASCADE Constraints
-- ============================================
-- These are likely already in place from 001_initial_schema.sql
-- Running ALTER with IF NOT EXISTS pattern for idempotency

-- factories -> companies (already CASCADE in 001)
DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'factories_company_id_fkey'
        AND table_name = 'factories'
    ) THEN
        ALTER TABLE factories
        ADD CONSTRAINT factories_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- sites -> factories (already CASCADE in 001)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sites_factory_id_fkey'
        AND table_name = 'sites'
    ) THEN
        ALTER TABLE sites
        ADD CONSTRAINT sites_factory_id_fkey
        FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE;
    END IF;
END $$;


-- ============================================
-- 2. Count Children Functions for Delete Confirmation
-- ============================================
-- These functions are called by the API to show users
-- how many child records will be deleted.

-- Count children of a company
CREATE OR REPLACE FUNCTION count_company_children(company_uuid UUID)
RETURNS TABLE(
    factories_count INT,
    sites_count INT,
    equipment_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INT FROM factories WHERE company_id = company_uuid) AS factories_count,
        (SELECT COUNT(*)::INT FROM sites s
         JOIN factories f ON s.factory_id = f.id
         WHERE f.company_id = company_uuid) AS sites_count,
        (SELECT COUNT(*)::INT FROM equipment_scans es
         WHERE es.site_id IN (
             SELECT s.site_id FROM sites s
             JOIN factories f ON s.factory_id = f.id
             WHERE f.company_id = company_uuid
         )) AS equipment_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_company_children IS 'Returns count of factories, sites, and equipment under a company';


-- Count children of a factory
CREATE OR REPLACE FUNCTION count_factory_children(factory_uuid UUID)
RETURNS TABLE(
    sites_count INT,
    equipment_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INT FROM sites WHERE factory_id = factory_uuid) AS sites_count,
        (SELECT COUNT(*)::INT FROM equipment_scans es
         WHERE es.site_id IN (
             SELECT s.site_id FROM sites s
             WHERE s.factory_id = factory_uuid
         )) AS equipment_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_factory_children IS 'Returns count of sites and equipment under a factory';


-- Count children of a site (line)
CREATE OR REPLACE FUNCTION count_site_children(target_site_id VARCHAR(50))
RETURNS TABLE(
    equipment_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INT FROM equipment_scans WHERE site_id = target_site_id) AS equipment_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_site_children IS 'Returns count of equipment under a site/line';


-- ============================================
-- 3. Count layouts for a factory
-- ============================================
-- Useful when deleting a factory to know how many layouts will be lost

CREATE OR REPLACE FUNCTION count_factory_layouts(factory_uuid UUID)
RETURNS TABLE(
    layouts_count INT,
    layout_equipment_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INT FROM layouts WHERE factory_id = factory_uuid) AS layouts_count,
        (SELECT COUNT(*)::INT FROM layout_equipment le
         JOIN layouts l ON le.layout_id = l.id
         WHERE l.factory_id = factory_uuid) AS layout_equipment_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_factory_layouts IS 'Returns count of layouts and layout_equipment records for a factory';


-- ============================================
-- 4. Add is_active column to companies/factories/sites if missing
-- ============================================
-- For soft delete / deactivation feature

DO $$
BEGIN
    -- companies.is_active
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE companies ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    -- factories.is_active
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'factories' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE factories ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    -- sites.is_active
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sites' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE sites ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;


COMMIT;

-- ============================================
-- Verification Queries
-- ============================================
--
-- Test count_company_children:
-- SELECT * FROM count_company_children('your-company-uuid');
--
-- Test count_factory_children:
-- SELECT * FROM count_factory_children('your-factory-uuid');
--
-- Test count_site_children:
-- SELECT * FROM count_site_children('your-site-id');
--
-- Check is_active columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name IN ('companies', 'factories', 'sites')
-- AND column_name = 'is_active';
