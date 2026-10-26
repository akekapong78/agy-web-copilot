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

AGY_PATH = shutil.which("agy") or shutil.which("agy.exe") or os.path.expandvars(r"%LOCALAPPDATA%\agy\bin\agy.exe")
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

    # Format structured table context with limit to keep prompt compact and fit Windows 8191 char CLI limit
    structured_tables_text = ""
    total_rows = 0
    for tbl in tables:
        t_idx = tbl.get("tableIndex", 1)
        headers = " | ".join(tbl.get("headers", [])[:10])
        structured_tables_text += f"\n[TABLE #{t_idx}] Columns: {headers}\n"
        for r in tbl.get("rows", []):
            if total_rows >= 30: # Limit to 30 rows max
                structured_tables_text += "  ... (remaining rows omitted)\n"
                break
            r_num = r.get("row")
            summary = r.get("textSummary", "")[:120]
            inputs_info = ", ".join([f"id={inp.get('agyId')}({inp.get('value','')})" for inp in r.get("inputs", [])[:6]])
            structured_tables_text += f"  Row {r_num}: {summary} -> Inputs: {inputs_info}\n"
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

    # Keep prompt under 6,000 characters safely within Windows CommandLine limits
    user_payload_prompt = f"""[WEB STRUCTURE]
URL: {url}
Title: {title}
{structured_tables_text[:3500]}
Standalone: {json.dumps(standalone[:10], ensure_ascii=False)}
{image_context_note}

[USER REQUEST]
{req.prompt}

[STRICT INSTRUCTIONS]
Return ONLY a valid JSON object with the list of "actions".
Do NOT write code or customScript (Content Security Policy forbids scripts). Put every single field to fill into "actions".
Schema:
{{
  "reply": "Explain in Thai clearly what will be done",
  "actions": [
    {{ "type": "fill", "agyId": "agy-8", "value": "100" }},
    {{ "type": "fill", "agyId": "agy-9", "value": "5.00" }}
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
