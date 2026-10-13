from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "mysql+pymysql://formuser:formpass@localhost:3306/formbuilder"
    SECRET_KEY: str = "dev-secret-change-me-please-use-a-long-random-value"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: str = "http://localhost:5173"
    REDIS_URL: str = "redis://localhost:6379/0"
    UPLOAD_DIR: str = "storage/uploads"
    EXPORT_DIR: str = "storage/exports"
    MAX_UPLOAD_MB: int = 10
    ADMIN_NAME: str = "Administrator"
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "Admin@12345"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
