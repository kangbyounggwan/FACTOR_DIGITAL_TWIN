-- 설비 그룹 테이블 (존 간 연결, 컨베이어 브릿지 등)
CREATE TABLE IF NOT EXISTS equipment_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    group_type VARCHAR(50) DEFAULT 'BRIDGE',  -- BRIDGE, CLUSTER, FLOW 등
    description TEXT,
    -- 그룹의 계산된 바운딩 박스 (캐시용, 멤버 변경 시 업데이트)
    centroid_x FLOAT,
    centroid_y FLOAT,
    centroid_z FLOAT,
    size_w FLOAT,
    size_h FLOAT,
    size_d FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- equipment_scans에 group_id 추가
ALTER TABLE equipment_scans
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES equipment_groups(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_equipment_groups_line_id ON equipment_groups(line_id);
CREATE INDEX IF NOT EXISTS idx_equipment_scans_group_id ON equipment_scans(group_id);

-- 그룹 바운딩 박스 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_group_bounds()
RETURNS TRIGGER AS $$
DECLARE
    g_id UUID;
BEGIN
    -- 변경된 설비의 group_id 가져오기
    IF TG_OP = 'DELETE' THEN
        g_id := OLD.group_id;
    ELSE
        g_id := COALESCE(NEW.group_id, OLD.group_id);
    END IF;

    IF g_id IS NOT NULL THEN
        UPDATE equipment_groups g SET
            centroid_x = sub.cx,
            centroid_y = sub.cy,
            centroid_z = sub.cz,
            size_w = sub.sw,
            size_h = sub.sh,
            size_d = sub.sd,
            updated_at = NOW()
        FROM (
            SELECT
                AVG(centroid_x) as cx,
                AVG(centroid_y) as cy,
                AVG(centroid_z) as cz,
                MAX(centroid_x + size_w/2) - MIN(centroid_x - size_w/2) as sw,
                MAX(centroid_y + size_h/2) - MIN(centroid_y - size_h/2) as sh,
                MAX(centroid_z + size_d/2) - MIN(centroid_z - size_d/2) as sd
            FROM equipment_scans
            WHERE group_id = g_id
        ) sub
        WHERE g.id = g_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trg_update_group_bounds ON equipment_scans;
CREATE TRIGGER trg_update_group_bounds
    AFTER INSERT OR UPDATE OF group_id, centroid_x, centroid_y, centroid_z, size_w, size_h, size_d OR DELETE
    ON equipment_scans
    FOR EACH ROW
    EXECUTE FUNCTION update_group_bounds();

-- RLS 정책
ALTER TABLE equipment_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for equipment_groups" ON equipment_groups
    FOR ALL USING (true) WITH CHECK (true);
