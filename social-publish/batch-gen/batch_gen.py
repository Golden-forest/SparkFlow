#!/usr/bin/env python3
"""Batch animation generator for SimCanvas via API.

Flow per topic: create conversation -> send prompt (returns design gate) ->
send 采纳 (blocks while animation generates, minutes) -> log result.
State persisted to state.json so the run is resumable.
"""
import json
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx

BASE = "http://stu25.space.aiec.wflaiedu.com"
HERE = Path(__file__).parent
COOKIE = json.load(open("/Users/hl/.claude/skills/publish-simvideo/secrets.json"))["simcanvas_session"]
PARALLEL = 3
GEN_TIMEOUT = 1800  # generation can take many minutes
STATE = HERE / "state.json"
LOG = HERE / "run.log"


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"done": {}, "failed": {}, "running": []}


def save_state(s: dict) -> None:
    STATE.write_text(json.dumps(s, ensure_ascii=False, indent=1))


def api(client: httpx.Client, method: str, path: str, json_body=None, timeout=120.0):
    r = client.request(method, BASE + path, json=json_body, timeout=timeout)
    r.raise_for_status()
    return r.json() if r.content else {}


def run_topic(client: httpx.Client, topic: dict) -> dict:
    conv = api(client, "POST", "/api/conversations", {"title": topic["title"]})
    cid = conv["id"]
    req_id = uuid.uuid4().hex
    # step 1: send prompt -> design gate (fast)
    resp = api(client, "POST", f"/api/conversations/{cid}/messages",
               {"content": topic["prompt"], "attachment_ids": [], "client_request_id": req_id})
    phase = resp.get("phase")
    if phase != "awaiting_confirmation":
        return {"ok": False, "stage": "gate", "phase": phase, "detail": str(resp)[:500]}
    # step 2: 采纳 -> nginx may cut the connection with 504 while the backend
    # keeps working; mimic the frontend: poll the conversation until a
    # generation appears (frontend does the same, see App.tsx submit()).
    t0 = time.time()
    try:
        api(client, "POST", f"/api/conversations/{cid}/messages",
            {"content": "采纳", "attachment_ids": [], "client_request_id": uuid.uuid4().hex},
            timeout=GEN_TIMEOUT)
    except httpx.HTTPStatusError as e:
        if e.response.status_code not in (502, 504):
            raise
    while time.time() - t0 < GEN_TIMEOUT:
        time.sleep(10)
        try:
            detail = api(client, "GET", f"/api/conversations/{cid}")
        except httpx.HTTPError:
            continue
        gens = detail.get("generations") or []
        last_status = (detail.get("messages") or [{}])[-1].get("status", "")
        if gens and gens[0].get("version", 0) >= 1:
            minutes = round((time.time() - t0) / 60, 1)
            return {"ok": True, "conversation_id": cid, "generation_id": gens[0]["id"],
                    "version": gens[0]["version"], "minutes": minutes}
        if last_status == "error":
            return {"ok": False, "stage": "generate", "detail": "message status=error"}
    return {"ok": False, "stage": "timeout", "detail": f"no generation after {GEN_TIMEOUT}s"}


def worker(topic: dict) -> tuple[str, dict]:
    try:
        with httpx.Client(headers={"Cookie": f"simcanvas_session={COOKIE}"}) as c:
            return topic["id"], run_topic(c, topic)
    except Exception as e:  # noqa: BLE001
        return topic["id"], {"ok": False, "stage": "exception", "detail": repr(e)[:500]}


def main() -> None:
    topics = json.loads((HERE / "topics.json").read_text())
    state = load_state()
    queue = [t for t in topics if t["id"] not in state["done"] and t["id"] not in state["failed"]]
    log(f"start: {len(queue)} to run, parallel={PARALLEL}")
    with ThreadPoolExecutor(max_workers=PARALLEL) as ex:
        futs = {ex.submit(worker, t): t for t in queue}
        for fut in as_completed(futs):
            t = futs[fut]
            tid, res = fut.result()
            if res.get("ok"):
                state["done"][tid] = res
                log(f"✅ {t['title']} ({res['minutes']}min) gen={res['generation_id']}")
            else:
                state["failed"][tid] = res
                log(f"❌ {t['title']} at {res.get('stage')}: {res.get('detail', '')[:200]}")
            save_state(state)
    log(f"finish: {len(state['done'])} done, {len(state['failed'])} failed")


if __name__ == "__main__":
    main()
