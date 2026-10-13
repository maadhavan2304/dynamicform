from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal
from .models import Role, User
from .security import hash_password


def seed(db: Session) -> None:
    for name in ("Admin", "User"):
        if not db.scalar(select(Role).where(Role.name == name)):
            db.add(Role(name=name))
    db.flush()
    if not db.scalar(select(User).where(User.email == settings.ADMIN_EMAIL.lower())):
        admin_role = db.scalar(select(Role).where(Role.name == "Admin"))
        db.add(User(name=settings.ADMIN_NAME, email=settings.ADMIN_EMAIL.lower(),
                    password_hash=hash_password(settings.ADMIN_PASSWORD), role_id=admin_role.id))
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as s:
        seed(s)
    print("Seeded roles and default admin.")
