from supabase import create_client, Client
from fastapi import HTTPException
from app.core.config import settings

# Global client instance (will be recreated if connection fails)
_supabase_client: Client | None = None


def get_supabase() -> Client:
    """Get Supabase client, creating new one if needed."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )
    return _supabase_client


def reset_supabase_client():
    """Reset the client to force reconnection."""
    global _supabase_client
    _supabase_client = None


def fetch_one(db: Client, table: str, column: str, value, select: str = "*", label: str = "항목") -> dict:
    """.single() 대신 사용. 0건이면 404, 1건이면 dict 반환."""
    resp = db.table(table).select(select).eq(column, value).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail=f"{label}을(를) 찾을 수 없습니다.")
    return resp.data[0]


def fetch_one_or_none(db: Client, table: str, column: str, value, select: str = "*"):
    """0건이면 None, 1건이면 dict 반환."""
    resp = db.table(table).select(select).eq(column, value).execute()
    return resp.data[0] if resp.data else None
