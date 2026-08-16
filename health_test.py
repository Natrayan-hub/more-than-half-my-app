#!/usr/bin/env python3
"""LifeOS Health Routes Test Suite - Comprehensive testing of /api/health endpoints"""
import json
import time
import requests
from typing import Optional, Dict, Any

# Backend URL
BASE_URL = "https://fa82cb70-aca1-4c74-8094-e82495c5ca9f.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
USER1_EMAIL = "testuser@lifeos.app"
USER1_PASSWORD = "LifeOS!2026demo"

# Second user for security testing
USER2_EMAIL = f"healthtest+{int(time.time())}@lifeos.app"
USER2_PASSWORD = "HealthTest123!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def print_pass(msg: str):
    print(f"{Colors.GREEN}✓ PASS: {msg}{Colors.END}")

def print_fail(msg: str):
    print(f"{Colors.RED}✗ FAIL: {msg}{Colors.END}")

def print_info(msg: str):
    print(f"{Colors.YELLOW}ℹ INFO: {msg}{Colors.END}")

def login_user(email: str, password: str) -> Optional[str]:
    """Login and return access token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
        timeout=10
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None

def register_and_login(email: str, password: str) -> Optional[str]:
    """Register new user and return access token"""
    response = requests.post(
        f"{BASE_URL}/auth/register",
        json={"email": email, "password": password},
        timeout=10
    )
    if response.status_code == 201:
        return response.json().get("access_token")
    return None

def test_1_create_water_entry(token: str) -> Optional[str]:
    """Test 1: POST /api/health/entries with water type"""
    print_test("1. Create Water Entry")
    
    response = requests.post(
        f"{BASE_URL}/health/entries",
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "water", "value": 250},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 201:
        data = response.json()
        checks = {
            "has_id": "id" in data,
            "has_user_id": "user_id" in data,
            "type_correct": data.get("type") == "water",
            "value_correct": data.get("value") == 250,
            "has_logged_at": "logged_at" in data,
            "version_is_1": data.get("version") == 1
        }
        
        all_passed = all(checks.values())
        
        for check, passed in checks.items():
            if passed:
                print_pass(f"{check}: {data.get(check.replace('_correct', '').replace('has_', '').replace('is_', ''))}")
            else:
                print_fail(f"{check} failed")
        
        if all_passed:
            print_pass("Water entry created successfully with all required fields")
            return data.get("id")
        else:
            print_fail("Some fields missing or incorrect")
            return data.get("id")
    else:
        print_fail(f"Expected 201, got {response.status_code}")
        return None

def test_2_create_mood_entry(token: str) -> Optional[str]:
    """Test 2: POST /api/health/entries with mood type and note"""
    print_test("2. Create Mood Entry with Note")
    
    response = requests.post(
        f"{BASE_URL}/health/entries",
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "mood", "value": 4, "note": "feeling good"},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 201:
        data = response.json()
        checks = {
            "type_correct": data.get("type") == "mood",
            "value_correct": data.get("value") == 4,
            "note_correct": data.get("note") == "feeling good"
        }
        
        all_passed = all(checks.values())
        
        for check, passed in checks.items():
            if passed:
                print_pass(f"{check}")
            else:
                print_fail(f"{check} failed")
        
        if all_passed:
            print_pass("Mood entry created successfully with note")
            return data.get("id")
        else:
            print_fail("Some fields incorrect")
            return data.get("id")
    else:
        print_fail(f"Expected 201, got {response.status_code}")
        return None

def test_3_create_weight_entry(token: str) -> Optional[str]:
    """Test 3: POST /api/health/entries with weight type"""
    print_test("3. Create Weight Entry")
    
    response = requests.post(
        f"{BASE_URL}/health/entries",
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "weight", "value": 71.5},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 201:
        data = response.json()
        if data.get("type") == "weight" and data.get("value") == 71.5:
            print_pass("Weight entry created successfully")
            return data.get("id")
        else:
            print_fail("Weight entry fields incorrect")
            return data.get("id")
    else:
        print_fail(f"Expected 201, got {response.status_code}")
        return None

def test_4_get_water_entries(token: str, expected_id: str) -> bool:
    """Test 4: GET /api/health/entries?type=water"""
    print_test("4. Get Water Entries")
    
    response = requests.get(
        f"{BASE_URL}/health/entries?type=water",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "items" in data:
            items = data["items"]
            print_pass(f"Got {len(items)} water entries")
            
            # Check if our created entry is in the list
            found = any(item.get("id") == expected_id for item in items)
            if found:
                print_pass(f"Created water entry (id={expected_id}) found in list")
            else:
                print_fail(f"Created water entry (id={expected_id}) NOT found in list")
            
            # Check sorting (newest first)
            if len(items) > 1:
                first_time = items[0].get("logged_at")
                second_time = items[1].get("logged_at")
                if first_time >= second_time:
                    print_pass("Entries sorted newest first")
                else:
                    print_fail("Entries NOT sorted correctly")
            
            return found
        else:
            print_fail("Response missing 'items' field")
            return False
    else:
        print_fail(f"Expected 200, got {response.status_code}")
        return False

def test_5_get_weight_entries(token: str, expected_id: str) -> bool:
    """Test 5: GET /api/health/entries?type=weight&limit=10"""
    print_test("5. Get Weight Entries with Limit")
    
    response = requests.get(
        f"{BASE_URL}/health/entries?type=weight&limit=10",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "items" in data:
            items = data["items"]
            print_pass(f"Got {len(items)} weight entries")
            
            found = any(item.get("id") == expected_id for item in items)
            if found:
                print_pass(f"Created weight entry (id={expected_id}) found in list")
                return True
            else:
                print_fail(f"Created weight entry (id={expected_id}) NOT found in list")
                return False
        else:
            print_fail("Response missing 'items' field")
            return False
    else:
        print_fail(f"Expected 200, got {response.status_code}")
        return False

def test_6_patch_weight_entry(token: str, entry_id: str) -> bool:
    """Test 6: PATCH /api/health/entries/{id} with new value"""
    print_test("6. Update Weight Entry Value")
    
    response = requests.patch(
        f"{BASE_URL}/health/entries/{entry_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"value": 72.0},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        value_correct = data.get("value") == 72.0
        version_correct = data.get("version") == 2
        
        if value_correct:
            print_pass("Value updated to 72.0")
        else:
            print_fail(f"Value not updated correctly: {data.get('value')}")
        
        if version_correct:
            print_pass("Version incremented to 2")
        else:
            print_fail(f"Version not incremented correctly: {data.get('version')}")
        
        return value_correct and version_correct
    else:
        print_fail(f"Expected 200, got {response.status_code}")
        return False

def test_7_patch_empty_body(token: str, entry_id: str) -> bool:
    """Test 7: PATCH /api/health/entries/{id} with empty body"""
    print_test("7. Update Entry with Empty Body (expect 400)")
    
    response = requests.patch(
        f"{BASE_URL}/health/entries/{entry_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 400:
        data = response.json()
        detail = data.get("detail", "")
        if "NO_FIELDS" in detail:
            print_pass("Got 400 with NO_FIELDS error")
            return True
        else:
            print_pass(f"Got 400 but detail is: {detail}")
            return True
    else:
        print_fail(f"Expected 400, got {response.status_code}")
        return False

def test_8_patch_fake_id(token: str) -> bool:
    """Test 8: PATCH /api/health/entries/{fake-id}"""
    print_test("8. Update Non-existent Entry (expect 404)")
    
    response = requests.patch(
        f"{BASE_URL}/health/entries/fake-id-12345",
        headers={"Authorization": f"Bearer {token}"},
        json={"value": 1},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 404:
        data = response.json()
        detail = data.get("detail", "")
        if "HEALTH_ENTRY_NOT_FOUND" in detail:
            print_pass("Got 404 with HEALTH_ENTRY_NOT_FOUND error")
            return True
        else:
            print_pass(f"Got 404 but detail is: {detail}")
            return True
    else:
        print_fail(f"Expected 404, got {response.status_code}")
        return False

def test_9_delete_mood_entry(token: str, entry_id: str) -> bool:
    """Test 9: DELETE /api/health/entries/{id}"""
    print_test("9. Delete Mood Entry (expect 204)")
    
    response = requests.delete(
        f"{BASE_URL}/health/entries/{entry_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response body length: {len(response.text)}")
    
    if response.status_code == 204:
        print_pass("Got 204 No Content")
        if len(response.text) == 0:
            print_pass("Response body is empty as expected")
            return True
        else:
            print_info(f"Response body not empty: {response.text}")
            return True
    else:
        print_fail(f"Expected 204, got {response.status_code}")
        return False

def test_10_verify_deleted_entry(token: str, deleted_id: str) -> bool:
    """Test 10: GET /api/health/entries?type=mood - verify deleted entry not in list"""
    print_test("10. Verify Deleted Mood Entry Not in List")
    
    response = requests.get(
        f"{BASE_URL}/health/entries?type=mood",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "items" in data:
            items = data["items"]
            found = any(item.get("id") == deleted_id for item in items)
            
            if not found:
                print_pass(f"Deleted entry (id={deleted_id}) correctly NOT in list (soft-deleted)")
                return True
            else:
                print_fail(f"Deleted entry (id={deleted_id}) still appears in list!")
                return False
        else:
            print_fail("Response missing 'items' field")
            return False
    else:
        print_fail(f"Expected 200, got {response.status_code}")
        return False

def test_11_delete_fake_id(token: str) -> bool:
    """Test 11: DELETE /api/health/entries/{fake-id}"""
    print_test("11. Delete Non-existent Entry (expect 404)")
    
    response = requests.delete(
        f"{BASE_URL}/health/entries/fake-id-67890",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 404:
        data = response.json()
        detail = data.get("detail", "")
        if "HEALTH_ENTRY_NOT_FOUND" in detail:
            print_pass("Got 404 with HEALTH_ENTRY_NOT_FOUND error")
            return True
        else:
            print_pass(f"Got 404 but detail is: {detail}")
            return True
    else:
        print_fail(f"Expected 404, got {response.status_code}")
        return False

def test_12_security_user_scoping(token1: str, token2: str) -> bool:
    """Test 12: Security - try to PATCH/DELETE another user's entry"""
    print_test("12. Security - User ID Scoping")
    
    # Create an entry as user2
    print_info("Creating entry as user2...")
    response = requests.post(
        f"{BASE_URL}/health/entries",
        headers={"Authorization": f"Bearer {token2}"},
        json={"type": "water", "value": 500},
        timeout=10
    )
    
    if response.status_code != 201:
        print_fail(f"Failed to create entry as user2: {response.status_code}")
        return False
    
    user2_entry_id = response.json().get("id")
    print_info(f"User2 entry created with id={user2_entry_id}")
    
    # Try to PATCH user2's entry using user1's token
    print_info("Attempting to PATCH user2's entry with user1's token...")
    response = requests.patch(
        f"{BASE_URL}/health/entries/{user2_entry_id}",
        headers={"Authorization": f"Bearer {token1}"},
        json={"value": 999},
        timeout=10
    )
    
    print_info(f"PATCH Status: {response.status_code}")
    print_info(f"PATCH Response: {response.text[:300]}")
    
    patch_blocked = response.status_code == 404
    if patch_blocked:
        print_pass("PATCH blocked with 404 (not 403, to avoid leaking existence)")
    else:
        print_fail(f"PATCH should return 404, got {response.status_code}")
    
    # Try to DELETE user2's entry using user1's token
    print_info("Attempting to DELETE user2's entry with user1's token...")
    response = requests.delete(
        f"{BASE_URL}/health/entries/{user2_entry_id}",
        headers={"Authorization": f"Bearer {token1}"},
        timeout=10
    )
    
    print_info(f"DELETE Status: {response.status_code}")
    print_info(f"DELETE Response: {response.text[:300]}")
    
    delete_blocked = response.status_code == 404
    if delete_blocked:
        print_pass("DELETE blocked with 404 (not 403, to avoid leaking existence)")
    else:
        print_fail(f"DELETE should return 404, got {response.status_code}")
    
    return patch_blocked and delete_blocked

