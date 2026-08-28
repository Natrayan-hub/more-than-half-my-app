from datetime import datetime
from typing import Literal, Optional

from models.base import SyncableModel


class GymSet(SyncableModel):
    """Manual strength-training log — one row per set (exercise name +
    weight + reps). 🔴 exercise_name/weight/reps/note are sensitive
    (fitness data), same handling as HealthEntry."""
    exercise_name: str
    weight: float
    weight_unit: Literal["kg", "lb"] = "kg"
    reps: int
    logged_at: datetime
    note: Optional[str] = None
