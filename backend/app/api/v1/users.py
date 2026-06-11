from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PasswordReset, ALLOWED_ROLES

router = APIRouter(prefix="/api/v1/users", tags=["users"], dependencies=[Depends(require_role("admin"))])


@router.get("", response_model=list[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    """Get all users."""
    users = db.query(User).all()
    return users


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Create a new user."""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_in.username).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    
    # Validate role
    if user_in.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role. Must be one of: {', '.join(ALLOWED_ROLES)}")
    
    # Create user with hashed password
    db_user = User(
        username=user_in.username,
        password_hash=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin"))
):
    """Update a user (partial update)."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check if trying to modify own is_active or role (prevent self-lockout)
    if current_user["username"] == user.username:
        if user_in.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account"
            )
        if user_in.role is not None and user_in.role != user.role:
            # If current user is admin and trying to change their role away from admin
            if current_user["role"] == "admin" and user_in.role != "admin":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change your own admin role"
                )
    
    # Validate role if provided
    if user_in.role is not None and user_in.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role. Must be one of: {', '.join(ALLOWED_ROLES)}")
    
    # Update fields
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/password")
def reset_password(
    user_id: int,
    password_in: PasswordReset,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin"))
):
    """Reset password for a user."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Prevent self-lockout: admin cannot change their own password through this endpoint
    if current_user["username"] == user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own password through this endpoint. Please use the admin interface."
        )
    
    user.password_hash = hash_password(password_in.new_password)
    db.commit()
    return {"success": True}