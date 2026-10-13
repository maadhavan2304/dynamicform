from fastapi import HTTPException

from ..models import Form, FormResponse, User


def can_manage_form(form: Form, user: User | None) -> bool:
    return bool(user) and (user.is_admin or form.owner_id == user.id)


def ensure_manage(form: Form, user: User | None) -> None:
    if not can_manage_form(form, user):
        raise HTTPException(403, "You do not have permission to manage this form")


def can_view_response(resp: FormResponse, form: Form, user: User | None) -> bool:
    return bool(user) and (can_manage_form(form, user) or resp.user_id == user.id)


def can_edit_response(resp: FormResponse, form: Form, user: User | None) -> bool:
    if not user:
        return False
    if can_manage_form(form, user):
        return True
    return resp.user_id == user.id and form.allow_response_edit and form.is_active
