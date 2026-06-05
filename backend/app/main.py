from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models   # noqa: F401  確保所有 ORM model 載入、Base.metadata 完整
from app.api.v1 import receiving as receiving_v1
from app.api.v1 import inventory as inventory_v1
from app.api.v1 import picking as picking_v1
from app.api.v1 import shipping as shipping_v1
from app.api.v1 import traceability as traceability_v1
from app.api.v1.auth import router as auth_router

app = FastAPI(title="WMS Semiconductor API", version="0.1.0")
app.include_router(auth_router)
app.include_router(receiving_v1.router, prefix="/api/v1/receiving")
app.include_router(inventory_v1.router, prefix="/api/v1/inventory")
app.include_router(picking_v1.router)
app.include_router(shipping_v1.router)
app.include_router(traceability_v1.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "wms-backend"}


@app.get("/api/v1/ping")
def ping():
     """Minimal API prefix route for frontend connectivity checks."""
    return {"message": "pong"}
