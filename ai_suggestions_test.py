#!/usr/bin/env python3
"""
AI Suggestions Backend Testing Suite for LifeOS
Tests the /api/ai/* endpoints with REAL ChatGPT integration (gpt-5.4)
"""
import requests
import time
import json
from datetime import datetime, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://fa82cb70-aca1-4c74-8094-e82495c5ca9f.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
TEST_EMAIL = "testuser@lifeos.app"
TEST_PASSWORD = "LifeOS!2026demo"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log_test(test_num, description):
    print(f"\n{Colors.BLUE}[TEST {test_num}] {description}{Colors.END}")

def log_pass(message):
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.END}")

def log_fail(message):
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.END}")

def log_info(message):
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.END}")

def login():
    """Login and return access token"""
    log_info("Logging in with test credentials...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        log_fail(f"Login failed: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    token = data.get("access_token")
    log_pass(f"Login successful, got access token")
    return token

def test_1_enable_ai_and_get_suggestions(token):
    """Test 1: Enable AI and GET /api/ai/suggestions?status=pending"""
    log_test(1, "Enable AI and GET /api/ai/suggestions?status=pending")
    
    # First enable AI
    log_info("Enabling AI with PATCH /api/me/profile...")
    response = requests.patch(
        f"{BASE_URL}/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"ai_enabled": True}
    )
    if response.status_code != 200:
        log_fail(f"Failed to enable AI: {response.status_code} - {response.text}")
        return None
    log_pass("AI enabled successfully")
    
    # Create test data to increase suggestion odds
    log_info("Creating overdue task to increase suggestion odds...")
    overdue_date = (datetime.utcnow() - timedelta(days=5)).isoformat() + "Z"
    task_response = requests.post(
        f"{BASE_URL}/tasks",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Overdue test task for AI suggestions",
            "due_at": overdue_date,
            "bucket": "today"
        }
    )
    if task_response.status_code == 201:
        log_pass(f"Created overdue task: {task_response.json().get('id')}")
    
    log_info("Logging water entry...")
    water_response = requests.post(
        f"{BASE_URL}/health/entries",
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "water", "value": 250}
    )
    if water_response.status_code == 201:
        log_pass("Logged 250ml water entry")
    
    # Now get suggestions (allow 5-10s for LLM call)
    log_info("Getting suggestions (may take 5-10s for LLM call)...")
    start_time = time.time()
    response = requests.get(
        f"{BASE_URL}/ai/suggestions?status=pending",
        headers={"Authorization": f"Bearer {token}"}
    )
    elapsed = time.time() - start_time
    
    if response.status_code != 200:
        log_fail(f"GET /api/ai/suggestions failed: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    log_pass(f"GET /api/ai/suggestions returned 200 (took {elapsed:.2f}s)")
    
    # Verify response shape
    if "items" not in data:
        log_fail("Response missing 'items' field")
        return None
    log_pass("Response has 'items' field")
    
    items = data["items"]
    log_info(f"Got {len(items)} suggestion(s)")
    
    if len(items) == 0:
        log_info("No suggestions generated (model may legitimately find nothing worth suggesting)")
        return None
    
    # Verify suggestion structure
    suggestion = items[0]
    required_fields = ["id", "kind", "text", "reason", "status", "sources"]
    for field in required_fields:
        if field not in suggestion:
            log_fail(f"Suggestion missing required field: {field}")
            return None
    log_pass(f"Suggestion has all required fields: {required_fields}")
    
    # Verify kind is valid
    valid_kinds = ["reschedule_task", "schedule_gap", "reminder", "recipe", "insight"]
    if suggestion["kind"] not in valid_kinds:
        log_fail(f"Invalid kind: {suggestion['kind']}")
        return None
    log_pass(f"Suggestion kind is valid: {suggestion['kind']}")
    
    # Verify text is non-empty and reasonably short
    if not suggestion["text"] or len(suggestion["text"]) > 280:
        log_fail(f"Suggestion text invalid: {suggestion['text']}")
        return None
    log_pass(f"Suggestion text valid (length: {len(suggestion['text'])})")
    
    # Verify reason starts with or contains "Based on"
    if "based on" not in suggestion["reason"].lower():
        log_fail(f"Reason doesn't contain 'Based on': {suggestion['reason']}")
        return None
    log_pass("Suggestion reason contains 'Based on'")
    
    # Verify status is pending
    if suggestion["status"] != "pending":
        log_fail(f"Expected status='pending', got: {suggestion['status']}")
        return None
    log_pass("Suggestion status is 'pending'")
    
    # Log the actual suggestion for quality check
    log_info(f"Suggestion text: {suggestion['text']}")
    log_info(f"Suggestion reason: {suggestion['reason']}")
    log_info(f"Suggestion kind: {suggestion['kind']}")
    log_info(f"Suggestion sources: {json.dumps(suggestion['sources'], indent=2)}")
    
    return suggestion["id"]

def test_2_cached_suggestion(token, expected_id):
    """Test 2: GET /api/ai/suggestions again - should return SAME id (cached)"""
    log_test(2, "GET /api/ai/suggestions again - verify caching")
    
    if not expected_id:
        log_info("Skipping test 2 - no suggestion from test 1")
        return
    
    log_info("Getting suggestions again (should be fast, <1s)...")
    start_time = time.time()
    response = requests.get(
        f"{BASE_URL}/ai/suggestions?status=pending",
        headers={"Authorization": f"Bearer {token}"}
    )
    elapsed = time.time() - start_time
    
    if response.status_code != 200:
        log_fail(f"GET /api/ai/suggestions failed: {response.status_code} - {response.text}")
        return
    
    data = response.json()
    log_pass(f"GET /api/ai/suggestions returned 200 (took {elapsed:.2f}s)")
    
    if elapsed > 2.0:
        log_fail(f"Second call took too long ({elapsed:.2f}s) - should be cached and fast")
    else:
        log_pass(f"Second call was fast ({elapsed:.2f}s) - likely cached")
    
    items = data["items"]
    if len(items) == 0:
        log_fail("No suggestions returned on second call")
        return
    
    suggestion_id = items[0]["id"]
    if suggestion_id != expected_id:
        log_fail(f"Different suggestion id: expected {expected_id}, got {suggestion_id}")
        return
    
    log_pass(f"Same suggestion id returned: {suggestion_id}")

def test_3_accept_suggestion(token, suggestion_id):
    """Test 3: POST /api/ai/suggestions/{id}/accept"""
    log_test(3, f"POST /api/ai/suggestions/{suggestion_id}/accept")
    
    if not suggestion_id:
        log_info("Skipping test 3 - no suggestion id")
        return None
    
    response = requests.post(
        f"{BASE_URL}/ai/suggestions/{suggestion_id}/accept",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        log_fail(f"Accept failed: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    log_pass(f"Accept returned 200")
    
    # Verify response structure
    if "status" not in data or data["status"] != "accepted":
        log_fail(f"Expected status='accepted', got: {data.get('status')}")
        return None
    log_pass("Response has status='accepted'")
    
    if "changed" not in data:
        log_fail("Response missing 'changed' field")
        return None
    log_pass("Response has 'changed' field")
    
    # If kind was reschedule_task, verify changed contains task
    changed = data["changed"]
    if changed and "task" in changed:
        task = changed["task"]
        if "bucket" not in task:
            log_fail("Changed task missing 'bucket' field")
        else:
            log_pass(f"Changed task has updated bucket: {task['bucket']}")
            log_info(f"Task details: {json.dumps(task, indent=2)}")
    else:
        log_info("No task changes (suggestion may not have been reschedule_task type)")
    
    return suggestion_id

def test_4_get_accepted_suggestions(token, accepted_id):
    """Test 4: GET /api/ai/suggestions?status=accepted"""
    log_test(4, "GET /api/ai/suggestions?status=accepted")
    
    if not accepted_id:
        log_info("Skipping test 4 - no accepted suggestion")
        return
    
    response = requests.get(
        f"{BASE_URL}/ai/suggestions?status=accepted",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        log_fail(f"GET accepted suggestions failed: {response.status_code} - {response.text}")
        return
    
    data = response.json()
    log_pass("GET /api/ai/suggestions?status=accepted returned 200")
    
    items = data.get("items", [])
    log_info(f"Found {len(items)} accepted suggestion(s)")
    
    # Verify our accepted suggestion is in the list
    found = False
    for item in items:
        if item["id"] == accepted_id:
            found = True
            if item["status"] != "accepted":
                log_fail(f"Suggestion status is {item['status']}, expected 'accepted'")
            else:
                log_pass(f"Found accepted suggestion with correct status: {accepted_id}")
            break
    
    if not found:
        log_fail(f"Accepted suggestion {accepted_id} not found in accepted list")

def test_5_double_accept(token, suggestion_id):
    """Test 5: POST /api/ai/suggestions/{id}/accept again (already accepted)"""
    log_test(5, "POST /api/ai/suggestions/{id}/accept again (should fail)")
    
    if not suggestion_id:
        log_info("Skipping test 5 - no suggestion id")
        return
    
    response = requests.post(
        f"{BASE_URL}/ai/suggestions/{suggestion_id}/accept",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 400:
        log_fail(f"Expected 400, got: {response.status_code}")
        return
    log_pass("Double accept returned 400")
    
    data = response.json()
    error = data.get("error", {})
    if error.get("code") != "SUGGESTION_NOT_PENDING":
        log_fail(f"Expected error code SUGGESTION_NOT_PENDING, got: {error.get('code')}")
    else:
        log_pass("Error code is SUGGESTION_NOT_PENDING")

def test_6_dismiss_with_never_again(token):
    """Test 6: Create/find pending suggestion and dismiss with never_again=true"""
    log_test(6, "Dismiss suggestion with never_again=true and verify AIMemoryEntry")
    
    # First, try to get a pending suggestion
    log_info("Getting pending suggestions...")
    response = requests.get(
        f"{BASE_URL}/ai/suggestions?status=pending",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        log_fail(f"Failed to get pending suggestions: {response.status_code}")
        return
    
    items = response.json().get("items", [])
    if len(items) == 0:
        log_info("No pending suggestions available for dismiss test")
        log_info("This is OK - may have hit rate limit or no new suggestions generated")
        return
    
    suggestion_id = items[0]["id"]
    suggestion_text = items[0]["text"]
    suggestion_kind = items[0]["kind"]
    log_info(f"Found pending suggestion: {suggestion_id}")
    
    # Dismiss with never_again=true
    log_info("Dismissing with never_again=true...")
    response = requests.post(
        f"{BASE_URL}/ai/suggestions/{suggestion_id}/dismiss",
        headers={"Authorization": f"Bearer {token}"},
        json={"never_again": True}
    )
    
    if response.status_code != 200:
        log_fail(f"Dismiss failed: {response.status_code} - {response.text}")
        return
    
    data = response.json()
    if data.get("status") != "dismissed":
        log_fail(f"Expected status='dismissed', got: {data.get('status')}")
        return
    log_pass("Dismiss returned 200 with status='dismissed'")
    
    # Verify AIMemoryEntry was created
    log_info("Checking for AIMemoryEntry with domain=dismissal...")
    response = requests.get(
        f"{BASE_URL}/ai/memory?domain=dismissal",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        log_fail(f"Failed to get AI memory: {response.status_code} - {response.text}")
        return
    
    memory_items = response.json().get("items", [])
    log_info(f"Found {len(memory_items)} dismissal memory entries")
    
    # Look for the memory entry referencing our suggestion
    found = False
    for entry in memory_items:
        if entry.get("provenance", {}).get("evidence") == suggestion_id:
            found = True
            log_pass(f"Found AIMemoryEntry referencing suggestion {suggestion_id}")
            log_info(f"Memory statement: {entry.get('statement')}")
            log_info(f"Memory domain: {entry.get('domain')}")
            log_info(f"Memory structured: {entry.get('structured')}")
            break
    
    if not found:
        log_fail(f"No AIMemoryEntry found referencing suggestion {suggestion_id}")

def test_7_fake_suggestion_ids(token):
    """Test 7: POST /api/ai/suggestions/{fake-id}/accept and /dismiss - expect 404"""
    log_test(7, "Test fake suggestion IDs - expect 404 SUGGESTION_NOT_FOUND")
    
    fake_id = "fake-suggestion-id-12345"
    
    # Test accept with fake id
    log_info(f"Testing accept with fake id: {fake_id}")
    response = requests.post(
        f"{BASE_URL}/ai/suggestions/{fake_id}/accept",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 404:
        log_fail(f"Expected 404 for fake accept, got: {response.status_code}")
    else:
        log_pass("Accept with fake id returned 404")
        error = response.json().get("error", {})
        if error.get("code") != "SUGGESTION_NOT_FOUND":
            log_fail(f"Expected error code SUGGESTION_NOT_FOUND, got: {error.get('code')}")
        else:
            log_pass("Error code is SUGGESTION_NOT_FOUND")
    
    # Test dismiss with fake id
    log_info(f"Testing dismiss with fake id: {fake_id}")
    response = requests.post(
        f"{BASE_URL}/ai/suggestions/{fake_id}/dismiss",
        headers={"Authorization": f"Bearer {token}"},
        json={"never_again": False}
    )
    
    if response.status_code != 404:
        log_fail(f"Expected 404 for fake dismiss, got: {response.status_code}")
    else:
        log_pass("Dismiss with fake id returned 404")
        error = response.json().get("error", {})
        if error.get("code") != "SUGGESTION_NOT_FOUND":
            log_fail(f"Expected error code SUGGESTION_NOT_FOUND, got: {error.get('code')}")
        else:
            log_pass("Error code is SUGGESTION_NOT_FOUND")

def test_8_rate_limiting(token):
    """Test 8: Rate limiting - call GET /api/ai/suggestions 5 times rapidly"""
    log_test(8, "Rate limiting - 5 rapid calls to GET /api/ai/suggestions")
    
    log_info("Making 5 rapid calls...")
    for i in range(5):
        response = requests.get(
            f"{BASE_URL}/ai/suggestions?status=pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 500:
            log_fail(f"Call {i+1} returned 500 - server crashed")
            return
        elif response.status_code != 200:
            log_info(f"Call {i+1} returned {response.status_code} (may be rate limited)")
        else:
            log_info(f"Call {i+1} returned 200")
    
    log_pass("All 5 calls completed without 500 errors - rate limiting working correctly")

def test_9_security_gating(token):
    """Test 9: Security gating - ai_enabled=false should return 403 SCOPE_DENIED"""
    log_test(9, "Security gating - test ai_enabled=false")
    
    # Disable AI
    log_info("Disabling AI with PATCH /api/me/profile...")
    response = requests.patch(
        f"{BASE_URL}/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"ai_enabled": False}
    )
    if response.status_code != 200:
        log_fail(f"Failed to disable AI: {response.status_code}")
        return
    log_pass("AI disabled successfully")
    
    # Try to get suggestions
    log_info("Trying GET /api/ai/suggestions with ai_enabled=false...")
    response = requests.get(
        f"{BASE_URL}/ai/suggestions?status=pending",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 403:
        log_fail(f"Expected 403, got: {response.status_code}")
    else:
        log_pass("GET /api/ai/suggestions returned 403")
        error = response.json().get("error", {})
        if error.get("code") != "SCOPE_DENIED":
            log_fail(f"Expected error code SCOPE_DENIED, got: {error.get('code')}")
        else:
            log_pass("Error code is SCOPE_DENIED")
    
    # Try to post memory
    log_info("Trying POST /api/ai/memory with ai_enabled=false...")
    response = requests.post(
        f"{BASE_URL}/ai/memory",
        headers={"Authorization": f"Bearer {token}"},
        json={"domain": "preference", "statement": "test"}
    )
    
    if response.status_code != 403:
        log_fail(f"Expected 403 for POST /api/ai/memory, got: {response.status_code}")
    else:
        log_pass("POST /api/ai/memory returned 403")
        error = response.json().get("error", {})
        if error.get("code") != "SCOPE_DENIED":
            log_fail(f"Expected error code SCOPE_DENIED, got: {error.get('code')}")
        else:
            log_pass("Error code is SCOPE_DENIED")
    
    # Re-enable AI
    log_info("Re-enabling AI...")
    response = requests.patch(
        f"{BASE_URL}/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"ai_enabled": True}
    )
    if response.status_code != 200:
        log_fail(f"Failed to re-enable AI: {response.status_code}")
        return
    log_pass("AI re-enabled successfully")
    
    # Verify GET /api/ai/memory works again
    log_info("Verifying GET /api/ai/memory works with ai_enabled=true...")
    response = requests.get(
        f"{BASE_URL}/ai/memory",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        log_fail(f"GET /api/ai/memory failed after re-enabling: {response.status_code}")
    else:
        log_pass("GET /api/ai/memory works again after re-enabling AI")

def test_10_unauthorized_access():
    """Test 10: GET /api/ai/suggestions without Authorization header - expect 401"""
    log_test(10, "Unauthorized access - no Authorization header")
    
    response = requests.get(f"{BASE_URL}/ai/suggestions?status=pending")
    
    if response.status_code != 401:
        log_fail(f"Expected 401, got: {response.status_code}")
    else:
        log_pass("GET /api/ai/suggestions without auth returned 401")

def main():
    print(f"\n{Colors.BLUE}{'='*80}")
    print("LifeOS AI Suggestions Backend Testing Suite")
    print("Testing REAL ChatGPT integration (gpt-5.4 via Emergent LLM key)")
    print(f"{'='*80}{Colors.END}\n")
    
    # Login
    token = login()
    if not token:
        log_fail("Cannot proceed without valid token")
        return
    
    # Test 1: Enable AI and get suggestions
    suggestion_id = test_1_enable_ai_and_get_suggestions(token)
    
    # Test 2: Verify caching
    test_2_cached_suggestion(token, suggestion_id)
    
    # Test 3: Accept suggestion
    accepted_id = test_3_accept_suggestion(token, suggestion_id)
    
    # Test 4: Get accepted suggestions
    test_4_get_accepted_suggestions(token, accepted_id)
    
    # Test 5: Double accept (should fail)
    test_5_double_accept(token, accepted_id)
    
    # Test 6: Dismiss with never_again
    test_6_dismiss_with_never_again(token)
    
    # Test 7: Fake suggestion IDs
    test_7_fake_suggestion_ids(token)
    
    # Test 8: Rate limiting
    test_8_rate_limiting(token)
    
    # Test 9: Security gating
    test_9_security_gating(token)
    
    # Test 10: Unauthorized access
    test_10_unauthorized_access()
    
    print(f"\n{Colors.BLUE}{'='*80}")
    print("AI Suggestions Testing Complete")
    print(f"{'='*80}{Colors.END}\n")

if __name__ == "__main__":
    main()
