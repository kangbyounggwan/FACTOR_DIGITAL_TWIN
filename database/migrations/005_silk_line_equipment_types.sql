-- 실크라인 (PCB 후공정) 설비 타입 추가
INSERT INTO equipment_types (code, name_ko, name_en, color_hex) VALUES
    ('SILK',      '실크인쇄',   'Silk Printer',     '#b45309'),
    ('EXPOSURE',  '노광기',     'Exposure Machine',  '#a16207'),
    ('PRE_DRY',   '가건조',     'Pre-Dryer',         '#fb923c'),
    ('DRY',       '건조',       'Dryer',             '#f97316'),
    ('DEVELOP',   '현상기',     'Developer',         '#0369a1'),
    ('ETCH',      '에칭기',     'Etcher',            '#b91c1c'),
    ('STRIP',     '박리기',     'Stripper',          '#db2777'),
    ('RINSE',     '수세/린스',  'Rinse',             '#60a5fa'),
    ('CHEMICAL',  '약품처리',   'Chemical Process',  '#10b981'),
    ('PRINT',     '인쇄기',     'Printer',           '#d97706')
ON CONFLICT (code) DO NOTHING;
