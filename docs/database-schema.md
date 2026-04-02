# FACTOR Digital Twin - Database Schema

## ERD 개요

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  companies  │────<│  factories  │────<│      sites       │
└─────────────┘     └─────────────┘     └──────────────────┘
                          │                      │
                          │                      │
                    ┌─────┴─────┐          ┌─────┴─────┐
                    │           │          │           │
              ┌─────┴─────┐     │    ┌─────┴──────┐    │
              │  users    │     │    │ equipment  │    │
              │ (auth)    │     │    │   _scans   │    │
              └───────────┘     │    └────────────┘    │
                    │           │                      │
              ┌─────┴───────────┴──────────────────────┘
              │
        ┌─────┴─────┐
        │  factory  │
        │  _users   │
        └───────────┘
```

## 테이블 정의

### 1. companies (회사)
```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,  -- 회사 코드 (예: SAMSUNG, LG)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. factories (공장)
```sql
CREATE TABLE factories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,  -- 공장 코드 (예: SAMSUNG_SUWON_P1)
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_factories_company ON factories(company_id);
```

### 3. sites (사이트/라인)
```sql
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) UNIQUE NOT NULL,  -- 기존 site_id 유지 (예: JM_PCB_001)
    factory_id UUID REFERENCES factories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sites_factory ON sites(factory_id);
```

### 4. equipment_types (설비 유형 마스터)
```sql
CREATE TABLE equipment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,  -- SMT_LINE, REFLOW_OVEN 등
    name_ko VARCHAR(100) NOT NULL,     -- 한글명
    name_en VARCHAR(100),              -- 영문명
    color_hex VARCHAR(7),              -- UI 색상 (#1D9E75)
    icon VARCHAR(50),                  -- 아이콘 이름
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터
INSERT INTO equipment_types (code, name_ko, name_en, color_hex) VALUES
    ('SMT_LINE', 'SMT 라인', 'SMT Line', '#1D9E75'),
    ('REFLOW_OVEN', '리플로우 오븐', 'Reflow Oven', '#D85A30'),
    ('AOI_MACHINE', 'AOI 검사기', 'AOI Machine', '#7F77DD'),
    ('SCREEN_PRINTER', '스크린 프린터', 'Screen Printer', '#BA7517'),
    ('PICK_AND_PLACE', '칩 마운터', 'Pick and Place', '#1D9E75'),
    ('CONVEYOR', '컨베이어', 'Conveyor', '#639922'),
    ('CONTROL_PANEL', '제어 패널', 'Control Panel', '#5F5E5A'),
    ('STORAGE_RACK', '보관 랙', 'Storage Rack', '#5F5E5A'),
    ('UNKNOWN', '미분류', 'Unknown', '#3a3f3a');
```

### 5. equipment_scans (스캔된 설비) - 기존 테이블 확장
```sql
CREATE TABLE equipment_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id VARCHAR(50) UNIQUE NOT NULL,  -- EQ_001, EQ_002 등
    site_id VARCHAR(50) REFERENCES sites(site_id) ON DELETE CASCADE,
    equipment_type VARCHAR(30) REFERENCES equipment_types(code),

    -- 3D 위치/크기 정보
    centroid_x FLOAT NOT NULL,
    centroid_y FLOAT NOT NULL,
    centroid_z FLOAT NOT NULL,
    size_w FLOAT NOT NULL,
    size_h FLOAT NOT NULL,
    size_d FLOAT NOT NULL,

    -- 포인트클라우드 정보
    point_count INTEGER DEFAULT 0,
    ply_url TEXT,  -- Supabase Storage URL

    -- 구역 및 상태
    zone VARCHAR(50),
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,

    -- 메타데이터
    scan_date DATE,
    note TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_equipment_site ON equipment_scans(site_id);
CREATE INDEX idx_equipment_type ON equipment_scans(equipment_type);
CREATE INDEX idx_equipment_verified ON equipment_scans(verified);
```

