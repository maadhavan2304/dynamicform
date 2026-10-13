from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_optional_user
from ..models import ActivityLog, Form, FormResponse, ResponseDetail, User, utcnow
from ..schemas import LogOut, ResponseDetailOut, ResponseOut, ResponsePage, SubmissionIn
from ..services.activity import log_activity
from ..services.permissions import can_edit_response, can_manage_form, can_view_response, ensure_manage
from ..services.queries import response_query
from ..services.validation import SubmissionError, deserialize, display_value, serialize, validate_submission
from .forms import get_form

router = APIRouter(tags=["Responses"])


def to_out(resp: FormResponse, form: Form, user: User | None) -> ResponseOut:
    fields = {f.id: f for f in form.fields}
    answers = {str(d.field_id): deserialize(fields[d.field_id], d.value) for d in resp.details if d.field_id in fields}
    return ResponseOut(
        id=resp.id, form_id=form.id, form_title=form.title, user_id=resp.user_id,
        submitted_by=resp.user.name if resp.user else "Anonymous",
        submitted_by_email=resp.user.email if resp.user else None,
        submitted_at=resp.submitted_at, updated_at=resp.updated_at, answers=answers,
        can_edit=can_edit_response(resp, form, user),
    )


def _labeled(form: Form, cleaned: dict[int, Any]) -> dict[str, Any]:
    by_id = {f.id: f for f in form.fields}
    return {by_id[i].label: display_value(by_id[i], v) for i, v in cleaned.items()}


def _validate(form: Form, answers: dict[str, Any]) -> dict[int, Any]:
    try:
        return validate_submission(form.fields, answers)
    except SubmissionError as e:
        raise HTTPException(422, {"message": "Please correct the highlighted fields", "errors": e.errors})


@router.post("/forms/{form_id}/responses", response_model=ResponseOut, status_code=201, tags=["Public"])
def submit_response(form_id: int, payload: SubmissionIn, request: Request, db: Session = Depends(get_db),
                    user: User | None = Depends(get_optional_user)):
    """Submit answers keyed by field id. Anonymous submission is allowed only for public forms."""
    form = get_form(db, form_id)
    if not form.is_active:
        raise HTTPException(403, "This form is currently disabled")
    if not form.is_public and not user:
        raise HTTPException(401, "Please log in to submit this form", headers={"WWW-Authenticate": "Bearer"})
    cleaned = _validate(form, payload.answers)
    resp = FormResponse(form_id=form.id, user_id=user.id if user else None)
    resp.details = [ResponseDetail(field_id=fid, value=serialize(v)) for fid, v in cleaned.items()]
    db.add(resp)
    db.flush()
    log_activity(db, user, "response.created", "response", resp.id,
                 {"form_title": form.title, "answers": _labeled(form, cleaned)}, form_id=form.id, request=request)
    db.commit()
    return to_out(resp, form, user)


@router.get("/forms/{form_id}/responses", response_model=ResponsePage)
def list_responses(
    form_id: int,
    q: str | None = Query(None, description="Free-text search across all answers"),
    field_id: int | None = Query(None, description="Filter on one field (use with `value`)"),
    value: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    form = get_form(db, form_id)
    ensure_manage(form, user)
    stmt = response_query(form_id, q, field_id, value, date_from, date_to)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(FormResponse.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return ResponsePage(items=[to_out(r, form, user) for r in rows], total=total, page=page, page_size=page_size)


@router.get("/me/responses", response_model=list[ResponseOut])
def my_responses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(FormResponse).where(FormResponse.user_id == user.id).order_by(FormResponse.id.desc())).all()
    return [to_out(r, r.form, user) for r in rows]


def _get_response(db: Session, response_id: int) -> FormResponse:
    resp = db.get(FormResponse, response_id)
    if not resp:
        raise HTTPException(404, "Response not found")
    return resp


@router.get("/responses/{response_id}", response_model=ResponseDetailOut)
def read_response(response_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resp = _get_response(db, response_id)
    if not can_view_response(resp, resp.form, user):
        raise HTTPException(403, "You cannot view this response")
    return ResponseDetailOut(**to_out(resp, resp.form, user).model_dump(), fields=resp.form.fields)


@router.put("/responses/{response_id}", response_model=ResponseOut)
def update_response(response_id: int, payload: SubmissionIn, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    """Admins and form owners can always edit. Submitters can edit their own response if the form allows it."""
    resp = _get_response(db, response_id)
    form = resp.form
    if not can_edit_response(resp, form, user):
        raise HTTPException(403, "You are not allowed to edit this response")
    cleaned = _validate(form, payload.answers)
    by_id = {f.id: f for f in form.fields}
    old = {d.field_id: d for d in resp.details}
    changes: dict[str, Any] = {}
    for fid, v in cleaned.items():
        label, new = by_id[fid].label, serialize(v)
        if fid in old:
            if old[fid].value != new:
                changes[label] = {"old": display_value(by_id[fid], deserialize(by_id[fid], old[fid].value)),
                                  "new": display_value(by_id[fid], v)}
                old[fid].value = new
        else:
            resp.details.append(ResponseDetail(field_id=fid, value=new))
            changes[label] = {"old": "", "new": display_value(by_id[fid], v)}
    for fid, d in old.items():
        if fid not in cleaned:
            f = by_id.get(fid)
            if f:
                changes[f.label] = {"old": display_value(f, deserialize(f, d.value)), "new": ""}
            resp.details.remove(d)
    if changes:
        resp.updated_at = utcnow()
        log_activity(db, user, "response.updated", "response", resp.id, {"changes": changes},
                     form_id=form.id, request=request)
        db.commit()
    return to_out(resp, form, user)


@router.delete("/responses/{response_id}", status_code=204)
def delete_response(response_id: int, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    resp = _get_response(db, response_id)
    if not can_manage_form(resp.form, user):
        raise HTTPException(403, "Only the form owner or an admin can delete responses")
    log_activity(db, user, "response.deleted", "response", resp.id, {"form_title": resp.form.title},
                 form_id=resp.form_id, request=request)
    db.delete(resp)
    db.commit()


@router.get("/responses/{response_id}/history", response_model=list[LogOut])
def response_history(response_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Audit trail (creation + every edit with old/new values) for one response."""
    resp = _get_response(db, response_id)
    if not can_view_response(resp, resp.form, user):
        raise HTTPException(403, "You cannot view this response")
    return db.scalars(
        select(ActivityLog)
        .where(ActivityLog.entity_type == "response", ActivityLog.entity_id == response_id)
        .order_by(ActivityLog.id.desc())
    ).all()
