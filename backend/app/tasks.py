import time
import uuid
from datetime import date

from .celery_app import celery_app
from .database import SessionLocal
from .models import Form, FormResponse
from .services.export import EXPORTERS
from .services.files import export_dir
from .services.queries import response_query


@celery_app.task(name="app.tasks.generate_export")
def generate_export(form_id: int, fmt: str, filters: dict | None = None) -> dict:
    """Build an Excel/PDF export in the background and store it in EXPORT_DIR."""
    filters = filters or {}
    with SessionLocal() as db:
        form = db.get(Form, form_id)
        if not form:
            raise ValueError("Form not found")
        stmt = response_query(
            form_id,
            q=filters.get("q"),
            field_id=filters.get("field_id"),
            value=filters.get("value"),
            date_from=date.fromisoformat(filters["date_from"]) if filters.get("date_from") else None,
            date_to=date.fromisoformat(filters["date_to"]) if filters.get("date_to") else None,
        )
        responses = list(db.scalars(stmt.order_by(FormResponse.id)).all())
        builder, _ = EXPORTERS[fmt]
        data = builder(form, responses)
        name = f"{uuid.uuid4().hex}.{fmt}"
        (export_dir() / name).write_bytes(data)
        return {"filename": name, "form_id": form_id, "rows": len(responses), "title": form.title}


@celery_app.task(name="app.tasks.cleanup_exports")
def cleanup_exports(max_age_seconds: int = 24 * 3600) -> int:
    removed = 0
    for p in export_dir().iterdir():
        if p.is_file() and time.time() - p.stat().st_mtime > max_age_seconds:
            p.unlink(missing_ok=True)
            removed += 1
    return removed
