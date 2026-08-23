"""Backend tests for the NEW Edit Profile feature this session:
- PATCH /me/profile display_name (already existed, light regression)
- POST /me/avatar (multipart upload via Emergent Object Storage)
- GET /me/avatar (Bearer header auth AND ?token= query-param auth fallback)
"""
import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c6360000002000100ffff03000006"
    "000557bfabd40000000049454e44ae426082"
)


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    return s


def _unique_email():
    return f"pytest+avatar+{uuid.uuid4().hex[:10]}@lifeos.app"


@pytest.fixture(scope="module")
def auth_token(api):
    email, password = _unique_email(), "LifeOS!2026demo"
    r = api.post(f"{API}/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_header(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


class TestDisplayNameRegression:
    def test_patch_display_name_persists(self, api, auth_header):
        r = api.patch(f"{API}/me/profile", json={"display_name": "TEST_Avatar User"}, headers=auth_header)
        assert r.status_code == 200, r.text
        assert r.json()["display_name"] == "TEST_Avatar User"

        r2 = api.get(f"{API}/me", headers=auth_header)
        assert r2.status_code == 200
        assert r2.json()["profile"]["display_name"] == "TEST_Avatar User"

    def test_patch_ai_enabled_still_works(self, api, auth_header):
        r = api.patch(f"{API}/me/profile", json={"ai_enabled": True}, headers=auth_header)
        assert r.status_code == 200
        assert r.json()["ai_enabled"] is True


class TestAvatarUpload:
    def test_get_avatar_404_before_any_upload(self, api, auth_header):
        r = api.get(f"{API}/me/avatar", headers=auth_header)
        assert r.status_code == 404

    def test_get_avatar_401_without_token(self, api):
        r = api.get(f"{API}/me/avatar")
        assert r.status_code == 401

    def test_upload_rejects_non_image_content_type(self, api, auth_header):
        files = {"file": ("note.txt", io.BytesIO(b"hello"), "text/plain")}
        r = api.post(f"{API}/me/avatar", files=files, headers=auth_header)
        assert r.status_code == 400, r.text

    def test_upload_rejects_over_5mb(self, api, auth_header):
        big = b"0" * (5 * 1024 * 1024 + 1)
        files = {"file": ("big.jpg", io.BytesIO(big), "image/jpeg")}
        r = api.post(f"{API}/me/avatar", files=files, headers=auth_header)
        assert r.status_code == 400, r.text

    def test_upload_valid_png_succeeds_and_returns_avatar_url(self, api, auth_header):
        files = {"file": ("avatar.png", io.BytesIO(TINY_PNG), "image/png")}
        r = api.post(f"{API}/me/avatar", files=files, headers=auth_header)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["avatar_url"] is not None
        assert body["avatar_url"].startswith("/me/avatar?v=")
        assert "avatar_object_path" not in body  # excluded field must never leak

    def test_get_avatar_with_bearer_header_returns_image_bytes(self, api, auth_header):
        r = api.get(f"{API}/me/avatar", headers=auth_header)
        assert r.status_code == 200
        assert r.headers.get("content-type") in ("image/png", "image/png; charset=utf-8")
        assert r.content == TINY_PNG

    def test_get_avatar_with_query_token_param(self, api, auth_token):
        r = api.get(f"{API}/me/avatar", params={"token": auth_token})
        assert r.status_code == 200
        assert r.content == TINY_PNG

    def test_get_avatar_without_any_auth_401(self, api):
        r = api.get(f"{API}/me/avatar")
        assert r.status_code == 401

    def test_get_avatar_with_bad_query_token_401(self, api):
        r = api.get(f"{API}/me/avatar", params={"token": "not-a-real-token"})
        assert r.status_code == 401
