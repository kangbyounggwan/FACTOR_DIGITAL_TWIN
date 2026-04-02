-- FACTOR Digital Twin - Initial Schema Migration
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================
-- 1. companies (회사)
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. factories (공장)
-- ============================================
CREATE TABLE IF NOT EXISTS factories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factories_company ON factories(company_id);

-- ============================================
-- 3. sites (사이트/라인)
-- ============================================
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) UNIQUE NOT NULL,
    factory_id UUID REFERENCES factories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_factory ON sites(factory_id);

-- ============================================
-- 4. equipment_types (설비 유형 마스터)
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name_ko VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    color_hex VARCHAR(7),
    icon VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 설비 타입 데이터
INSERT INTO equipment_types (code, name_ko, name_en, color_hex) VALUES
    ('SMT_LINE', 'SMT 라인', 'SMT Line', '#1D9E75'),
    ('REFLOW_OVEN', '리플로우 오븐', 'Reflow Oven', '#D85A30'),
    ('AOI_MACHINE', 'AOI 검사기', 'AOI Machine', '#7F77DD'),
    ('SCREEN_PRINTER', '스크린 프린터', 'Screen Printer', '#BA7517'),
    ('PICK_AND_PLACE', '칩 마운터', 'Pick and Place', '#1D9E75'),
    ('CONVEYOR', '컨베이어', 'Conveyor', '#639922'),
    ('CONTROL_PANEL', '제어 패널', 'Control Panel', '#5F5E5A'),
    ('STORAGE_RACK', '보관 랙', 'Storage Rack', '#5F5E5A'),
    ('UNKNOWN', '미분류', 'Unknown', '#3a3f3a')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5. equipment_scans (스캔된 설비)
-- ============================================
-- Drop existing table if needed (주의: 데이터 손실)
-- DROP TABLE IF EXISTS equipment_scans;

CREATE TABLE IF NOT EXISTS equipment_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id VARCHAR(50) UNIQUE NOT NULL,
    site_id VARCHAR(50) NOT NULL,
    equipment_type VARCHAR(30) DEFAULT 'UNKNOWN',

    -- 3D 위치/크기 정보
    centroid_x FLOAT NOT NULL DEFAULT 0,
    centroid_y FLOAT NOT NULL DEFAULT 0,
    centroid_z FLOAT NOT NULL DEFAULT 0,
    size_w FLOAT NOT NULL DEFAULT 1,
    size_h FLOAT NOT NULL DEFAULT 1,
    size_d FLOAT NOT NULL DEFAULT 1,

    -- 포인트클라우드 정보
    point_count INTEGER DEFAULT 0,
    ply_url TEXT,

    -- 구역 및 상태
    zone VARCHAR(50),
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMPTZ,

    -- 메타데이터
    scan_date DATE,
    note TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_site ON equipment_scans(site_id);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment_scans(equipment_type);
CREATE INDEX IF NOT EXISTS idx_equipment_verified ON equipment_scans(verified);

-- ============================================
-- 6. factory_users (공장-사용자 권한)
-- ============================================
CREATE TABLE IF NOT EXISTS factory_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    factory_id UUID REFERENCES factories(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer',  -- admin, operator, viewer
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, factory_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_users_user ON factory_users(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_users_factory ON factory_users(factory_id);

-- ============================================
-- 7. scan_sessions (스캔 업로드 세션)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) NOT NULL,
    uploaded_by UUID,

    -- 업로드된 파일 정보
    original_filename TEXT,
    ply_url TEXT NOT NULL,
    file_size_bytes BIGINT,

    -- 처리 상태
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    equipment_count INTEGER DEFAULT 0,
    error_message TEXT,

    -- 타임스탬프
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_site ON scan_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_status ON scan_sessions(status);

-- ============================================
-- 테스트 데이터 (개발용)
-- ============================================

-- 회사
INSERT INTO companies (id, name, code) VALUES
    ('11111111-1111-1111-1111-111111111111', '제이엠테크', 'JMTECH')
ON CONFLICT (code) DO NOTHING;

-- 공장
INSERT INTO factories (id, company_id, name, code, address) VALUES
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '제이엠 본사 공장', 'JM_MAIN', '경기도 화성시')
ON CONFLICT (code) DO NOTHING;

-- 사이트
INSERT INTO sites (site_id, factory_id, name, description) VALUES
    ('JM_PCB_001', '22222222-2222-2222-2222-222222222222', 'PCB 1라인', 'SMT 주 생산라인'),
    ('SITE_002', '22222222-2222-2222-2222-222222222222', 'PCB 2라인', 'SMT 보조라인')
ON CONFLICT (site_id) DO NOTHING;

COMMIT;
