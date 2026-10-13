import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, get_optional_user
from ..models import FormResponse, ResponseDetail, User
from ..schemas import UploadOut
from ..services.files import ALLOWED_EXT, upload_dir, upload_path
from ..services.permissions import can_view_response

router = APIRouter(tags=["Files"])


@router.post("/uploads", response_model=UploadOut, status_code=201, tags=["Public"])
async def upload_file(file: UploadFile = File(...), user: User | None = Depends(get_optional_user)):
    """Upload an attachment for a File Upload field. Returns an id to send in the submission."""
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"File type '.{ext}' is not allowed")
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File is larger than {settings.MAX_UPLOAD_MB} MB")
    stored = f"{uuid.uuid4().hex}.{ext}"
    (upload_dir() / stored).write_bytes(data)
    return UploadOut(id=stored, name=file.filename or stored, size=len(data))


@router.get("/files/{file_id}")
def download_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    path = upload_path(file_id)
    if not path or not path.exists():
        raise HTTPException(404, "File not found")
    if not user.is_admin:
        # only people who can see a response that contains this file may download it
        rows = db.scalars(select(ResponseDetail).where(ResponseDetail.value.like(f"%{file_id}%"))).all()
        if not any(can_view_response(d.response, d.response.form, user) for d in rows):
            raise HTTPException(403, "You cannot access this file")
    return FileResponse(path)
