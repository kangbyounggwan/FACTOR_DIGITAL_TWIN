"""
FACTOR Digital Twin — FastAPI 백엔드
"""
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import equipment, pipeline, sites, factories, companies, equipment_types, layouts, lines, zones
from app.core.config import settings

API_VERSION = "0.2.3"

app = FastAPI(
    title="FACTOR Digital Twin API",
    version=API_VERSION,
    docs_url="/docs",
    redirect_slashes=False,
)

@app.on_event("startup")
async def startup_event():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'='*50}")
    print(f"  FACTOR Digital Twin API v{API_VERSION}")
    print(f"  Started at: {now}")
    print(f"{'='*50}\n")

# GZip compression for large responses (point cloud data)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(factories.router, prefix="/api/factories", tags=["factories"])
app.include_router(equipment.router, prefix="/api/equipment", tags=["equipment"])
app.include_router(equipment_types.router, prefix="/api/equipment-types", tags=["equipment-types"])
app.include_router(pipeline.router,  prefix="/api/pipeline",  tags=["pipeline"])
app.include_router(sites.router,     prefix="/api/sites",     tags=["sites"])
app.include_router(layouts.router,   prefix="/api/layouts",   tags=["layouts"])
app.include_router(lines.router,     prefix="/api/lines",     tags=["lines"])
app.include_router(zones.router,     prefix="/api/zones",     tags=["zones"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "factor-digital-twin"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],
    )
