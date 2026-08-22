#!/usr/bin/env python3
"""Batch animation generator for SimCanvas via API.

Flow per topic: create conversation -> send prompt (returns design gate) ->
send 采纳 (blocks while animation generates, minutes) -> log result.
State persisted to state.json so the run is resumable.
"""
import json
import shutil
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


# Injected right after <head>: when the page is loaded as a gallery thumbnail
# (?preview=1, src/pages/Home.tsx LazyPreview), pin devicePixelRatio to 1 so the
# 1280x800 preview iframe doesn't render a 2560x1600 Retina canvas per card.
PREVIEW_FLAG = (
    '<script>if(location.search.indexOf("preview=1")!==-1)'
    'Object.defineProperty(window,"devicePixelRatio",{get:function(){return 1}})</script>'
)


def inject_preview_flag(html: str) -> str:
    if PREVIEW_FLAG in html:
        return html
    if "<head>" in html:
        return html.replace("<head>", "<head>" + PREVIEW_FLAG, 1)
    return PREVIEW_FLAG + html


def pull_featured() -> None:
    """Sync featured animations into the project's public/simcanvas/ gallery.

    NOTE: the platform's /share/<id> route looks public (200) but its content
    requires a 智教耘 login client-side, so animations cannot be hotlinked —
    we download the preview HTML (with our session cookie) and serve it locally.

    Maps conversation ids (from state.json) against the gallery API, takes each
    conversation's selected (latest) generation, downloads its preview HTML and
    writes public/simcanvas/<topic-id>/{index.html,meta.json}.
    """
    topics = json.loads((HERE / "topics.json").read_text())
    featured = {t["id"]: t for t in topics if t.get("featured")}
    state = load_state()
    conv2topic = {
        entry["conversation_id"]: t
        for tid, t in featured.items()
        if (entry := state["done"].get(tid))
    }
    out_root = HERE.parent.parent / "public" / "simcanvas"
    out_root.mkdir(parents=True, exist_ok=True)

    with httpx.Client(headers={"Cookie": f"simcanvas_session={COOKIE}"}) as c:
        gallery = api(c, "GET", "/api/gallery")
        pulled, skipped, done_ids = 0, 0, set()
        for conv in gallery:
            topic = conv2topic.get(conv["conversation_id"])
            if topic is None:
                skipped += 1
                continue
            gen_id = conv.get("selected_generation_id") or (conv["generations"] or [{}])[0].get("id")
            if not gen_id:
                log(f"⚠️ {topic['title']}: no generation in gallery, skipped")
                continue
            r = c.get(f"{BASE}/api/generations/{gen_id}/preview", timeout=60)
            r.raise_for_status()
            target = out_root / topic["id"]
            target.mkdir(parents=True, exist_ok=True)
            (target / "index.html").write_text(inject_preview_flag(r.text), encoding="utf-8")
            gens = conv.get("generations") or [{}]
            (target / "meta.json").write_text(json.dumps({
                "title": topic["title"],
                "category": topic.get("category", ""),
                "generation_id": gen_id,
                "version": max(g.get("version", 1) for g in gens),
                "updated_at": conv.get("conversation_updated_at", ""),
            }, ensure_ascii=False, indent=1), encoding="utf-8")
            pulled += 1
            done_ids.add(topic["id"])
            log(f"⬇️ {topic['title']} -> public/simcanvas/{topic['id']}/ (gen={gen_id[:8]})")
        missing = [t["title"] for t in featured.values() if t["id"] not in done_ids]
        if missing:
            log(f"⚠️ {len(missing)} featured topics not found in gallery: {', '.join(missing)}")
    log(f"pull finish: {pulled} synced, {skipped} gallery items not featured")


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--pull":
        pull_featured()
        return
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


def featured_list() -> list[dict]:
    """Featured topics in a stable order (sorted by id) — the gallery order.

    Both --list and --remove resolve numbers against THIS order, so "delete
    #34" means the same thing no matter who runs it or when.
    """
    topics = json.loads((HERE / "topics.json").read_text())
    return sorted((t for t in topics if t.get("featured")), key=lambda t: t["id"])


def print_list() -> None:
    for i, t in enumerate(featured_list(), start=1):
        print(f"{i:3d}. {t['id']}  {t['title']}")


def resolve_ids(args: list[str]) -> list[str]:
    """Accept topic ids directly, or gallery numbers from --list (e.g. '34')."""
    by_number = {str(i): t["id"] for i, t in enumerate(featured_list(), start=1)}
    ids, unknown = [], []
    for arg in args:
        if arg in by_number:
            ids.append(by_number[arg])
        else:
            unknown.append(arg)
    # pass through anything that looks like a real topic id; error on the rest
    all_ids = {t["id"] for t in json.loads((HERE / "topics.json").read_text())}
    resolved = [a for a in unknown if a in all_ids]
    bad = [a for a in unknown if a not in all_ids]
    if bad:
        raise SystemExit(f"❌ unknown ids/numbers: {bad} — run --list to see valid numbers")
    return ids + resolved


def remove_topics(ids: list[str]) -> None:
    """Delete animations everywhere so a later --pull can't resurrect them.

    For each topic id: drop the entry from topics.json (that's what --pull
    reads to decide what to sync), delete public/simcanvas/<id>/ (gallery
    files + meta.json), and prune state.json so the topic is fully forgotten.
    """
    topics_file = HERE / "topics.json"
    topics = json.loads(topics_file.read_text())
    remaining = [t for t in topics if t["id"] not in ids]
    removed = [t for t in topics if t["id"] in ids]
    if not removed:
        log(f"⚠️ nothing removed: no topic ids matched {ids}")
        return
    # indent=1 matches the file's existing style (see save_state) so a removal
    # doesn't show up as a whole-file reformat in git diff.
    topics_file.write_text(json.dumps(remaining, ensure_ascii=False, indent=1))

    state = load_state()
    for tid in ids:
        state["done"].pop(tid, None)
        state["failed"].pop(tid, None)
        state["running"] = [r for r in state.get("running", []) if r != tid]
    save_state(state)

    out_root = HERE.parent.parent / "public" / "simcanvas"
    for t in removed:
        target = out_root / t["id"]
        if target.exists():
            shutil.rmtree(target)
            files = "local files + meta.json"
        else:
            files = "no local files (never pulled)"
        log(f"🗑️ {t['title']} ({t['id']}): topics.json entry, state.json entry, {files} removed")
    log(f"remove finish: {len(removed)} removed, {len(remaining)} topics left "
        f"({sum(1 for t in remaining if t.get('featured'))} still featured)")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--list":
        print_list()
    elif len(sys.argv) > 2 and sys.argv[1] == "--remove":
        remove_topics(resolve_ids(sys.argv[2:]))
    else:
        main()
