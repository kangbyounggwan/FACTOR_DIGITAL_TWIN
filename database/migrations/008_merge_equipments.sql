-- ============================================================
-- 008: equipment_scans + equipments 테이블 통합
-- equipment_scans에 MES 컬럼 추가 → 단일 테이블로 운영
-- ============================================================

-- 1. MES 자산 관리 컬럼 추가
ALTER TABLE equipment_scans
  ADD COLUMN IF NOT EXISTS manufacturer   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS model          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS serial_number  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS asset_number   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS purchase_date  DATE,
  ADD COLUMN IF NOT EXISTS installation_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_end_date DATE;

-- 2. MES 네트워크/PLC 연결 컬럼 추가
ALTER TABLE equipment_scans
  ADD COLUMN IF NOT EXISTS ip_address         INET,
  ADD COLUMN IF NOT EXISTS mac_address        VARCHAR(17),
  ADD COLUMN IF NOT EXISTS plc_type           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS plc_address        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS protocol           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS connection_config  JSONB DEFAULT '{}';

-- 3. MES 생산 스펙 컬럼 추가
ALTER TABLE equipment_scans
  ADD COLUMN IF NOT EXISTS standard_cycle_time INTEGER,
  ADD COLUMN IF NOT EXISTS capacity_per_hour   INTEGER;

-- 4. MES 미디어/메타데이터 컬럼 추가
ALTER TABLE equipment_scans
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS specifications  JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags            TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT TRUE;

-- 5. equipments → equipment_scans 참조용 뷰 생성 (기존 MES 코드 호환)
CREATE OR REPLACE VIEW equipments_view AS
SELECT
  id,
  scan_code AS code,
  name,
  note AS description,
  equipment_type_id,
  line_id,
  status AS status_code,
  is_active,
  manufacturer,
  model,
  serial_number,
  asset_number,
  purchase_date,
  installation_date,
  warranty_end_date,
  ip_address,
  mac_address,
  plc_type,
  plc_address,
  protocol,
  connection_config,
  standard_cycle_time,
  capacity_per_hour,
  image_url,
  thumbnail_url,
  specifications,
  tags,
  centroid_x AS position_x,
  centroid_y AS position_y,
  centroid_z AS position_z,
  size_w,
  size_h,
  size_d,
  created_at,
  updated_at
FROM equipment_scans;

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_equipment_scans_serial
  ON equipment_scans(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_scans_ip
  ON equipment_scans(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_scans_is_active
  ON equipment_scans(is_active);
