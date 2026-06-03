from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import receiving as receiving_v1
from app.api.v1 import inventory as inventory_v1

app = FastAPI(title="WMS Semiconductor API", version="0.1.0")
app.include_router(receiving_v1.router, prefix="/api/v1/receiving")
app.include_router(inventory_v1.router, prefix="/api/v1/inventory")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "wms-backend"}


# FIX: [fix_5] — Fix indentation of the docstring and return statement inside ping() to use consistent 4-space indentation
@app.get("/api/v1/ping")
def ping():
    """Minimal API prefix route for frontend connectivity checks."""
    return {"message": "pong"}
