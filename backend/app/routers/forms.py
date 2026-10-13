from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_optional_user
from ..models import FieldOption, Form, FormField, FormResponse, User
from ..schemas import FormIn, FormOut, FormSummary, StatusIn
from ..services.activity import log_activity
from ..services.permissions import ensure_manage

router = APIRouter(tags=["Forms"])


def get_form(db: Session, form_id: int) -> Form:
    form = db.get(Form, form_id)
    if not form:
        raise HTTPException(404, "Form not found")
    return form


def _sync_fields(form: Form, incoming) -> None:
    """Upsert fields by field_key so existing response data stays attached; order = list order."""
    existing = {f.field_key: f for f in form.fields}
    keys = set()
    for pos, fi in enumerate(incoming):
        keys.add(fi.field_key)
        f = existing.get(fi.field_key)
        if f is None:
            f = FormField(field_key=fi.field_key)
            form.fields.append(f)
        f.label, f.field_type, f.is_required = fi.label.strip(), fi.field_type, fi.is_required
        f.placeholder, f.validation, f.position = fi.placeholder, fi.validation or None, pos
        f.condition = fi.condition.model_dump() if fi.condition else None
        f.options = [FieldOption(label=o.label, value=o.value, position=i) for i, o in enumerate(fi.options)]
    for key, f in existing.items():
        if key not in keys:
            form.fields.remove(f)


def _counts(db: Session) -> dict[int, int]:
    return dict(db.execute(select(FormResponse.form_id, func.count()).group_by(FormResponse.form_id)).all())


def _summaries(forms: list[Form], counts: dict[int, int]) -> list[FormSummary]:
    out = []
    for f in forms:
        s = FormSummary.model_validate(f)
        s.response_count = counts.get(f.id, 0)
        out.append(s)
    return out


@router.get("/forms", response_model=list[FormSummary])
def list_forms(
    search: str | None = None,
    status: Literal["active", "disabled"] | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admins see every form, users see the forms they own."""
    stmt = select(Form).order_by(Form.updated_at.desc())
    if not user.is_admin:
        stmt = stmt.where(Form.owner_id == user.id)
    if search:
        stmt = stmt.where(Form.title.ilike(f"%{search}%"))
    if status:
        stmt = stmt.where(Form.is_active == (status == "active"))
    return _summaries(list(db.scalars(stmt).all()), _counts(db))


@router.get("/forms/available", response_model=list[FormSummary])
def available_forms(db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    """Active forms the caller can fill in (public forms, plus all active forms when logged in)."""
    stmt = select(Form).where(Form.is_active.is_(True)).order_by(Form.title)
    if not user:
        stmt = stmt.where(Form.is_public.is_(True))
    return _summaries(list(db.scalars(stmt).all()), {})


@router.post("/forms", response_model=FormOut, status_code=201)
def create_form(payload: FormIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form = Form(title=payload.title.strip(), description=payload.description, is_active=payload.is_active,
                is_public=payload.is_public, allow_response_edit=payload.allow_response_edit, owner_id=user.id)
    db.add(form)
    _sync_fields(form, payload.fields)
    db.flush()
    log_activity(db, user, "form.created", "form", form.id, {"title": form.title}, form_id=form.id, request=request)
    db.commit()
    return form


@router.get("/forms/{form_id}", response_model=FormOut)
def read_form(form_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form = get_form(db, form_id)
    ensure_manage(form, user)
    return form


@router.put("/forms/{form_id}", response_model=FormOut)
def update_form(form_id: int, payload: FormIn, request: Request, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    form = get_form(db, form_id)
    ensure_manage(form, user)
    form.title, form.description = payload.title.strip(), payload.description
    form.is_active, form.is_public = payload.is_active, payload.is_public
    form.allow_response_edit = payload.allow_response_edit
    _sync_fields(form, payload.fields)
    log_activity(db, user, "form.updated", "form", form.id, {"title": form.title, "fields": len(payload.fields)},
                 form_id=form.id, request=request)
    db.commit()
    return form


@router.patch("/forms/{form_id}/status", response_model=FormSummary)
def set_status(form_id: int, payload: StatusIn, request: Request, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """Enable / disable a form. Disabled forms reject new submissions."""
    form = get_form(db, form_id)
    ensure_manage(form, user)
    form.is_active = payload.is_active
    log_activity(db, user, "form.enabled" if form.is_active else "form.disabled", "form", form.id,
                 {"title": form.title}, form_id=form.id, request=request)
    db.commit()
    s = FormSummary.model_validate(form)
    s.response_count = _counts(db).get(form.id, 0)
    return s


@router.delete("/forms/{form_id}", status_code=204)
def delete_form(form_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form = get_form(db, form_id)
    ensure_manage(form, user)
    log_activity(db, user, "form.deleted", "form", form.id, {"title": form.title}, form_id=form.id, request=request)
    db.delete(form)
    db.commit()


@router.get("/public/forms/{form_id}", response_model=FormOut, tags=["Public"])
def public_form(form_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    """Schema used by the fill-in page. Public forms need no login; others require authentication."""
    form = get_form(db, form_id)
    if not form.is_active:
        raise HTTPException(403, "This form is currently disabled")
    if not form.is_public and not user:
        raise HTTPException(401, "Please log in to fill in this form", headers={"WWW-Authenticate": "Bearer"})
    return form
