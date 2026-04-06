-- 측정라인 설비 타입 추가: 3차원측정기(CMM)
INSERT INTO equipment_types (code, name)
VALUES ('CMM', '3차원측정기')
ON CONFLICT (code) DO NOTHING;

-- 측정라인 생산라인 추가 (JM_MAIN 공장)
INSERT INTO production_lines (factory_id, code, name, description, is_active, sort_order)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'JM_MEASURE_001',
  '측정라인',
  '3차원측정 라인',
  true,
  10
)
ON CONFLICT (code) DO NOTHING;
