from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://ifvm:ifvm_secret@localhost:5432/ifvm_db"
    JWT_SECRET: str = "change_me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_EXPIRE_DAYS: int = 14
    ROOT_PATH: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
