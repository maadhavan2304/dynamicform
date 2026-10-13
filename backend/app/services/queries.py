from datetime import date, datetime, time, timedelta

from sqlalchemy import exists, select

from ..models import FormResponse, ResponseDetail


def _like(s: str) -> str:
    return "%" + s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def response_query(
    form_id: int,
    q: str | None = None,
    field_id: int | None = None,
    value: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    stmt = select(FormResponse).where(FormResponse.form_id == form_id)
    if q:
        stmt = stmt.where(
            exists().where(ResponseDetail.response_id == FormResponse.id, ResponseDetail.value.ilike(_like(q)))
        )
    if field_id and value:
        stmt = stmt.where(
            exists().where(
                ResponseDetail.response_id == FormResponse.id,
                ResponseDetail.field_id == field_id,
                ResponseDetail.value.ilike(_like(value)),
            )
        )
    if date_from:
        stmt = stmt.where(FormResponse.submitted_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(FormResponse.submitted_at < datetime.combine(date_to + timedelta(days=1), time.min))
    return stmt
