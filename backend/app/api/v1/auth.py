from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import verify_password, create_access_token, hash_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut, PasswordChange

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(sub=user.username, role=user.role)
    return TokenResponse(access_token=access_token, token_type="bearer")


# FIX: [fix_2] — Normalize indentation for logout function body (docstring + return) to 4 spaces
@router.post("/logout")
def logout():
    """Stateless logout endpoint."""
    return {"detail": "logged out"}


# FIX: [fix_2] — Normalize indentation for read_users_me function body to 4 spaces
@router.get("/me", response_model=UserOut)
def read_users_me(
    current_user_dict: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    # current_user_dict is {'username': ..., 'role': ...} from get_current_user
    username = current_user_dict["username"]

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Re-check user.is_active after second DB query and raise 401 if inactive
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserOut.from_orm(user)


@router.post("/me/password", response_model=TokenResponse)
def change_my_password(
    password_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user_dict: dict = Depends(get_current_user),
):
    """Change own password."""
    username = current_user_dict["username"]
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(password_data.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password",
        )

    user.password_hash = hash_password(password_data.new_password)
    db.commit()
    return TokenResponse(
        access_token=create_access_token(sub=user.username, role=user.role),
        token_type="bearer",
    )
