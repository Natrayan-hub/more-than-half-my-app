"""LifeOS backend end-to-end API tests (auth, users, ai memory, tasks, health)."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://app-runner-129.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---- shared fixtures ----
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _unique_email():
    return f"pytest+{uuid.uuid4().hex[:10]}@lifeos.app"


@pytest.fixture(scope="session")
def fresh_user(api):
    """Register a fresh account; return tokens + user + email/password."""
    email = _unique_email()
    password = "LifeOS!2026demo"
    r = api.post(f"{API}/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    data = r.json()
    return {"email": email, "password": password, **data}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- meta ----------
class TestMeta:
    def test_health(self, api):
        r = api.get(f"{API}/health")
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "ok"
        assert j["db"] == "ok"


# ---------- auth ----------
class TestAuth:
    def test_register_returns_pair_and_user(self, fresh_user):
        assert fresh_user["access_token"]
        assert fresh_user["refresh_token"]
        assert fresh_user["token_type"] == "bearer"
        user = fresh_user["user"]
        assert user["email"] == fresh_user["email"]
        assert user["id"]
        # password_hash must NOT leak
        assert "password_hash" not in user

    def test_register_seeds_three_starter_tasks(self, api, fresh_user):
        r = api.get(f"{API}/tasks", headers=_auth(fresh_user["access_token"]))
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 3, f"expected 3 starter tasks, got {len(items)}"

    def test_register_duplicate_returns_409_email_taken(self, api, fresh_user):
        r = api.post(f"{API}/auth/register", json={
            "email": fresh_user["email"], "password": "LifeOS!2026demo",
        })
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "EMAIL_TAKEN"

    def test_login_success_returns_pair(self, api, fresh_user):
        r = api.post(f"{API}/auth/login", json={
            "email": fresh_user["email"], "password": fresh_user["password"],
        })
        assert r.status_code == 200
        j = r.json()
        assert j["access_token"] and j["refresh_token"]
        assert j["user"]["email"] == fresh_user["email"]

    def test_login_wrong_password_generic_401(self, api, fresh_user):
        r = api.post(f"{API}/auth/login", json={
            "email": fresh_user["email"], "password": "WrongPassword!99",
        })
        assert r.status_code == 401
        # Generic — no enumeration leak
        assert r.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"

    def test_login_unknown_email_generic_401(self, api):
        r = api.post(f"{API}/auth/login", json={
            "email": f"noone+{uuid.uuid4().hex[:6]}@lifeos.app",
            "password": "AnyPassword!1",
        })
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"

    def test_refresh_rotates_and_old_token_reuse_is_detected(self, api):
        # Fresh user for this specific test — refresh consumes tokens.
        email, password = _unique_email(), "LifeOS!2026demo"
        r = api.post(f"{API}/auth/register", json={"email": email, "password": password})
        assert r.status_code == 201
        first_refresh = r.json()["refresh_token"]

        r2 = api.post(f"{API}/auth/refresh", json={"refresh_token": first_refresh})
        assert r2.status_code == 200
        second = r2.json()
        assert second["access_token"] and second["refresh_token"]
        assert second["refresh_token"] != first_refresh, "refresh must rotate"

        # Replay the old (already-consumed) refresh token → TOKEN_REUSE
        r3 = api.post(f"{API}/auth/refresh", json={"refresh_token": first_refresh})
        assert r3.status_code == 401
        assert r3.json()["error"]["code"] == "TOKEN_REUSE"

        # Family should be revoked → new token also invalidated
        r4 = api.post(f"{API}/auth/refresh", json={"refresh_token": second["refresh_token"]})
        assert r4.status_code == 401

    def test_logout_idempotent_and_refresh_fails_after(self, api):
        email, password = _unique_email(), "LifeOS!2026demo"
        r = api.post(f"{API}/auth/register", json={"email": email, "password": password})
        refresh = r.json()["refresh_token"]

        r1 = api.post(f"{API}/auth/logout", json={"refresh_token": refresh})
        assert r1.status_code == 204

        # Idempotent
        r2 = api.post(f"{API}/auth/logout", json={"refresh_token": refresh})
        assert r2.status_code == 204

        # Refresh after logout → 401
        r3 = api.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
        assert r3.status_code == 401


# ---------- protected data routes ----------
class TestAuthGuards:
    def test_tasks_requires_bearer(self, api):
        r = api.get(f"{API}/tasks")
        assert r.status_code == 401
        assert r.json()["error"]["code"] in ("TOKEN_INVALID", "TOKEN_EXPIRED")

    def test_health_entries_requires_bearer(self, api):
        r = api.get(f"{API}/health/entries")
        assert r.status_code == 401

    def test_tasks_bad_bearer(self, api):
        r = api.get(f"{API}/tasks", headers=_auth("garbage.token.value"))
        assert r.status_code == 401


# ---------- /me + profile + preferences ----------
class TestMe:
    def test_me_returns_user_and_profile_no_hash(self, api, fresh_user):
        r = api.get(f"{API}/me", headers=_auth(fresh_user["access_token"]))
        assert r.status_code == 200
        j = r.json()
        assert "password_hash" not in j["user"]
        assert j["user"]["email"] == fresh_user["email"]
        assert j["profile"]["user_id"] == fresh_user["user"]["id"]
        assert j["profile"]["display_name"]

    def test_patch_profile(self, api, fresh_user):
        h = _auth(fresh_user["access_token"])
        patch = {
            "display_name": "Ada Lovelace",
            "wake_time": "05:45",
            "focus_areas": ["fitness", "tasks"],
            "ai_enabled": True,
        }
        r = api.patch(f"{API}/me/profile", json=patch, headers=h)
        assert r.status_code == 200
        prof = r.json()
        assert prof["display_name"] == "Ada Lovelace"
        assert prof["wake_time"] == "05:45"
        assert prof["focus_areas"] == ["fitness", "tasks"]
        assert prof["ai_enabled"] is True

        # Verify persisted via /me
        r2 = api.get(f"{API}/me", headers=h)
        assert r2.status_code == 200
        assert r2.json()["profile"]["display_name"] == "Ada Lovelace"

    def test_preferences_get_and_put_data_controls_roundtrip(self, api, fresh_user):
        h = _auth(fresh_user["access_token"])
        r = api.get(f"{API}/me/preferences", headers=h)
        assert r.status_code == 200
        pref = r.json()
        assert pref["data_controls"]["health_cache"] == "local"  # default

        pref["data_controls"] = {
            "tasks": "cloud",
            "documents": "local",
            "health_cache": "cloud",
            "ai_memory": "off",
            "photos": "off",
        }
        r2 = api.put(f"{API}/me/preferences", json=pref, headers=h)
        assert r2.status_code == 200
        assert r2.json()["data_controls"]["documents"] == "local"
        assert r2.json()["data_controls"]["ai_memory"] == "off"

        # Persisted?
        r3 = api.get(f"{API}/me/preferences", headers=h)
        assert r3.status_code == 200
        assert r3.json()["data_controls"]["documents"] == "local"
        assert r3.json()["data_controls"]["ai_memory"] == "off"


# ---------- AI memory ----------
class TestAIMemory:
    def test_create_and_list(self, api, fresh_user):
        h = _auth(fresh_user["access_token"])
        body = {
            "domain": "preference",
            "statement": "prefers morning workouts",
            "structured": {"key": "workout_time", "value": "morning"},
        }
        r = api.post(f"{API}/ai/memory", json=body, headers=h)
        assert r.status_code == 201
        entry = r.json()
        assert entry["user_id"] == fresh_user["user"]["id"]
        assert entry["statement"] == body["statement"]

        r2 = api.get(f"{API}/ai/memory", headers=h)
        assert r2.status_code == 200
        keys = [e.get("structured", {}).get("key") for e in r2.json()["items"]]
        assert "workout_time" in keys

    def test_idempotent_per_structured_key(self, api, fresh_user):
        h = _auth(fresh_user["access_token"])
        body = {
            "domain": "preference",
            "statement": "prefers evening workouts",
            "structured": {"key": "workout_time", "value": "evening"},
        }
        r = api.post(f"{API}/ai/memory", json=body, headers=h)
        assert r.status_code == 201

        r2 = api.get(f"{API}/ai/memory", headers=h)
        entries = [e for e in r2.json()["items"] if e.get("structured", {}).get("key") == "workout_time"]
        assert len(entries) == 1, f"expected idempotent replace, got {len(entries)}"
        assert entries[0]["structured"]["value"] == "evening"


# ---------- tasks scoping ----------
class TestTasksScoping:
    def test_tasks_are_scoped_per_user(self, api, fresh_user):
        # Second user shouldn't see first user's tasks
        email, password = _unique_email(), "LifeOS!2026demo"
        r = api.post(f"{API}/auth/register", json={"email": email, "password": password})
        assert r.status_code == 201
        other_token = r.json()["access_token"]

        r1 = api.get(f"{API}/tasks", headers=_auth(fresh_user["access_token"]))
        r2 = api.get(f"{API}/tasks", headers=_auth(other_token))
        ids1 = {t["id"] for t in r1.json()["items"]}
        ids2 = {t["id"] for t in r2.json()["items"]}
        assert ids1.isdisjoint(ids2)

    def test_complete_and_reopen_task(self, api, fresh_user):
        h = _auth(fresh_user["access_token"])
        r = api.get(f"{API}/tasks", headers=h)
        task_id = r.json()["items"][0]["id"]

        r1 = api.post(f"{API}/tasks/{task_id}/complete", headers=h)
        assert r1.status_code == 200
        assert r1.json()["completed_at"] is not None

        r2 = api.post(f"{API}/tasks/{task_id}/reopen", headers=h)
        assert r2.status_code == 200
        assert r2.json()["completed_at"] is None


# ---------- health entries ----------
class TestHealthEntries:
    def test_create_water_entry(self, api, fresh_user):
        h = _auth(fresh_user["access_token"])
        r = api.post(
            f"{API}/health/entries",
            json={"type": "water", "value": 250.0},
            headers=h,
        )
        assert r.status_code == 201
        entry = r.json()
        assert entry["type"] == "water"
        assert entry["value"] == 250.0

        r2 = api.get(f"{API}/health/entries?type=water", headers=h)
        assert r2.status_code == 200
        assert any(e["id"] == entry["id"] for e in r2.json()["items"])
