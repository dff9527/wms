from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter(
    prefix="/api/v1/customers",
    tags=["customers"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=List[CustomerOut])
def list_customers(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Customer)
    if not include_inactive:
        q = q.filter(Customer.is_active == True)  # noqa: E712
    return q.order_by(Customer.customer_code).all()


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


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = customer_in.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """Soft-delete a customer (set is_active=False)."""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_active = False
    db.commit()
    return {"detail": "deleted"}
