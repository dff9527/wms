from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  確保所有 ORM model 載入、Base.metadata 完整
from app.api.v1 import receiving as receiving_v1
from app.api.v1 import inventory as inventory_v1
from app.api.v1 import picking as picking_v1
from app.api.v1 import shipping as shipping_v1
from app.api.v1 import traceability as traceability_v1
from app.api.v1 import purchase_orders as purchase_orders_v1
from app.api.v1 import dashboard as dashboard_v1
from app.api.v1.auth import router as auth_router
from app.api.v1.customers import router as customers_router
from app.api.v1.barcodes import router as barcodes_router
from app.api.v1.vendors import router as vendors_router
from app.api.v1.users import router as users_router
from app.api.deps import get_current_user

app = FastAPI(title="WMS Semiconductor API", version="0.1.0")
app.include_router(auth_router)
app.include_router(
    receiving_v1.router,
    prefix="/api/v1/receiving",
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    inventory_v1.router,
    prefix="/api/v1/inventory",
    dependencies=[Depends(get_current_user)],
)
app.include_router(picking_v1.router, dependencies=[Depends(get_current_user)])
app.include_router(shipping_v1.router, dependencies=[Depends(get_current_user)])
app.include_router(traceability_v1.router, dependencies=[Depends(get_current_user)])
app.include_router(customers_router)
app.include_router(
    barcodes_router, prefix="/api/v1", dependencies=[Depends(get_current_user)]
)  # 變成 /api/v1/barcodes/*
app.include_router(
    vendors_router, prefix="/api/v1", dependencies=[Depends(get_current_user)]
)  # 變成 /api/v1/vendors/*
app.include_router(purchase_orders_v1.router, dependencies=[Depends(get_current_user)])
app.include_router(users_router)
app.include_router(
    dashboard_v1.router,
    prefix="/api/v1/dashboard",
    dependencies=[Depends(get_current_user)],
)

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


# FIX: [fix_1] — Fix docstring indentation to match function body (4 spaces)
@app.get("/api/v1/ping")
def ping():
    """Minimal API prefix route for frontend connectivity checks."""
    return {"message": "pong"}
