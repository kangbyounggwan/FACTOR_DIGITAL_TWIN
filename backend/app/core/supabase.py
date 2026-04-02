from supabase import create_client, Client
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
