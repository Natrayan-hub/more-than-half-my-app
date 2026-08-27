"""Nannu entity models (Pydantic), mirroring the Technical Foundation Part A.

Import from this package: `from models import Task, Document, ...`
"""
from models.base import SyncableModel, utcnow
from models.user import User, Profile, Device
from models.task import Project, Task
from models.health import HealthEntry, HealthCacheSample
from models.document import Document, DocumentPage
from models.integration import Integration, IntegrationToken
from models.ai import AIMemoryEntry, Suggestion
from models.notification import NotificationItem
from models.preference import Preference, DataControls, DisplayPrefs, BackupPrefs
from models.automation import Automation, AutomationTrigger, AutomationAction
from models.system import SyncOp, AuditLogEntry, Job

__all__ = [
    "SyncableModel", "utcnow",
    "User", "Profile", "Device",
    "Project", "Task",
    "HealthEntry", "HealthCacheSample",
    "Document", "DocumentPage",
    "Integration", "IntegrationToken",
    "AIMemoryEntry", "Suggestion",
    "NotificationItem",
    "Preference", "DataControls", "DisplayPrefs", "BackupPrefs",
    "Automation", "AutomationTrigger", "AutomationAction",
    "SyncOp", "AuditLogEntry", "Job",
]
