from typing import List
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase, fetch_one
from app.schemas.flow_connection import FlowConnectionCreate, FlowConnectionOut

router = APIRouter()


def transform_connection(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "factory_id": str(row["factory_id"]),
        "name": row["name"],
        "description": row.get("description"),
        "source_equipment_id": row["source_equipment_id"],
        "target_equipment_id": row["target_equipment_id"],
        "color": row.get("color", "#ff8800"),
        "line_style": row.get("line_style", "solid"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


@router.get("/factory/{factory_code}", response_model=List[FlowConnectionOut])
def list_flow_connections(factory_code: str, db: Client = Depends(get_supabase)):
    """List all flow connections for a factory."""
    factory = fetch_one(db, "factories", "code", factory_code, select="id", label="공장")
    resp = db.table("flow_connections").select("*").eq("factory_id", factory["id"]).order("created_at").execute()
    return [transform_connection(r) for r in resp.data]


@router.post("/", response_model=FlowConnectionOut)
def create_flow_connection(body: FlowConnectionCreate, db: Client = Depends(get_supabase)):
    """Create a new flow connection."""
    insert_data = {
        "factory_id": body.factory_id,
        "name": body.name,
        "description": body.description,
        "source_equipment_id": body.source_equipment_id,
        "target_equipment_id": body.target_equipment_id,
        "color": body.color,
        "line_style": body.line_style,
    }
    try:
        resp = db.table("flow_connections").insert(insert_data).execute()
        if resp.data:
            return transform_connection(resp.data[0])
        raise HTTPException(status_code=500, detail="Failed to create flow connection.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


@router.delete("/{connection_id}")
def delete_flow_connection(connection_id: str, db: Client = Depends(get_supabase)):
    """Delete a flow connection."""
    try:
        db.table("flow_connections").delete().eq("id", connection_id).execute()
        return {"deleted": connection_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")
