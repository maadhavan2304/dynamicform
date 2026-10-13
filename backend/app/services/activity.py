from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from ..models import ActivityLog, User


def log_activity(
    db: Session,
    user: User | None,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    details: dict[str, Any] | None = None,
    form_id: int | None = None,
    request: Request | None = None,
) -> None:
    """Add an activity log row to the current transaction (caller commits)."""
    db.add(
        ActivityLog(
            user_id=user.id if user else None,
            form_id=form_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=request.client.host if request and request.client else None,
        )
    )
