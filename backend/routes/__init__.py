from fastapi import APIRouter

from routes.ai import router as ai_router
from routes.auth import router as auth_router
from routes.automations import router as automations_router
from routes.documents import router as documents_router
from routes.gym import router as gym_router
from routes.health import router as health_router
from routes.integrations import router as integrations_router
from routes.meta import router as meta_router
from routes.tasks import router as tasks_router
from routes.users import router as users_router

api_router = APIRouter(prefix="/api")
api_router.include_router(meta_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(tasks_router)
api_router.include_router(health_router)
api_router.include_router(gym_router)
api_router.include_router(ai_router)
api_router.include_router(documents_router)
api_router.include_router(automations_router)
api_router.include_router(integrations_router)
