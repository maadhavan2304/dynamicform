import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from .config import settings
from .database import SessionLocal
from .routers import analytics, auth, exports, files, forms, logs, responses, users
from .seed import seed

log = logging.getLogger("formbuilder")

DESCRIPTION = """
Dynamic Form Builder & Response Management API.

**Authenticate:** `POST /api/auth/login` (email as `username`) -> click **Authorize** and paste the token.
Default admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        with SessionLocal() as db:
            seed(db)
    except SQLAlchemyError as e:
        log.warning("Could not seed roles/admin (did you run `alembic upgrade head`?): %s", e)
    yield


app = FastAPI(title="Dynamic Form Builder API", version="1.0.0", description=DESCRIPTION, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth.router, users.router, forms.router, responses.router, analytics.router, logs.router,
          files.router, exports.router):
    app.include_router(r, prefix="/api")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