### 6. factory_users (공장-사용자 권한)
```sql
CREATE TABLE factory_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    factory_id UUID REFERENCES factories(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer',  -- admin, operator, viewer
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, factory_id)
);

CREATE INDEX idx_factory_users_user ON factory_users(user_id);
CREATE INDEX idx_factory_users_factory ON factory_users(factory_id);
```

### 7. scan_sessions (스캔 세션)
```sql
CREATE TABLE scan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) REFERENCES sites(site_id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id),

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

CREATE INDEX idx_scan_sessions_site ON scan_sessions(site_id);
CREATE INDEX idx_scan_sessions_status ON scan_sessions(status);
```

## RLS (Row Level Security) 정책

```sql
-- factories: 사용자가 속한 공장만 조회 가능
ALTER TABLE factories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their factories" ON factories
    FOR SELECT USING (
        id IN (
            SELECT factory_id FROM factory_users
            WHERE user_id = auth.uid()
        )
    );

-- sites: 사용자가 속한 공장의 사이트만 조회 가능
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sites in their factories" ON sites
    FOR SELECT USING (
        factory_id IN (
            SELECT factory_id FROM factory_users
            WHERE user_id = auth.uid()
        )
    );

-- equipment_scans: 사용자가 속한 공장의 설비만 조회 가능
ALTER TABLE equipment_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view equipment in their sites" ON equipment_scans
    FOR SELECT USING (
        site_id IN (
            SELECT s.site_id FROM sites s
            JOIN factory_users fu ON s.factory_id = fu.factory_id
            WHERE fu.user_id = auth.uid()
        )
    );

-- operator 이상만 설비 수정 가능
CREATE POLICY "Operators can update equipment" ON equipment_scans
    FOR UPDATE USING (
        site_id IN (
            SELECT s.site_id FROM sites s
            JOIN factory_users fu ON s.factory_id = fu.factory_id
            WHERE fu.user_id = auth.uid()
            AND fu.role IN ('admin', 'operator')
        )
    );
```

## 워크플로우

### 1. 초기 설정 (관리자)
```
회사 등록 → 공장 등록 → 사이트(라인) 등록 → 사용자 권한 부여
```

### 2. 설비 등록 (운영자)
```
공장 선택 → 사이트 선택 → LiDAR PLY 업로드 → 자동 분리 → 설비 타입 지정 → 저장
```

### 3. MES 연동 (뷰어)
```
로그인 → 권한 있는 공장 목록 → 공장 선택 → 사이트별 설비 현황 조회
```

## 마이그레이션 SQL

```sql
-- 전체 마이그레이션 스크립트
-- backend/migrations/001_initial_schema.sql 에 저장

BEGIN;

-- 1. companies
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. factories
CREATE TABLE IF NOT EXISTS factories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. sites
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) UNIQUE NOT NULL,
    factory_id UUID REFERENCES factories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. equipment_types
CREATE TABLE IF NOT EXISTS equipment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name_ko VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    color_hex VARCHAR(7),
    icon VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. equipment_scans (ALTER existing or CREATE)
-- ... (위 정의 참조)

-- 6. factory_users
CREATE TABLE IF NOT EXISTS factory_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    factory_id UUID REFERENCES factories(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, factory_id)
);

-- 7. scan_sessions
CREATE TABLE IF NOT EXISTS scan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) REFERENCES sites(site_id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id),
    original_filename TEXT,
    ply_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    status VARCHAR(20) DEFAULT 'pending',
    equipment_count INTEGER DEFAULT 0,
    error_message TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_factories_company ON factories(company_id);
CREATE INDEX IF NOT EXISTS idx_sites_factory ON sites(factory_id);
CREATE INDEX IF NOT EXISTS idx_equipment_site ON equipment_scans(site_id);
CREATE INDEX IF NOT EXISTS idx_factory_users_user ON factory_users(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_site ON scan_sessions(site_id);

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

COMMIT;
```
