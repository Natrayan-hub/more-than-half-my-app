"""Backend tests for the 3 new MVP screens' APIs: Documents & Photo Backup,
Automations, Integrations (incl. Instagram), plus Preferences notif/backup
round-trip that the new Settings sub-screens rely on. Reuses fresh_user
pattern from test_lifeos_api.py (isolated per-test-session user)."""
import base64
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _unique_email():
    return f"pytest+{uuid.uuid4().hex[:10]}@lifeos.app"


@pytest.fixture(scope="module")
def auth_header(api):
    email, password = _unique_email(), "LifeOS!2026demo"
    r = api.post(f"{API}/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------- Documents & Photo Backup ----------
class TestDocuments:
    def test_create_document_and_get_persists(self, api, auth_header):
        content = base64.b64encode(b"hello world doc").decode()
        body = {
            "title": "TEST_Passport",
            "category": "id",
            "kind": "document",
            "content_base64": content,
            "size_bytes": len(content),
        }
        r = api.post(f"{API}/documents", json=body, headers=auth_header)
        assert r.status_code == 201, r.text
        doc = r.json()
        assert doc["title"] == "TEST_Passport"
        assert doc["kind"] == "document"
        assert doc["storage_policy"] == "cloud"  # default data_controls.documents == cloud
        doc_id = doc["id"]

        r2 = api.get(f"{API}/documents", params={"kind": "document"}, headers=auth_header)
        assert r2.status_code == 200
        ids = [d["id"] for d in r2.json()["items"]]
        assert doc_id in ids

    def test_create_photo(self, api, auth_header):
        content = base64.b64encode(b"fake image bytes").decode()
        body = {
            "title": "TEST_Photo1",
            "kind": "photo",
            "content_base64": content,
            "size_bytes": len(content),
        }
        r = api.post(f"{API}/documents", json=body, headers=auth_header)
        assert r.status_code == 201
        assert r.json()["kind"] == "photo"

        r2 = api.get(f"{API}/documents", params={"kind": "photo"}, headers=auth_header)
        assert any(d["title"] == "TEST_Photo1" for d in r2.json()["items"])

    def test_storage_summary_reflects_uploaded_bytes(self, api, auth_header):
        r = api.get(f"{API}/documents/storage/summary", headers=auth_header)
        assert r.status_code == 200
        summary = r.json()
        assert summary["used_bytes"] > 1_800_000_000  # baseline + real bytes
        assert summary["quota_bytes"] == 5_000_000_000
        assert summary["backup_frequency"] == "manual"

    def test_backup_now_sets_last_backup_at(self, api, auth_header):
        r = api.post(f"{API}/documents/backup", headers=auth_header)
        assert r.status_code == 200
        assert r.json()["last_backup_at"] is not None

        r2 = api.get(f"{API}/documents/storage/summary", headers=auth_header)
        assert r2.json()["last_backup_at"] is not None

    def test_delete_document_then_404_on_relist(self, api, auth_header):
        content = base64.b64encode(b"to be deleted").decode()
        r = api.post(
            f"{API}/documents",
            json={"title": "TEST_ToDelete", "kind": "document", "content_base64": content, "size_bytes": len(content)},
            headers=auth_header,
        )
        doc_id = r.json()["id"]

        r_del = api.delete(f"{API}/documents/{doc_id}", headers=auth_header)
        assert r_del.status_code == 204

        r_list = api.get(f"{API}/documents", params={"kind": "document"}, headers=auth_header)
        ids = [d["id"] for d in r_list.json()["items"]]
        assert doc_id not in ids

    def test_delete_nonexistent_document_404(self, api, auth_header):
        r = api.delete(f"{API}/documents/does-not-exist", headers=auth_header)
        assert r.status_code == 404


# ---------- Automations ----------
class TestAutomations:
    def test_list_seeds_three_presets_disabled(self, api, auth_header):
        r = api.get(f"{API}/automations", headers=auth_header)
        assert r.status_code == 200
        items = r.json()["items"]
        names = {a["name"] for a in items}
        assert {"Gym Reminder", "Meeting Focus Mode", "Bedtime Routine"}.issubset(names)
        for a in items:
            if a["is_preset"]:
                assert a["enabled"] is False, f"{a['name']} must be disabled by default"

    def test_list_again_does_not_reseed_duplicates(self, api, auth_header):
        r = api.get(f"{API}/automations", headers=auth_header)
        names = [a["name"] for a in r.json()["items"]]
        assert names.count("Gym Reminder") == 1

    def test_create_custom_automation(self, api, auth_header):
        body = {
            "name": "TEST_Custom Automation",
            "trigger": {"type": "time", "params": {"time": "08:00", "days": ["mon"]}},
            "action": {"type": "notification", "params": {"message": "Custom message"}},
            "enabled": False,
        }
        r = api.post(f"{API}/automations", json=body, headers=auth_header)
        assert r.status_code == 201, r.text
        created = r.json()
        assert created["enabled"] is False

        r2 = api.get(f"{API}/automations", headers=auth_header)
        assert any(a["id"] == created["id"] for a in r2.json()["items"])

    def test_patch_enable_persists(self, api, auth_header):
        r = api.get(f"{API}/automations", headers=auth_header)
        automation_id = r.json()["items"][0]["id"]

        r2 = api.patch(f"{API}/automations/{automation_id}", json={"enabled": True}, headers=auth_header)
        assert r2.status_code == 200
        assert r2.json()["enabled"] is True

        r3 = api.get(f"{API}/automations", headers=auth_header)
        updated = next(a for a in r3.json()["items"] if a["id"] == automation_id)
        assert updated["enabled"] is True

    def test_test_run_sets_last_run(self, api, auth_header):
        r = api.get(f"{API}/automations", headers=auth_header)
        automation_id = r.json()["items"][0]["id"]

        r2 = api.post(f"{API}/automations/{automation_id}/test-run", headers=auth_header)
        assert r2.status_code == 200
        body = r2.json()
        assert body["last_run_at"] is not None
        assert body["last_run_status"] == "success"

    def test_delete_automation_removes_from_list(self, api, auth_header):
        body = {
            "name": "TEST_ToDelete Automation",
            "trigger": {"type": "time", "params": {"time": "09:00"}},
            "action": {"type": "notification", "params": {"message": "x"}},
        }
        r = api.post(f"{API}/automations", json=body, headers=auth_header)
        automation_id = r.json()["id"]

        r_del = api.delete(f"{API}/automations/{automation_id}", headers=auth_header)
        assert r_del.status_code == 204

        r_list = api.get(f"{API}/automations", headers=auth_header)
        ids = [a["id"] for a in r_list.json()["items"]]
        assert automation_id not in ids

    def test_patch_nonexistent_404(self, api, auth_header):
        r = api.patch(f"{API}/automations/does-not-exist", json={"enabled": True}, headers=auth_header)
        assert r.status_code == 404


# ---------- Integrations (incl. Instagram / Social Stats shared state) ----------
class TestIntegrations:
    def test_list_returns_full_catalog_not_connected_by_default(self, api, auth_header):
        r = api.get(f"{API}/integrations", headers=auth_header)
        assert r.status_code == 200
        items = r.json()["items"]
        providers = {i["provider"] for i in items}
        assert providers == {
            "apple_health", "health_connect", "garmin", "google_calendar",
            "notion", "alexa", "instagram",
        }
        instagram = next(i for i in items if i["provider"] == "instagram")
        assert instagram["status"] == "not_connected"

    def test_connect_instagram_with_handle(self, api, auth_header):
        r = api.post(
            f"{API}/integrations/instagram/connect",
            json={"external_account": "@testhandle"},
            headers=auth_header,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "connected"
        assert body["external_account"] == "@testhandle"

    def test_connection_state_shared_between_social_and_integrations_list(self, api, auth_header):
        r = api.get(f"{API}/integrations", headers=auth_header)
        instagram = next(i for i in r.json()["items"] if i["provider"] == "instagram")
        assert instagram["status"] == "connected"
        assert instagram["external_account"] == "@testhandle"

    def test_disconnect_instagram_reverts(self, api, auth_header):
        r = api.post(f"{API}/integrations/instagram/disconnect", headers=auth_header)
        assert r.status_code == 204

        r2 = api.get(f"{API}/integrations", headers=auth_header)
        instagram = next(i for i in r2.json()["items"] if i["provider"] == "instagram")
        assert instagram["status"] == "not_connected"

    def test_connect_without_handle_defaults(self, api, auth_header):
        r = api.post(f"{API}/integrations/apple_health/connect", json={}, headers=auth_header)
        assert r.status_code == 200
        assert r.json()["external_account"] == "@apple_health_demo"

    def test_connect_unknown_provider_404(self, api, auth_header):
        r = api.post(f"{API}/integrations/not_a_provider/connect", json={}, headers=auth_header)
        assert r.status_code == 404


# ---------- Preferences: notif_prefs / backup_prefs round-trip ----------
class TestPreferencesForSettingsScreens:
    def test_notif_prefs_roundtrip(self, api, auth_header):
        r = api.get(f"{API}/me/preferences", headers=auth_header)
        assert r.status_code == 200
        pref = r.json()
        assert pref["notif_prefs"]["task_reminders"] is True

        pref["notif_prefs"] = {
            **pref["notif_prefs"],
            "task_reminders": False,
            "suggestions_per_day": 7,
            "backup_alerts": "all",
            "weekly_recap": "email",
        }
        r2 = api.put(f"{API}/me/preferences", json=pref, headers=auth_header)
        assert r2.status_code == 200
        saved = r2.json()
        assert saved["notif_prefs"]["task_reminders"] is False
        assert saved["notif_prefs"]["suggestions_per_day"] == 7
        assert saved["notif_prefs"]["backup_alerts"] == "all"

        r3 = api.get(f"{API}/me/preferences", headers=auth_header)
        assert r3.json()["notif_prefs"]["suggestions_per_day"] == 7

    def test_backup_prefs_frequency_roundtrip(self, api, auth_header):
        r = api.get(f"{API}/me/preferences", headers=auth_header)
        pref = r.json()
        pref["backup_prefs"]["frequency"] = "weekly"
        r2 = api.put(f"{API}/me/preferences", json=pref, headers=auth_header)
        assert r2.status_code == 200
        assert r2.json()["backup_prefs"]["frequency"] == "weekly"

        r3 = api.get(f"{API}/documents/storage/summary", headers=auth_header)
        assert r3.json()["backup_frequency"] == "weekly"
