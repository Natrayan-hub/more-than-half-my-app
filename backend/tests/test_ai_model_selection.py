"""Backend tests for the new AI Model selector feature:
- Preference.ai_prefs.model GET/PUT round-trip (backs /more/ai-model.tsx)
- End-to-end suggestion generation through each of the 4 catalog models
  (gpt-5.4 via OpenAI, claude-sonnet-5 / claude-sonnet-4-6 / claude-haiku-4-5
  via Anthropic) through emergentintegrations + EMERGENT_LLM_KEY.
Uses a fresh isolated user per module, seeds an overdue task + water entry
so the suggestion engine has context to reason about.
"""
import os
import time
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

MODEL_KEYS = ["gpt-5.4", "claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-4-5"]


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _unique_email():
    return f"pytest+aimodel+{uuid.uuid4().hex[:10]}@lifeos.app"


@pytest.fixture(scope="module")
def auth_header(api):
    email, password = _unique_email(), "LifeOS!2026demo"
    r = api.post(f"{API}/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Enable AI (default False) so /ai/* routes don't 403.
    r_profile = api.patch(f"{API}/me/profile", json={"ai_enabled": True}, headers=headers)
    assert r_profile.status_code == 200, r_profile.text
    assert r_profile.json()["ai_enabled"] is True

    # Seed an overdue task so the suggestion engine has something to reason about.
    overdue_due = (datetime.utcnow() - timedelta(days=1)).isoformat()
    r_task = api.post(
        f"{API}/tasks",
        json={"title": "TEST_Overdue task for AI suggestion", "due_at": overdue_due, "bucket": "today"},
        headers=headers,
    )
    assert r_task.status_code == 201, r_task.text

    # Raise suggestions_per_day cap so multiple models can each generate
    # a fresh suggestion within this test module without hitting the cap.
    r_pref = api.get(f"{API}/me/preferences", headers=headers)
    pref = r_pref.json()
    pref["notif_prefs"]["suggestions_per_day"] = 20
    r_pref2 = api.put(f"{API}/me/preferences", json=pref, headers=headers)
    assert r_pref2.status_code == 200

    return headers


class TestAiPrefsPersistence:
    """GET/PUT /api/me/preferences ai_prefs.model round-trip."""

    def test_default_model_is_gpt(self, api, auth_header):
        r = api.get(f"{API}/me/preferences", headers=auth_header)
        assert r.status_code == 200
        pref = r.json()
        assert pref["ai_prefs"]["model"] == "gpt-5.4"

    @pytest.mark.parametrize("model_key", MODEL_KEYS)
    def test_put_then_get_persists_each_model(self, api, auth_header, model_key):
        r = api.get(f"{API}/me/preferences", headers=auth_header)
        pref = r.json()
        pref["ai_prefs"] = {"model": model_key}
        r2 = api.put(f"{API}/me/preferences", json=pref, headers=auth_header)
        assert r2.status_code == 200, r2.text
        assert r2.json()["ai_prefs"]["model"] == model_key

        r3 = api.get(f"{API}/me/preferences", headers=auth_header)
        assert r3.status_code == 200
        assert r3.json()["ai_prefs"]["model"] == model_key

    def test_unknown_model_key_accepted_by_schema(self, api, auth_header):
        """AiPrefs.model is a plain str (not Literal) so legacy/unknown keys
        must not be rejected — resolve_model() falls back at call time."""
        r = api.get(f"{API}/me/preferences", headers=auth_header)
        pref = r.json()
        pref["ai_prefs"] = {"model": "some-legacy-key"}
        r2 = api.put(f"{API}/me/preferences", json=pref, headers=auth_header)
        assert r2.status_code == 200
        assert r2.json()["ai_prefs"]["model"] == "some-legacy-key"
        # restore default for subsequent tests
        pref["ai_prefs"] = {"model": "gpt-5.4"}
        api.put(f"{API}/me/preferences", json=pref, headers=auth_header)


def _set_model(api, auth_header, model_key):
    r = api.get(f"{API}/me/preferences", headers=auth_header)
    pref = r.json()
    pref["ai_prefs"] = {"model": model_key}
    r2 = api.put(f"{API}/me/preferences", json=pref, headers=auth_header)
    assert r2.status_code == 200


def _clear_pending(api, auth_header):
    """Dismiss any pending suggestion so the next GET generates a fresh one
    with the currently-selected model (route only generates when none pending)."""
    r = api.get(f"{API}/ai/suggestions", params={"status": "pending"}, headers=auth_header)
    for item in r.json().get("items", []):
        api.post(f"{API}/ai/suggestions/{item['id']}/dismiss", headers=auth_header)


class TestSuggestionEngineEndToEnd:
    """Actual LLM calls through emergentintegrations — the critical new path."""

    @pytest.mark.parametrize("model_key", MODEL_KEYS)
    def test_suggestion_generation_succeeds_for_each_model(self, api, auth_header, model_key):
        _clear_pending(api, auth_header)
        _set_model(api, auth_header, model_key)

        r = api.get(f"{API}/ai/suggestions", params={"status": "pending"}, headers=auth_header)
        assert r.status_code == 200, f"model={model_key} got {r.status_code}: {r.text}"
        body = r.json()
        assert "items" in body
        assert isinstance(body["items"], list)
        # Either a valid suggestion or a clean empty list — never a 500/exception.
        if body["items"]:
            s = body["items"][0]
            assert s["kind"] in ("reschedule_task", "reminder", "insight")
            assert len(s["text"]) > 0
            assert s["reason"].lower().startswith("based on")
        # small delay to avoid hammering the LLM provider back-to-back
        time.sleep(1)
