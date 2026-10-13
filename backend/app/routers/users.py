from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import Role, User
from ..schemas import UserOut, UserUpdate
from ..services.activity import log_activity

router = APIRouter(prefix="/users", tags=["Users (Admin)"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, request: Request, db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot change your own role or status")
    changes = {}
    if payload.role and payload.role != user.role.name:
        user.role_id = db.scalar(select(Role).where(Role.name == payload.role)).id
        changes["role"] = payload.role
    if payload.is_active is not None and payload.is_active != user.is_active:
        user.is_active = payload.is_active
        changes["is_active"] = payload.is_active
    if changes:
        log_activity(db, admin, "user.updated", "user", user.id, {"email": user.email, **changes}, request=request)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot delete your own account")
    from ..models import Form
    if db.scalar(select(Form.id).where(Form.owner_id == user.id).limit(1)):
        raise HTTPException(409, "This user still owns forms. Disable the account instead, or delete their forms first.")
    log_activity(db, admin, "user.deleted", "user", user.id, {"email": user.email}, request=request)
    db.delete(user)
    db.commit()
