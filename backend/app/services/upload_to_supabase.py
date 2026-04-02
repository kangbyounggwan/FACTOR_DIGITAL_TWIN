"""
upload_to_supabase.py — 전처리 결과 → Supabase 적재
실행: python upload_to_supabase.py ./output SITE_001
"""

import json
import sys
from pathlib import Path

from supabase import create_client, Client

from app.core.config import settings


def get_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def upload_ply_to_storage(client: Client, local_path: Path, site_id: str) -> str:
    """PLY 파일을 Supabase Storage에 업로드하고 공개 URL 반환."""
    bucket = "pointclouds"
    storage_path = f"{site_id}/{local_path.name}"

    with open(local_path, "rb") as f:
        client.storage.from_(bucket).upload(
            path=storage_path,
            file=f,
            file_options={"content-type": "application/octet-stream", "upsert": "true"},
        )

    url = client.storage.from_(bucket).get_public_url(storage_path)
    return url


def upload_equipment_metadata(client: Client, records: list[dict], site_id: str, output_dir: Path):
    """equipment_scans 테이블에 upsert."""
    enriched = []
    for rec in records:
        ply_local = output_dir / rec["ply_path"]
        if ply_local.exists():
            storage_url = upload_ply_to_storage(client, ply_local, site_id)
            rec = {**rec, "ply_url": storage_url}
        enriched.append(rec)

    # 배치 upsert (conflict: equipment_id + scan_date)
    resp = client.table("equipment_scans").upsert(enriched).execute()
    return resp


def upload_scan_origin(client: Client, origin: dict):
    """scan_origins 테이블에 기준점 저장."""
    client.table("scan_origins").upsert(origin).execute()


def run(output_dir: str, site_id: str):
    dst = Path(output_dir)
    client = get_client()

    print(f"[1/3] 설비 메타데이터 적재 — {site_id}")
    meta_path = dst / "equipment_metadata.json"
    with open(meta_path, encoding="utf-8") as f:
        records = json.load(f)
    upload_equipment_metadata(client, records, site_id, dst)
    print(f"      {len(records)}개 설비 적재 완료")

    print("[2/3] 스캔 기준점 적재")
    origin_path = dst / "scan_origin.json"
    with open(origin_path, encoding="utf-8") as f:
        origin = json.load(f)
    upload_scan_origin(client, origin)

    print("[3/3] 바닥 포인트클라우드 업로드")
    floor_path = dst / "floor.ply"
    if floor_path.exists():
        url = upload_ply_to_storage(client, floor_path, site_id)
        print(f"      → {url}")

    print("Supabase 적재 완료")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python upload_to_supabase.py <output_dir> <site_id>")
        sys.exit(1)
    run(sys.argv[1], sys.argv[2])
