from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ActivityLog, Form, User
from ..schemas import LogPage

router = APIRouter(prefix="/logs", tags=["Activity Logs"])


@router.get("", response_model=LogPage)
def list_logs(
    entity_type: str | None = None,
    action: str | None = None,
    form_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admins see everything. Users see their own actions plus activity on forms they own."""
    stmt = select(ActivityLog)
    if not user.is_admin:
        stmt = stmt.where((ActivityLog.user_id == user.id) | (ActivityLog.form_id.in_(select(Form.id).where(Form.owner_id == user.id))))
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(ActivityLog.action.like(f"{action}%"))
    if form_id:
        stmt = stmt.where(ActivityLog.form_id == form_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(ActivityLog.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return LogPage(items=rows, total=total, page=page, page_size=page_size)
