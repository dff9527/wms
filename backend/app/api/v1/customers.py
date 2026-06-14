from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerOut
from app.api.v1.auth import get_current_user

try:
    from app.db import get_db
except ImportError:
    from app.dependencies import get_db

# FIX: [fix_1] — Add router-level authentication dependency to protect all customer endpoints
router = APIRouter(
    prefix="/api/v1/customers",
    tags=["customers"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=List[CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).filter(Customer.is_active == True).all()


@router.post("/", response_model=CustomerOut, status_code=201)
def create_customer(customer_in: CustomerCreate, db: Session = Depends(get_db)):
    # Check for duplicate customer_code
    existing = (
        db.query(Customer)
        .filter(Customer.customer_code == customer_in.customer_code)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Customer code already exists")

    db_customer = Customer(
        customer_code=customer_in.customer_code,
        customer_name=customer_in.customer_name,
        approved_avl=customer_in.approved_avl,
        is_active=customer_in.is_active,
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer
