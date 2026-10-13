from celery import Celery

from .config import settings

celery_app = Celery("formbuilder", broker=settings.REDIS_URL, backend=settings.REDIS_URL, include=["app.tasks"])
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    beat_schedule={"cleanup-exports": {"task": "app.tasks.cleanup_exports", "schedule": 3600.0}},
)
