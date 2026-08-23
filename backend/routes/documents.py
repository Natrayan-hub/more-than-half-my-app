"""Documents & Photo Backup (IA S18 + S22, condensed into one screen) —
real CRUD on the existing Document model (base64 content, no separate
object-storage layer yet). Storage quota/backup timestamp are illustrative
(a fixed plan quota blended with the REAL sum of stored bytes) since there's
no real billing/object-storage pipeline in this MVP."""
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db as database
from models import Document, utcnow
from routes.deps import get_current_user_id

router = APIRouter(prefix="/documents", tags=["documents"])

MOCK_BASELINE_BYTES = 1_800_000_000  # ~1.8GB illustrative starting usage
QUOTA_BYTES = 5_000_000_000  # 5GB plan quota (mock — no billing yet)


class DocumentListResponse(BaseModel):
    items: List[Document]


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    kind: Optional[Literal["document", "photo"]] = None,
    category: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    query: dict = {"user_id": user_id, "deleted_at": None}
    if kind:
        query["kind"] = kind
    if category:
        query["category"] = category
    docs = await database.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": [Document(**d) for d in docs]}


class DocumentCreate(BaseModel):
    title: str
    category: str = "other"
    kind: Literal["document", "photo"] = "document"
    content_base64: Optional[str] = None
    thumb_base64: Optional[str] = None
    size_bytes: int = 0
    tags: List[str] = []


@router.post("", response_model=Document, status_code=201)
async def create_document(body: DocumentCreate, user_id: str = Depends(get_current_user_id)):
    pref = await database.preferences.find_one({"id": user_id}, {"_id": 0, "data_controls": 1})
    domain = "photos" if body.kind == "photo" else "documents"
    policy_value = (pref or {}).get("data_controls", {}).get(domain, "cloud")
    storage_policy = "local_only" if policy_value in ("local", "off") else "cloud"

    doc = Document(
        user_id=user_id,
        title=body.title,
        category=body.category,
        kind=body.kind,
        tags=body.tags,
        content_base64=body.content_base64,
        thumb_base64=body.thumb_base64 or body.content_base64,
        size_bytes=body.size_bytes,
        storage_policy=storage_policy,
    )
    await database.documents.insert_one(doc.model_dump())
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    result = await database.documents.update_one(
        {"id": doc_id, "user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": utcnow(), "updated_at": utcnow()}, "$inc": {"version": 1}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="DOCUMENT_NOT_FOUND")


class StorageSummary(BaseModel):
    used_bytes: int
    quota_bytes: int
    last_backup_at: Optional[datetime] = None
    backup_frequency: str = "manual"


@router.get("/storage/summary", response_model=StorageSummary)
async def storage_summary(user_id: str = Depends(get_current_user_id)):
    docs = await database.documents.find(
        {"user_id": user_id, "deleted_at": None}, {"_id": 0, "size_bytes": 1},
    ).to_list(1000)
    real_bytes = sum(d.get("size_bytes", 0) for d in docs)
    pref = await database.preferences.find_one({"id": user_id}, {"_id": 0, "backup_prefs": 1})
    backup_prefs = (pref or {}).get("backup_prefs") or {}
    return {
        "used_bytes": MOCK_BASELINE_BYTES + real_bytes,
        "quota_bytes": QUOTA_BYTES,
        "last_backup_at": backup_prefs.get("last_backup_at"),
        "backup_frequency": backup_prefs.get("frequency", "manual"),
    }


@router.post("/backup", response_model=StorageSummary)
async def backup_now(user_id: str = Depends(get_current_user_id)):
    """No real backup pipeline yet — records a real timestamp so the UI's
    'last backup' state is genuine rather than a static mock string."""
    now = utcnow()
    await database.preferences.update_one(
        {"id": user_id}, {"$set": {"backup_prefs.last_backup_at": now}},
    )
    return await storage_summary(user_id)
