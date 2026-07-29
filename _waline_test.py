"""Test Waline API with different timestamp fields."""
import json, requests, time

API = "https://waline.pgoj.top/comment"

# Test 1: Use `time` field (Unix ms) instead of createdAt
print("=== Test 1: with 'time' field (Unix ms) ===")
test_comment = {
    "comment": "TEST-DELETE-ME-时间戳测试1",
    "nick": "test",
    "mail": "test@test.com",
    "url": "/guestbook/",
    "time": 1768553566000,  # 2026-01-16T06:52:46.000Z in Unix ms
}
resp = requests.post(API, json=test_comment,
    headers={"Content-Type": "application/json", "User-Agent": "WalineImport/1.0"})
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
if data.get("data"):
    print(f"  time:     {data['data'].get('time')}")
    print(f"  createdAt: {data['data'].get('createdAt')}")
    print(f"  insertedAt: {data['data'].get('insertedAt')}")
    new_id = data["data"]["objectId"]
else:
    new_id = None

# Test 2: Try both time and createdAt
print("\n=== Test 2: with both 'time' and 'createdAt' ===")
test_comment2 = {
    "comment": "TEST-DELETE-ME-时间戳测试2",
    "nick": "test2",
    "mail": "test2@test.com",
    "url": "/guestbook/",
    "time": 1768553566000,
    "createdAt": "2026-01-16T06:52:46.000Z",
}
resp2 = requests.post(API, json=test_comment2,
    headers={"Content-Type": "application/json", "User-Agent": "WalineImport/1.0"})
print(f"Status: {resp2.status_code}")
data2 = resp2.json()
print(f"Response: {json.dumps(data2, indent=2, ensure_ascii=False)}")
if data2.get("data"):
    print(f"  time:      {data2['data'].get('time')}")
    print(f"  createdAt: {data2['data'].get('createdAt')}")
    print(f"  insertedAt: {data2['data'].get('insertedAt')}")

# Summary
print("\n=== SUMMARY ===")
print("Use 'time' field in import: ", end="")
if new_id:
    expected_ts = 1768553566000
    actual_ts = data["data"].get("time")
    if actual_ts == expected_ts:
        print("✅ Works! Timestamp preserved.")
    else:
        print(f"❌ Ignored. Got {actual_ts}, expected {expected_ts}")
