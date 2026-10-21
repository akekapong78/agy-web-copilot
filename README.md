# AGY Web Copilot 🚀

**AGY Web Copilot** is an AI-powered Chrome Side Panel Extension that connects your browser with **Antigravity (AGY)**. It allows you to chat naturally with AI to inspect, read, analyze, and automate form filling or workflows directly inside any web page.

---

## Key Features

- 📑 **Target Tab Selection:** Choose any specific tab in your browser to inspect or automate while you continue working in other tabs.
- 👁️ **Visual Inspection (Ctrl+V):** Paste screenshots directly into the chat to let AGY visually compare the page with your desired design or check for missing inputs.
- 📋 **Semantic Table & Form Automation:** Intelligently maps table rows, KPI criteria, and form inputs without running unsafe JavaScript evals.
- 🛡️ **100% Content Security Policy (CSP) Safe:** Directly manipulates DOM inputs natively—fully compatible with strict enterprise intranets (e.g., PEA PMS, D-Doc, SIMS).
- ⚡ **Dual-Mode Architecture:**
  - **AGY CLI Mode (Default):** Uses your local AGY quota on your computer for free.
  - **Direct Gemini API Mode (Fallback):** Can run standalone without Python/CLI using a Google Gemini API Key.

---

## 🚀 Quick Start Guide (For Users)

### Step 1: Install Antigravity (AGY) CLI
If you don't have AGY CLI installed yet:
1. Open PowerShell and follow the [Antigravity Installation Guide](https://github.com/google-deepmind/antigravity).
2. Run `agy install` and log in to authenticate your account.
3. Test that it works by typing `agy --version` in terminal.

---

### Step 2: Run the Local Bridge Service
The bridge connects your Chrome Extension to your local AGY CLI quota:

1. Clone or download this repository.
2. In the `bridge` folder, install requirements (only needed once):
   ```bash
   pip install fastapi uvicorn pydantic
   ```
3. Run the bridge:
   - **On Windows:** Double-click `bridge/start_bridge.bat`
   - **Via Terminal:** `python bridge/bridge_server.py`
4. The bridge will start at `http://127.0.0.1:8765` and display `AGY Path: ...`.

---

### Step 3: Install the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **"Developer mode"** in the top right corner.
3. Click **"Load unpacked"** and select the `extension` folder from this repo.
4. Click the Side Panel icon in Chrome's top bar and select **AGY Web Copilot**.
5. You should see a green dot: **`AGY Online (New Session)`**. You are ready to go!

---

## 🌟 Standalone Mode (No Python / No AGY CLI Needed)
If a user or colleague wants to use the extension without installing Python or AGY CLI:
1. Install the extension in Chrome.
2. In the Side Panel, click the **⚙️ Settings** icon.
3. Enter a free **Google Gemini API Key** (obtainable from [Google AI Studio](https://aistudio.google.com/app/apikey)).
4. The extension will automatically switch to **Direct API Mode** and execute page actions without any background service!

---

## 🔒 Security & Privacy Notice
- No user credentials, passwords, or session tokens are stored in the code.
- All automation actions require human confirmation via the **"🚀 กดดำเนินการลงในเว็บทันที"** button before executing.
- Screenshots pasted via `Ctrl+V` are kept strictly on your local machine (`Downloads` folder) and analyzed locally.

---

## License
MIT License.
