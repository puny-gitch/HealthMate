from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    app_name: str = "HealthMate Backend"
    api_prefix: str = "/api"

    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 1440
    jwt_algorithm: str = "HS256"

    ai_mode: str = "mock"
    llm_api_base: str | None = None
    llm_api_key: str | None = None
    llm_model: str = "deepseek-chat"
    llm_timeout_seconds: float = 5.0
    knowledge_enabled: bool = True
    knowledge_dir: str = "app/data/knowledge"
    knowledge_top_k: int = 3
    knowledge_embedding_model: str = "BAAI/bge-small-zh-v1.5"
    redis_url: str | None = None
    cache_ttl_seconds: int = 604800

    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "healthmate"

    @property
    def db_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}@"
            f"{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