def test_13_no_auth_header() -> bool:
    """Test 13: GET /api/health/entries without Authorization header"""
    print_test("13. Get Entries Without Auth Header (expect 401)")
    
    response = requests.get(
        f"{BASE_URL}/health/entries",
        timeout=10
    )
    
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code == 401:
        print_pass("Got 401 Unauthorized")
        return True
    else:
        print_fail(f"Expected 401, got {response.status_code}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}LifeOS Health Routes Test Suite{Colors.END}")
    print(f"{Colors.BLUE}Backend URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    results = {}
    
    # Setup: Login as user1
    print_info(f"Logging in as {USER1_EMAIL}...")
    token1 = login_user(USER1_EMAIL, USER1_PASSWORD)
    if not token1:
        print_fail("Failed to login as user1. Cannot proceed with tests.")
        return 1
    print_pass("User1 logged in successfully")
    
    # Setup: Register and login as user2 for security testing
    print_info(f"Registering user2: {USER2_EMAIL}...")
    token2 = register_and_login(USER2_EMAIL, USER2_PASSWORD)
    if not token2:
        print_fail("Failed to register user2. Security test will be skipped.")
    else:
        print_pass("User2 registered successfully")
    
    # Test 1: Create water entry
    water_id = test_1_create_water_entry(token1)
    results["test_1_water"] = water_id is not None
    
    # Test 2: Create mood entry
    mood_id = test_2_create_mood_entry(token1)
    results["test_2_mood"] = mood_id is not None
    
    # Test 3: Create weight entry
    weight_id = test_3_create_weight_entry(token1)
    results["test_3_weight"] = weight_id is not None
    
    # Test 4: Get water entries
    if water_id:
        results["test_4_get_water"] = test_4_get_water_entries(token1, water_id)
    else:
        results["test_4_get_water"] = False
        print_fail("Skipped test 4 - no water entry id")
    
    # Test 5: Get weight entries
    if weight_id:
        results["test_5_get_weight"] = test_5_get_weight_entries(token1, weight_id)
    else:
        results["test_5_get_weight"] = False
        print_fail("Skipped test 5 - no weight entry id")
    
    # Test 6: Patch weight entry
    if weight_id:
        results["test_6_patch_weight"] = test_6_patch_weight_entry(token1, weight_id)
    else:
        results["test_6_patch_weight"] = False
        print_fail("Skipped test 6 - no weight entry id")
    
    # Test 7: Patch with empty body
    if weight_id:
        results["test_7_patch_empty"] = test_7_patch_empty_body(token1, weight_id)
    else:
        results["test_7_patch_empty"] = False
        print_fail("Skipped test 7 - no weight entry id")
    
    # Test 8: Patch fake id
    results["test_8_patch_fake"] = test_8_patch_fake_id(token1)
    
    # Test 9: Delete mood entry
    if mood_id:
        results["test_9_delete_mood"] = test_9_delete_mood_entry(token1, mood_id)
    else:
        results["test_9_delete_mood"] = False
        print_fail("Skipped test 9 - no mood entry id")
    
    # Test 10: Verify deleted entry not in list
    if mood_id:
        results["test_10_verify_deleted"] = test_10_verify_deleted_entry(token1, mood_id)
    else:
        results["test_10_verify_deleted"] = False
        print_fail("Skipped test 10 - no mood entry id")
    
    # Test 11: Delete fake id
    results["test_11_delete_fake"] = test_11_delete_fake_id(token1)
    
    # Test 12: Security - user scoping
    if token2:
        results["test_12_security"] = test_12_security_user_scoping(token1, token2)
    else:
        results["test_12_security"] = False
        print_fail("Skipped test 12 - no user2 token")
    
    # Test 13: No auth header
    results["test_13_no_auth"] = test_13_no_auth_header()
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.END}" if result else f"{Colors.RED}FAIL{Colors.END}"
        print(f"{test_name}: {status}")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.END}")
    
    if passed == total:
        print(f"{Colors.GREEN}{'='*80}{Colors.END}")
        print(f"{Colors.GREEN}ALL TESTS PASSED ✓{Colors.END}")
        print(f"{Colors.GREEN}{'='*80}{Colors.END}")
        return 0
    else:
        print(f"{Colors.RED}{'='*80}{Colors.END}")
        print(f"{Colors.RED}SOME TESTS FAILED ✗{Colors.END}")
        print(f"{Colors.RED}{'='*80}{Colors.END}")
        return 1

if __name__ == "__main__":
    exit(main())
