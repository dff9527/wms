from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor"
    REDIS_URL: str = "redis://localhost:6379"
    CLAUDE_API_KEY: str = ""
    SECRET_KEY: str = "dev-secret-change-me"
    ZEBRA_PRINTER_IP: str = ""


settings = Settings()
