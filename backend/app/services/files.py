import re
from pathlib import Path

from ..config import settings

FILE_ID_RE = re.compile(r"^[0-9a-f]{32}\.[a-z0-9]{1,8}$")
EXPORT_RE = re.compile(r"^[0-9a-f]{32}\.(xlsx|pdf)$")
ALLOWED_EXT = {"pdf", "png", "jpg", "jpeg", "gif", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt", "zip"}


def upload_dir() -> Path:
    p = Path(settings.UPLOAD_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def export_dir() -> Path:
    p = Path(settings.EXPORT_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def upload_path(file_id: str) -> Path | None:
    if not FILE_ID_RE.match(file_id):
        return None
    return upload_dir() / file_id
