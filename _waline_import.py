"""
Waline comment importer - clean, single-run version.

Strategy:
1. Import top-level comments first (no pid), track old_id → new_id
2. Import replies with corrected pid
3. Write progress to _waline_import.log
4. Record failed comments to _waline_failed.json for retry
"""
import json, time, sys, requests

API = "https://waline.pgoj.top/comment"
LOG_FILE = "E:/blog/_waline_import.log"
FAILED_FILE = "E:/blog/_waline_failed.json"
JSON_FILE = "E:/blog/_waline_import.json"
TIMEOUT = 15
DELAY = 0.2

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")
        f.flush()

# Clear log
with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("")

# Load data
with open(JSON_FILE, "r", encoding="utf-8") as f:
    comments = json.load(f)

top_level = [c for c in comments if not c.get("pid")]
replies = [c for c in comments if c.get("pid")]

log(f"=== Waline Comment Import ===")
log(f"Total: {len(comments)} | Top-level: {len(top_level)} | Replies: {len(replies)}")

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "WalineImport/1.0"
}

id_map = {}
failed_list = []
total_ok = 0
total_fail = 0

def import_one(c, pid_override=None):
    """Import a single comment. Returns new Waline objectId or None."""
    payload = {
        "comment": c["comment"],
        "nick": c["nick"],
        "mail": c.get("mail", ""),
        "link": c.get("link", ""),
        "ua": c.get("ua", ""),
        "url": c.get("url", "/"),
    }
    if pid_override:
        payload["pid"] = pid_override

    try:
        r = requests.post(API, json=payload, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code in (200, 201):
            d = r.json()
            if d.get("errno") == 0:
                return d["data"]["objectId"]
            else:
                raise Exception(f"API err: {d.get('errmsg')}")
        else:
            raise Exception(f"HTTP {r.status_code}: {r.text[:100]}")
    except Exception as e:
        raise e

# Step 1: Top-level
log("--- Step 1: Top-level ---")
for i, c in enumerate(top_level):
    old_id = c["objectId"]
    try:
        new_id = import_one(c)
        id_map[old_id] = new_id
        total_ok += 1
    except Exception as e:
        log(f"  FAIL #{i+1} {old_id}: {str(e)[:80]}")
        failed_list.append(c)
        total_fail += 1
    if (i + 1) % 20 == 0:
        log(f"  [{i+1}/{len(top_level)}] ok={total_ok} fail={total_fail}")
    time.sleep(DELAY)

log(f"Top-level done: {total_ok} ok, {total_fail} fail")

# Step 2: Replies
log("--- Step 2: Replies ---")
reply_ok = 0
reply_fail = 0
reply_skip = 0

for i, c in enumerate(replies):
    old_id = c["objectId"]
    old_pid = c["pid"]
    
    if old_pid not in id_map:
        log(f"  SKIP #{i+1} {old_id}: parent {old_pid} unmapped")
        reply_skip += 1
        failed_list.append(c)
        continue

    try:
        new_id = import_one(c, pid_override=id_map[old_pid])
        id_map[old_id] = new_id
        reply_ok += 1
    except Exception as e:
        log(f"  FAIL reply #{i+1} {old_id}: {str(e)[:80]}")
        reply_fail += 1
        failed_list.append(c)
    
    if (i + 1) % 20 == 0:
        log(f"  [{i+1}/{len(replies)}] ok={reply_ok} fail={reply_fail} skip={reply_skip}")
    time.sleep(DELAY)

# Summary
log(f"\n{'='*60}")
log(f"IMPORT FINISHED")
log(f"Top-level: {total_ok} ok, {total_fail} fail")
log(f"Replies:   {reply_ok} ok, {reply_fail} fail, {reply_skip} skip")
log(f"Total ok:  {total_ok + reply_ok}")
log(f"Total fail/skip: {len(failed_list)}")
log(f"ID mappings: {len(id_map)}")

# Save failed
if failed_list:
    with open(FAILED_FILE, "w", encoding="utf-8") as f:
        json.dump(failed_list, f, ensure_ascii=False, indent=2)
    log(f"Failed comments saved to {FAILED_FILE}")

log(f"\nNext: Login to https://waline.pgoj.top/ui/ to approve all comments (status=waiting)")
