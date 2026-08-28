"""Mongo connection (Motor, async). Single client shared across the app.

Collections follow the entity names from the Technical Foundation Part A.
Indexes for the per-user query patterns are ensured at startup.
"""
from motor.motor_asyncio import AsyncIOMotorClient

from core.config import settings

client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

# Collection handles (single source of truth for names)
users = db.users
profiles = db.profiles
devices = db.devices
projects = db.projects
tasks = db.tasks
health_entries = db.health_entries
health_cache = db.health_cache  # only populated on explicit user opt-in (S34)
gym_sets = db.gym_sets
documents = db.documents
document_pages = db.document_pages
integrations = db.integrations
integration_tokens = db.integration_tokens  # server-only, never serialized to clients
ai_memory = db.ai_memory
suggestions = db.suggestions
notifications = db.notifications
preferences = db.preferences
automations = db.automations
sync_oplog = db.sync_oplog
audit_log = db.audit_log
jobs = db.jobs  # ExportJob / DeletionJob


async def ensure_indexes() -> None:
    """Idempotent index creation for per-user query patterns."""
    await users.create_index("email", unique=True)
    await tasks.create_index([("user_id", 1), ("bucket", 1), ("completed_at", 1)])
    await tasks.create_index([("user_id", 1), ("due_at", 1)])
    await tasks.create_index([("user_id", 1), ("project_id", 1)])
    await health_entries.create_index([("user_id", 1), ("type", 1), ("logged_at", -1)])
    await gym_sets.create_index([("user_id", 1), ("logged_at", -1)])
    await documents.create_index([("user_id", 1), ("category", 1)])
    await documents.create_index([("user_id", 1), ("kind", 1), ("created_at", -1)])
    await notifications.create_index([("user_id", 1), ("created_at", -1)])
    await sync_oplog.create_index([("user_id", 1), ("server_seq", 1)])
    await audit_log.create_index([("user_id", 1), ("created_at", -1)])
    await suggestions.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
    await automations.create_index([("user_id", 1), ("deleted_at", 1)])
    await integrations.create_index([("user_id", 1), ("provider", 1)], unique=True)


async def close() -> None:
    client.close()
