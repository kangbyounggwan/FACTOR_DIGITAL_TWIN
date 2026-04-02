-- FACTOR Digital Twin - Add 3D Scan Tables
-- 기존 MES 스키마에 Digital Twin 기능 추가

BEGIN;

-- ============================================
-- 1. equipment_scans (3D 스캔 데이터)
-- equipments 테이블과 연동되는 3D 포인트클라우드 데이터
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 기존 MES equipments 테이블 연동 (선택적)
    equipment_id UUID REFERENCES equipments(id) ON DELETE SET NULL,

    -- 독립적 식별자 (스캔 시점에 equipments에 없을 수 있음)
    scan_code VARCHAR(50) UNIQUE NOT NULL,  -- EQ_SCAN_001 등
    line_id UUID REFERENCES production_lines(id) ON DELETE CASCADE,

    -- 3D 위치/크기 정보
    centroid_x FLOAT NOT NULL DEFAULT 0,
    centroid_y FLOAT NOT NULL DEFAULT 0,
    centroid_z FLOAT NOT NULL DEFAULT 0,
    size_w FLOAT NOT NULL DEFAULT 1,
    size_h FLOAT NOT NULL DEFAULT 1,
    size_d FLOAT NOT NULL DEFAULT 1,

    -- 포인트클라우드 정보
    point_count INTEGER DEFAULT 0,
    ply_url TEXT,  -- Supabase Storage URL

    -- 설비 타입 (MES equipment_types 참조)
    equipment_type_id UUID REFERENCES equipment_types(id),

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

CREATE INDEX IF NOT EXISTS idx_equipment_scans_line ON equipment_scans(line_id);
CREATE INDEX IF NOT EXISTS idx_equipment_scans_equipment ON equipment_scans(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_scans_verified ON equipment_scans(verified);

-- ============================================
-- 2. scan_sessions (스캔 업로드 세션)
-- LiDAR 파일 업로드 및 처리 상태 추적
-- ============================================
CREATE TABLE IF NOT EXISTS scan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES production_lines(id) ON DELETE CASCADE,
    uploaded_by UUID,

    -- 업로드된 파일 정보
    original_filename TEXT,
    ply_url TEXT NOT NULL,
    file_size_bytes BIGINT,

    -- 처리 상태
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    equipment_count INTEGER DEFAULT 0,     -- 분리된 설비 수
    error_message TEXT,

    -- 타임스탬프
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_line ON scan_sessions(line_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_status ON scan_sessions(status);

-- ============================================
-- 3. equipments 테이블에 3D 컬럼 추가 (선택적)
-- ============================================
DO $$
BEGIN
    -- position_z 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipments' AND column_name = 'position_z'
    ) THEN
        ALTER TABLE equipments ADD COLUMN position_z NUMERIC DEFAULT 0;
    END IF;

    -- size_w, size_h, size_d 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipments' AND column_name = 'size_w'
    ) THEN
        ALTER TABLE equipments ADD COLUMN size_w NUMERIC DEFAULT 1;
        ALTER TABLE equipments ADD COLUMN size_h NUMERIC DEFAULT 1;
        ALTER TABLE equipments ADD COLUMN size_d NUMERIC DEFAULT 1;
    END IF;

    -- scan_id 참조 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipments' AND column_name = 'scan_id'
    ) THEN
        ALTER TABLE equipments ADD COLUMN scan_id UUID REFERENCES equipment_scans(id);
    END IF;
END $$;

COMMIT;
