import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..celery_app import celery_app
from ..database import get_db
from ..deps import get_current_user
from ..models import FormResponse, User
from ..services.activity import log_activity
from ..services.export import EXPORTERS
from ..services.files import EXPORT_RE, export_dir
from ..services.permissions import ensure_manage
from ..services.queries import response_query
from ..tasks import generate_export
from .forms import get_form

router = APIRouter(tags=["Exports"])
Fmt = Literal["xlsx", "pdf"]


@router.get("/forms/{form_id}/export")
def export_now(
    form_id: int, request: Request,
    fmt: Fmt = Query("xlsx", alias="format"),
    q: str | None = None, field_id: int | None = None, value: str | None = None,
    date_from: date | None = None, date_to: date | None = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    """Download responses (honouring the same filters as the list endpoint) as Excel or PDF."""
    form = get_form(db, form_id)
    ensure_manage(form, user)
    rows = db.scalars(response_query(form_id, q, field_id, value, date_from, date_to).order_by(FormResponse.id)).all()
    builder, media = EXPORTERS[fmt]
    log_activity(db, user, "form.exported", "form", form.id, {"format": fmt, "rows": len(rows)}, form_id=form.id, request=request)
    db.commit()
    safe = "".join(c if c.isalnum() else "_" for c in form.title)[:40] or "form"
    return Response(builder(form, list(rows)), media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{safe}_responses.{fmt}"'})


@router.post("/forms/{form_id}/export-jobs", status_code=202)
def start_export_job(
    form_id: int, request: Request,
    fmt: Fmt = Query("xlsx", alias="format"),
    q: str | None = None, field_id: int | None = None, value: str | None = None,
    date_from: date | None = None, date_to: date | None = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    """Queue the export on a Celery worker (for large forms). Poll the returned task id."""
    form = get_form(db, form_id)
    ensure_manage(form, user)
    task_id = f"export-{user.id}-{uuid.uuid4().hex}"
    filters = {"q": q, "field_id": field_id, "value": value,
               "date_from": date_from.isoformat() if date_from else None,
               "date_to": date_to.isoformat() if date_to else None}
    try:
        generate_export.apply_async(args=[form_id, fmt, filters], task_id=task_id)
    except Exception:
        raise HTTPException(503, "Background worker is unavailable. Use the direct export instead.")
    log_activity(db, user, "form.export_queued", "form", form.id, {"format": fmt}, form_id=form.id, request=request)
    db.commit()
    return {"task_id": task_id, "status": "PENDING"}


def _check_task_owner(task_id: str, user: User) -> None:
    if not (user.is_admin or task_id.startswith(f"export-{user.id}-")):
        raise HTTPException(403, "Not your export job")


@router.get("/export-jobs/{task_id}")
def export_job_status(task_id: str, user: User = Depends(get_current_user)):
    _check_task_owner(task_id, user)
    res = celery_app.AsyncResult(task_id)
    out = {"task_id": task_id, "status": res.state, "ready": res.ready()}
    if res.successful():
        out.update(res.result)
    elif res.failed():
        out["error"] = str(res.result)
    return out


@router.get("/export-jobs/{task_id}/download")
def export_job_download(task_id: str, user: User = Depends(get_current_user)):
    _check_task_owner(task_id, user)
    res = celery_app.AsyncResult(task_id)
    if not res.successful():
        raise HTTPException(409, "Export is not ready yet")
    name = res.result["filename"]
    if not EXPORT_RE.match(name) or not (export_dir() / name).exists():
        raise HTTPException(404, "Export file expired")
    return FileResponse(export_dir() / name, filename=f"{res.result['title']}_responses.{name.split('.')[-1]}")
