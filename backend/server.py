"""LifeOS API entrypoint.

Structure:
  core/    — config + Mongo connection (+ index bootstrap)
  models/  — Pydantic entities (Technical Foundation Part A)
  routes/  — API routers grouped per API design Part B (all under /api)

Run by supervisor as `uvicorn server:app --host 0.0.0.0 --port 8001`.
"""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from core import db as database
from core.config import settings
from core.security import ensure_session_indexes
from core.storage import init_storage
from routes import api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("lifeos")

app = FastAPI(title=settings.APP_NAME, version=settings.API_VERSION)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Uniform error envelope (API design B.0): {error: {code, message, retryable}}."""
    detail = exc.detail if isinstance(exc.detail, str) else "INTERNAL"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": detail,
                "message": detail.replace("_", " ").capitalize(),
                "retryable": exc.status_code >= 500 or exc.status_code == 429,
            }
        },
    )


@app.on_event("startup")
async def on_startup():
    await database.ensure_indexes()
    await ensure_session_indexes()
    try:
        init_storage()
    except Exception:
        logger.exception("Object storage init failed — avatar upload/download will error until this recovers")
    logger.info("LifeOS API started (env=%s)", settings.ENV)


@app.on_event("shutdown")
async def on_shutdown():
    await database.close()
