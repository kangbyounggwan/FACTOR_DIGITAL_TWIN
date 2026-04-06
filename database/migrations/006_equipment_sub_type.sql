-- 설비 서브 타입 (컨베이어 역할: INPUT/OUTPUT 등)
ALTER TABLE equipment_scans
ADD COLUMN IF NOT EXISTS sub_type VARCHAR(20) DEFAULT NULL;
