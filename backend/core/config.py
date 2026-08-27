"""Environment configuration for the Nannu backend.

Reads from backend/.env (loaded once here). Protected vars (MONGO_URL, DB_NAME)
are never modified in code. ENV defaults to "dev" so local/preview work with
zero extra configuration; production sets ENV=prod at deploy time.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    ENV: str = os.environ.get("ENV", "dev")
    MONGO_URL: str = os.environ["MONGO_URL"]
    DB_NAME: str = os.environ["DB_NAME"]
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    API_VERSION: str = "v1"
    APP_NAME: str = "Nannu API"

    @property
    def is_prod(self) -> bool:
        return self.ENV == "prod"


settings = Settings()
