"""Gym / strength-training log tests — new feature this session.
Covers: create/list/patch/delete sets, exercise-name autocomplete,
weekly summary rollup, and validation edge cases.
"""
import os
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
EMAIL = "testuser@lifeos.app"
PASSWORD = "LifeOS!2026demo"


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if resp.status_code != 200:
        pytest.skip(f"Auth failed with status {resp.status_code}: {resp.text}")
    token = resp.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def created_set_ids():
    return []


class TestGymSetCRUD:
    def test_create_set_and_verify_persistence(self, api_client, created_set_ids):
        payload = {
            "exercise_name": "TEST_Bench press",
            "weight": 60,
            "weight_unit": "kg",
            "reps": 8,
        }
        resp = api_client.post(f"{BASE_URL}/api/gym/sets", json=payload)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["exercise_name"] == "TEST_Bench press"
        assert data["weight"] == 60
        assert data["weight_unit"] == "kg"
        assert data["reps"] == 8
        assert "id" in data
        created_set_ids.append(data["id"])

        # GET to verify persistence
        list_resp = api_client.get(f"{BASE_URL}/api/gym/sets")
        assert list_resp.status_code == 200
        items = list_resp.json()["items"]
        assert any(i["id"] == data["id"] for i in items)

    def test_create_second_and_third_set_for_autocomplete(self, api_client, created_set_ids):
        for name in ["TEST_Squat", "TEST_Deadlift"]:
            resp = api_client.post(f"{BASE_URL}/api/gym/sets", json={
                "exercise_name": name, "weight": 100, "weight_unit": "kg", "reps": 5,
            })
            assert resp.status_code == 201, resp.text
            created_set_ids.append(resp.json()["id"])

    def test_exercise_names_autocomplete_reflects_recent(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/gym/exercises")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert "TEST_Bench press" in items
        assert "TEST_Squat" in items
        assert "TEST_Deadlift" in items
        # most recently used first
        assert items.index("TEST_Deadlift") < items.index("TEST_Bench press")

    def test_summary_reflects_created_sets(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/gym/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "sets_this_week" in data
        assert "sessions_this_week" in data
        assert data["sets_this_week"] >= 3

    def test_patch_set_updates_reps_and_persists(self, api_client, created_set_ids):
        set_id = created_set_ids[0]
        resp = api_client.patch(f"{BASE_URL}/api/gym/sets/{set_id}", json={"reps": 12})
        assert resp.status_code == 200, resp.text
        assert resp.json()["reps"] == 12

        list_resp = api_client.get(f"{BASE_URL}/api/gym/sets")
        item = next(i for i in list_resp.json()["items"] if i["id"] == set_id)
        assert item["reps"] == 12

    def test_delete_set_then_get_confirms_removed(self, api_client, created_set_ids):
        set_id = created_set_ids.pop()
        resp = api_client.delete(f"{BASE_URL}/api/gym/sets/{set_id}")
        assert resp.status_code == 204

        list_resp = api_client.get(f"{BASE_URL}/api/gym/sets")
        items = list_resp.json()["items"]
        assert not any(i["id"] == set_id for i in items)

        # delete again -> 404
        resp2 = api_client.delete(f"{BASE_URL}/api/gym/sets/{set_id}")
        assert resp2.status_code == 404

    def test_summary_decrements_after_delete(self, api_client, created_set_ids):
        before = api_client.get(f"{BASE_URL}/api/gym/summary").json()["sets_this_week"]
        set_id = created_set_ids.pop()
        api_client.delete(f"{BASE_URL}/api/gym/sets/{set_id}")
        after = api_client.get(f"{BASE_URL}/api/gym/summary").json()["sets_this_week"]
        assert after == before - 1


class TestGymValidation:
    def test_create_with_empty_exercise_name_fails(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/gym/sets", json={
            "exercise_name": "   ", "weight": 60, "weight_unit": "kg", "reps": 8,
        })
        assert resp.status_code == 400

    def test_create_with_zero_reps_fails(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/gym/sets", json={
            "exercise_name": "TEST_Curl", "weight": 20, "weight_unit": "kg", "reps": 0,
        })
        assert resp.status_code == 400

    def test_create_with_negative_weight_fails(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/gym/sets", json={
            "exercise_name": "TEST_Curl", "weight": -5, "weight_unit": "kg", "reps": 5,
        })
        assert resp.status_code == 400

    def test_patch_nonexistent_set_returns_404(self, api_client):
        resp = api_client.patch(f"{BASE_URL}/api/gym/sets/nonexistent-id", json={"reps": 5})
        assert resp.status_code == 404


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_sets(api_client):
    yield
    # Delete any remaining TEST_ prefixed gym sets created this run
    resp = api_client.get(f"{BASE_URL}/api/gym/sets", params={"limit": 500})
    if resp.status_code == 200:
        for item in resp.json()["items"]:
            if item["exercise_name"].startswith("TEST_"):
                api_client.delete(f"{BASE_URL}/api/gym/sets/{item['id']}")
