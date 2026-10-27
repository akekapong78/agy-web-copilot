import os
import sys
import json
import time
import re
import subprocess
import shutil
import threading
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

app = FastAPI(title="AGY Web Copilot Bridge v5")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Find AGY binary across Windows, macOS, and Linux
AGY_CANDIDATES = [
    shutil.which("agy"),
    shutil.which("agy.exe"),
    os.path.expanduser("~/.local/bin/agy"),
    os.path.expanduser("~/bin/agy"),
    "/usr/local/bin/agy",
    "/opt/homebrew/bin/agy",
    os.path.expandvars(r"%LOCALAPPDATA%\agy\bin\agy.exe"),
]
AGY_PATH = next((p for p in AGY_CANDIDATES if p and os.path.exists(p)), shutil.which("agy") or shutil.which("agy.exe"))
BRAIN_DIR = os.path.expanduser(r"~/.gemini/antigravity-cli/brain")

active_session_id: Optional[str] = None
session_lock = threading.Lock()
proc_lock = threading.Lock()

DOWNLOADS_DIR = os.path.join(os.path.expanduser("~"), "Downloads")

class ChatRequest(BaseModel):
    prompt: str
    context: Dict[str, Any]
    image: Optional[str] = None # Base64 Data URL (data:image/png;base64,...)
    sessionId: Optional[str] = None
    resetSession: Optional[bool] = False
    lang: Optional[str] = "en" # "th" or "en"

def detect_new_session_id(known_before: set, timeout: float = 12.0) -> Optional[str]:
    deadline = time.time() + timeout
    uuid_pattern = re.compile(r"^[0-9a-fA-F-]{36}$")
    while time.time() < deadline:
        if os.path.exists(BRAIN_DIR):
            current = set(os.listdir(BRAIN_DIR))
            new_dirs = current - known_before
            for d in new_dirs:
                if uuid_pattern.match(d) and os.path.isdir(os.path.join(BRAIN_DIR, d)):
                    return d
        time.sleep(0.4)
    return None

