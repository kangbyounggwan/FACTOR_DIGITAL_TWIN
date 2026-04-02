-- equipment_scans: 설비별 스캔 결과 메타데이터
create table if not exists equipment_scans (
    id               bigserial primary key,
    equipment_id     text not null,          -- 예) SITE_001_EQ_0001
    site_id          text not null,
    equipment_type   text,                   -- CNC_MCT / CONVEYOR / RACK / ...
    scan_date        date not null,
    operator         text,
    centroid_x       numeric(10,4),
    centroid_y       numeric(10,4),
    centroid_z       numeric(10,4),
    bbox_min         jsonb,                  -- [x,y,z]
    bbox_max         jsonb,                  -- [x,y,z]
    size_w           numeric(8,4),           -- 폭 (m)
    size_d           numeric(8,4),           -- 깊이 (m)
    size_h           numeric(8,4),           -- 높이 (m)
    point_count      integer,
    ply_url          text,                   -- Supabase Storage 공개 URL
    verified         boolean default false,  -- 수동 검수 완료 여부
    note             text,
    created_at       timestamptz default now(),
    unique (equipment_id, scan_date)
);

-- 공간 인덱스 (centroid 기반 근접 검색용)
create index if not exists idx_equipment_scans_site
    on equipment_scans (site_id, scan_date);

-- scan_origins: 역변환용 기준점
create table if not exists scan_origins (
    site_id    text primary key,
    origin_x   numeric(14,6),
    origin_y   numeric(14,6),
    origin_z   numeric(14,6),
    updated_at timestamptz default now()
);

-- Storage bucket: pointclouds (Supabase 대시보드에서 생성 or SQL)
-- insert into storage.buckets (id, name, public) values ('pointclouds', 'pointclouds', true)
-- on conflict do nothing;
