from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ActivityLog, Form, FormResponse, ResponseDetail, User
from ..schemas import LogOut
from ..services.permissions import ensure_manage
from ..services.validation import deserialize

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _series(db: Session, form_ids_stmt, days: int) -> list[dict]:
    start = date.today() - timedelta(days=days - 1)
    rows = db.execute(
        select(func.date(FormResponse.submitted_at), func.count())
        .where(FormResponse.form_id.in_(form_ids_stmt), FormResponse.submitted_at >= datetime.combine(start, time.min))
        .group_by(func.date(FormResponse.submitted_at))
    ).all()
    counts = {str(d)[:10]: c for d, c in rows}
    return [{"date": (start + timedelta(days=i)).isoformat(), "count": counts.get((start + timedelta(days=i)).isoformat(), 0)}
            for i in range(days)]


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scope = select(Form.id) if user.is_admin else select(Form.id).where(Form.owner_id == user.id)
    total_forms = db.scalar(select(func.count()).select_from(scope.subquery())) or 0
    active_stmt = select(func.count(Form.id)).where(Form.is_active.is_(True))
    if not user.is_admin:
        active_stmt = active_stmt.where(Form.owner_id == user.id)
    total_responses = db.scalar(select(func.count(FormResponse.id)).where(FormResponse.form_id.in_(scope))) or 0
    today = db.scalar(select(func.count(FormResponse.id)).where(
        FormResponse.form_id.in_(scope), FormResponse.submitted_at >= datetime.combine(date.today(), time.min))) or 0
    top = db.execute(
        select(Form.id, Form.title, func.count(FormResponse.id).label("c"))
        .join(FormResponse, FormResponse.form_id == Form.id).where(Form.id.in_(scope))
        .group_by(Form.id, Form.title).order_by(func.count(FormResponse.id).desc()).limit(5)
    ).all()
    log_stmt = select(ActivityLog).order_by(ActivityLog.id.desc()).limit(8)
    if not user.is_admin:
        log_stmt = log_stmt.where((ActivityLog.user_id == user.id) | (ActivityLog.form_id.in_(scope)))
    return {
        "total_forms": total_forms,
        "active_forms": db.scalar(active_stmt) or 0,
        "total_responses": total_responses,
        "responses_today": today,
        "total_users": db.scalar(select(func.count(User.id))) if user.is_admin else None,
        "series": _series(db, scope, 14),
        "top_forms": [{"id": i, "title": t, "count": c} for i, t, c in top],
        "recent_activity": [LogOut.model_validate(l) for l in db.scalars(log_stmt).all()],
    }


@router.get("/forms/{form_id}")
def form_analytics(form_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form = db.get(Form, form_id)
    if not form:
        raise HTTPException(404, "Form not found")
    ensure_manage(form, user)
    total = db.scalar(select(func.count(FormResponse.id)).where(FormResponse.form_id == form_id)) or 0
    last = db.scalar(select(func.max(FormResponse.submitted_at)).where(FormResponse.form_id == form_id))
    edited = db.scalar(select(func.count(FormResponse.id)).where(
        FormResponse.form_id == form_id, FormResponse.updated_at.is_not(None))) or 0
    by_field = defaultdict(list)
    for fid, val in db.execute(
        select(ResponseDetail.field_id, ResponseDetail.value).join(FormResponse).where(FormResponse.form_id == form_id)
    ):
        if val not in (None, ""):
            by_field[fid].append(val)
    fields = []
    for f in form.fields:
        vals = [deserialize(f, v) for v in by_field.get(f.id, [])]
        stat = {"field_id": f.id, "label": f.label, "type": f.field_type, "answered": len(vals),
                "response_rate": round(100 * len(vals) / total, 1) if total else 0}
        if f.field_type in ("dropdown", "radio", "checkbox"):
            c = Counter(x for v in vals for x in (v if isinstance(v, list) else [v]))
            stat["distribution"] = [{"label": o.label, "count": c.get(o.value, 0)} for o in f.options]
        elif f.field_type == "rating":
            mx = int((f.validation or {}).get("max") or 5)
            c = Counter(int(v) for v in vals)
            stat["average"] = round(sum(c.elements()) / len(vals), 2) if vals else None
            stat["distribution"] = [{"label": str(i), "count": c.get(i, 0)} for i in range(1, mx + 1)]
        elif f.field_type == "number":
            nums = [float(v) for v in vals if isinstance(v, (int, float))]
            if nums:
                stat.update(min=min(nums), max=max(nums), average=round(sum(nums) / len(nums), 2))
        fields.append(stat)
    return {
        "form_id": form.id, "title": form.title, "is_active": form.is_active, "total_responses": total,
        "edited_responses": edited, "last_response_at": last,
        "series": _series(db, select(Form.id).where(Form.id == form_id), 30), "fields": fields,
    }
