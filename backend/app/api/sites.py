from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase import get_supabase

router = APIRouter()


@router.get("/")
def list_sites(db: Client = Depends(get_supabase)):
    resp = db.table("scan_origins").select("site_id, updated_at").execute()
    return resp.data