def clean_json_text(text: str) -> str:
    """Safely unwrap markdown codeblock from LLM JSON response without mangling internal backticks"""
    t = text.strip()
    if t.startswith("```json"):
        t = re.sub(r"^```json\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    elif t.startswith("```"):
        t = re.sub(r"^```\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()

@app.get("/health")
def health():
    has_agy = os.path.exists(AGY_PATH) if AGY_PATH else False
    return {
        "status": "ok",
        "has_agy": has_agy,
        "active_session_id": active_session_id
    }

@app.get("/sessions")
def get_recent_sessions(offset: int = 0, limit: int = 10):
    """Retrieve paginated AGY sessions from ~/.gemini/antigravity-cli/brain"""
    import datetime
    uuid_pattern = re.compile(r"^[0-9a-fA-F-]{36}$")
    sessions = []
    has_more = False
    total_count = 0
    if os.path.exists(BRAIN_DIR):
        try:
            dirs = [d for d in os.listdir(BRAIN_DIR) if uuid_pattern.match(d) and os.path.isdir(os.path.join(BRAIN_DIR, d))]
            dirs.sort(key=lambda x: os.path.getmtime(os.path.join(BRAIN_DIR, x)), reverse=True)
            total_count = len(dirs)
            target_slice = dirs[offset:offset + limit]
            has_more = (offset + limit) < total_count

            for d in target_slice:
                path = os.path.join(BRAIN_DIR, d)
                mtime = os.path.getmtime(path)
                time_str = datetime.datetime.fromtimestamp(mtime).strftime("%m/%d %H:%M")
                t_file = os.path.join(path, ".system_generated", "logs", "transcript.jsonl")
                title = "New conversation"
                if os.path.exists(t_file):
                    try:
                        with open(t_file, "r", encoding="utf-8", errors="ignore") as f:
                            for line in f:
                                entry = json.loads(line)
                                if entry.get("type") == "USER_INPUT" and entry.get("content"):
                                    raw = entry["content"].strip()
                                    # Strip tags
                                    raw = re.sub(r"<\/?USER_REQUEST>", "", raw)
                                    m_req = re.search(r"\[USER REQUEST\]\s*(.*)", raw, re.DOTALL)
                                    if m_req:
                                        raw = m_req.group(1).strip()
                                    elif "[Telegram Remote Client" in raw:
                                        raw = re.sub(r"\[Telegram Remote Client[^\]]*\]", "", raw).strip()
                                    raw = re.sub(r"\s+", " ", raw)
                                    if raw:
                                        title = raw[:42] + ("..." if len(raw) > 42 else "")
                                    break
                    except Exception:
                        pass
                sessions.append({
                    "id": d,
                    "title": title,
                    "time": time_str,
                    "mtime": mtime
                })
        except Exception as e:
            print(f"Error reading sessions: {e}")
    return {
        "active_session_id": active_session_id,
        "sessions": sessions,
        "total": total_count,
        "offset": offset,
        "has_more": has_more
    }

@app.post("/set_session")
def set_active_session(payload: Dict[str, Any]):
    global active_session_id
    new_sess = payload.get("sessionId")
    with session_lock:
        active_session_id = new_sess if new_sess else None
    return {"status": "ok", "active_session_id": active_session_id}

@app.post("/reset")
def reset_session():
    global active_session_id
    with session_lock:
        active_session_id = None
    return {"status": "ok", "message": "Session reset"}

@app.post("/chat")
def chat(req: ChatRequest):
    global active_session_id

    if req.resetSession:
        with session_lock:
            active_session_id = None

    has_agy = os.path.exists(AGY_PATH) if AGY_PATH else False
    if not has_agy:
        raise HTTPException(
            status_code=400,
            detail="AGY CLI is not found on this machine."
        )

    page_ctx = req.context or {}
    title = page_ctx.get("title", "")
    url = page_ctx.get("url", "")
    tables = page_ctx.get("tables", [])
    standalone = page_ctx.get("standaloneInputs", [])

    # Format structured table context without slicing away critical score/status columns
    structured_tables_text = ""
    total_rows = 0
    for tbl in tables:
        t_idx = tbl.get("tableIndex", 1)
        headers = tbl.get("headers", [])
        structured_tables_text += f"\n[TABLE #{t_idx}] Columns: {' | '.join(headers)}\n"
        for r in tbl.get("rows", []):
            if total_rows >= 35: # Limit to 35 rows
                structured_tables_text += "  ... (remaining rows omitted)\n"
                break
            r_num = r.get("row")
            # Prefer structured cell array to keep every column intact
            cells = r.get("cells")
            if cells and isinstance(cells, list):
                row_str = " | ".join(cells)
            else:
                row_str = r.get("textSummary", "")
            
            inputs_info = ", ".join([f"id={inp.get('agyId')}({inp.get('value','')})" for inp in r.get("inputs", [])[:6]])
            structured_tables_text += f"  Row {r_num}: {row_str} -> Buttons/Inputs: [{inputs_info}]\n"
            total_rows += 1

    image_context_note = ""
    if req.image and "base64," in req.image:
        try:
            import base64
            import uuid
            header, encoded = req.image.split("base64,", 1)
            ext = ".png"
            if "image/jpeg" in header or "image/jpg" in header:
                ext = ".jpg"
            img_filename = f"copilot_paste_{uuid.uuid4().hex[:8]}{ext}"
            img_path = os.path.join(DOWNLOADS_DIR, img_filename)
            with open(img_path, "wb") as f_img:
                f_img.write(base64.b64decode(encoded))
            norm_img_path = img_path.replace("\\", "/")
            image_context_note = f"\n[ATTACHED USER SCREENSHOT/IMAGE]: {norm_img_path}\nPlease inspect this image to verify whether the webpage matches the user expectations."
        except Exception as e:
            image_context_note = f"\n(Attached image save error: {e})"

    lang_inst = "Respond in natural English clearly." if req.lang == "en" else "Respond in natural Thai clearly."

    # Keep prompt under 6,500 characters safely within Windows CommandLine limits
    user_payload_prompt = f"""[WEB STRUCTURE]
URL: {url}
Title: {title}
{structured_tables_text[:4200]}
Standalone: {json.dumps(standalone[:10], ensure_ascii=False)}
{image_context_note}

[USER REQUEST]
{req.prompt}

[STRICT INSTRUCTIONS]
1. Read the table columns and rows carefully. Do not claim data is missing if it appears in any column or cell.
2. If the user asks for scores (e.g. คะแนนประเมิน, คะแนนปัจจุบัน, สรุปผลทั้งปี), check each person's row and list their name along with all scores shown in the table.
3. Return ONLY a valid JSON object.
4. Do NOT write code or customScript (Content Security Policy forbids scripts). Put every single field to fill into "actions".
{lang_inst}
Schema:
{{
  "reply": "{'Explain in English clearly with the detailed answer and breakdown' if req.lang == 'en' else 'สรุปตอบเป็นภาษาไทยให้ละเอียด ชัดเจน แยกแยะข้อมูลรายบุคคลตามตาราง'}",
  "actions": [
    {{ "type": "fill", "agyId": "agy-8", "value": "100" }}
  ]
}}
"""

    with session_lock:
        current_sess = active_session_id

    known_before = set(os.listdir(BRAIN_DIR)) if os.path.exists(BRAIN_DIR) else set()

    cmd = [
        AGY_PATH,
        "--dangerously-skip-permissions",
        "--disable-slash-commands"
    ]

    if current_sess:
        cmd.extend(["--conversation", current_sess, "-p", user_payload_prompt])
    else:
        cmd.extend(["-p", user_payload_prompt])

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    proc = None

    try:
        with proc_lock:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env
            )

        # Background session ID tracker
        if not current_sess:
            def _track_new_sess():
                global active_session_id
                nid = detect_new_session_id(known_before)
                if nid:
                    with session_lock:
                        if active_session_id is None:
                            active_session_id = nid
            threading.Thread(target=_track_new_sess, daemon=True).start()

        # Stream output lines reliably like bot.py
        output_chunks = []
        for line in proc.stdout:
            output_chunks.append(line)

        proc.wait(timeout=120)

        # Check full transcript in brain if stdout was truncated or empty
        answer_text = "".join(output_chunks).strip()

        with session_lock:
            final_sess = active_session_id

        if final_sess:
            full_file = os.path.join(BRAIN_DIR, final_sess, ".system_generated", "logs", "transcript_full.jsonl")
            if os.path.exists(full_file):
                try:
                    with open(full_file, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    for line in reversed(lines):
                        line = line.strip()
                        if not line:
                            continue
                        data = json.loads(line)
                        if data.get("type") == "PLANNER_RESPONSE" and data.get("content"):
                            answer_text = data.get("content")
                            break
                except Exception:
                    pass

        if not answer_text:
            raise HTTPException(status_code=504, detail="No response received from AGY.")

        cleaned = clean_json_text(answer_text)

        try:
            parsed = json.loads(cleaned)
            parsed["sessionId"] = active_session_id
            return parsed
        except Exception as e:
            # If AGY answered in pure text or reasoning
            return {
                "reply": answer_text,
                "actions": [],
                "sessionId": active_session_id
            }

    except subprocess.TimeoutExpired:
        if proc and proc.poll() is None:
            proc.kill()
        raise HTTPException(status_code=504, detail="AGY CLI process timed out (120s).")
    except Exception as e:
        if proc and proc.poll() is None:
            proc.kill()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Ensure stdout/stderr handles UTF-8 on Windows command prompts
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    print("=" * 60)
    print("AGY Web Copilot Bridge v5 (Stable Stream & Full JSON Safe)")
    print(f"AGY Path: {AGY_PATH}")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8765)
