from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = (
        "postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor"
    )
    REDIS_URL: str = "redis://localhost:6379"
    CLAUDE_API_KEY: str = ""
    SECRET_KEY: str = "dev-secret-change-me"
    DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    ZEBRA_PRINTER_IP: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]

    def validate_secret_key(self) -> None:
        if not self.DEBUG and self.SECRET_KEY == "dev-secret-change-me":
            raise RuntimeError(
                "SECRET_KEY uses the insecure default while DEBUG=false. "
                "Set SECRET_KEY to a strong, unique value before starting the service."
            )


settings = Settings()
