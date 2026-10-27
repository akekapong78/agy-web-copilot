const BRIDGE_URL = "http://127.0.0.1:8765";

// DOM Elements
const chatContainer = document.getElementById("chat-container");
const promptInput = document.getElementById("prompt-input");
const btnSend = document.getElementById("btn-send");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const sessionDropdown = document.getElementById("session-dropdown");
const sessionTrigger = document.getElementById("session-trigger");
const sessionTriggerText = document.getElementById("session-trigger-text");
const sessionMenu = document.getElementById("session-menu");
const sessionList = document.getElementById("session-list");
const sessionLoadMore = document.getElementById("session-load-more");
const sessionLabel = document.getElementById("session-label");
const btnRefreshSessions = document.getElementById("btn-refresh-sessions");
const tabSelector = document.getElementById("tab-selector");
const tabLabel = document.getElementById("tab-label");
const btnRefreshTabs = document.getElementById("btn-refresh-tabs");
const btnInspect = document.getElementById("btn-inspect");
const btnRead = document.getElementById("btn-read");
const btnClear = document.getElementById("btn-clear");
const btnLang = document.getElementById("btn-lang");
const btnSettings = document.getElementById("btn-settings");
const setupModal = document.getElementById("setup-modal");
const btnCloseCfg = document.getElementById("btn-close-cfg");
const btnDownloadBat = document.getElementById("btn-download-bat");
const btnDownloadCommand = document.getElementById("btn-download-command");
const btnDownloadSh = document.getElementById("btn-download-sh");
const imgPreviewBar = document.getElementById("img-preview-bar");
const imgPreviewThumb = document.getElementById("img-preview-thumb");
const imgPreviewLabel = document.getElementById("img-preview-label");
const btnRemoveImg = document.getElementById("btn-remove-img");
const welcomeMsg = document.getElementById("welcome-msg");
const modalTitle = document.getElementById("modal-title");
const modalDesc = document.getElementById("modal-desc");
const modalStepTitle = document.getElementById("modal-step-title");
const modalSteps = document.getElementById("modal-steps");

let isBridgeOnline = false;
let currentSessionId = null;
let cachedSessions = [];
let sessionOffset = 0;
const SESSION_LIMIT = 10;
let hasMoreSessions = true;
let isLoadingSessions = false;
let attachedImageBase64 = null; // Stored base64 image from Ctrl+V
let currentLang = "en"; // "en" default for global store, "th" for Thai

// Localization Dictionary
const i18n = {
  en: {
    langButtonText: "TH",
    langButtonTitle: "Switch to Thai",
    statusChecking: "Checking Bridge...",
    statusOffline: "Bridge Offline (Click ⚙️)",
    statusOnlineNew: "AGY Online (New Session)",
    statusOnlineSession: "AGY Session",
    sessionLabel: "💬 Session:",
    sessionNew: "➕ New Conversation",
    sessionCurrentPrefix: "📌 Current: ",
    sessionRefreshTitle: "Refresh AGY recent sessions",
    sessionSelectorTitle: "Select AGY session (current on top, 10 recent below)",
    tabLabel: "🎯 Target:",
    tabActive: "📌 Active Tab",
    tabActiveBadge: " (active)",
    tabRefreshTitle: "Refresh open tabs",
    tabSelectorTitle: "Select browser tab for AI to inspect and automate",
    btnInspect: "🔍 Inspect Form",
    btnRead: "📖 Read Page",
    btnClear: "🧹 Clear Chat",
    btnSettingsTitle: "Setup & Guide",
    welcomeHtml: `Hello! I'm <b>AGY Web Copilot</b> powered by your local AGY quota.<br>Chat with me to inspect web pages, analyze forms, or auto-fill inputs instantly.`,
    imgPreviewLabel: "Image attached (Ctrl+V)",
    btnRemoveImgTitle: "Remove image",
    inputPlaceholder: "Type instruction or paste image (Ctrl+V)...",
    btnSend: "Send",
    modalTitle: "🚀 Connecting to AGY CLI",
    modalDesc: "This extension uses free AI quota via <b>Antigravity (AGY)</b> running locally on your computer.",
    modalStepTitle: "Quick Start Guide:",
    modalStepsHtml: `
      <li>Install <b>AGY CLI</b> (Windows: <code>irm ... | iex</code> / macOS: <code>curl -fsSL ... | bash</code>)</li>
      <li>Download launcher script below: <b>start_bridge.bat</b> (Windows), <b>start_bridge.command</b> (macOS), or <b>start_bridge.sh</b> (Linux)</li>
      <li>Run the script to connect AGY CLI (keep terminal open while using extension)</li>
    `,
    btnDownloadBat: "🪟 Windows (.bat)",
    btnDownloadCommand: "🍎 macOS (.command)",
    btnDownloadSh: "🐧 Linux (.sh)",
    btnCloseCfg: "Close",
    resetSuccessMsg: "🧹 Chat history cleared and new session started.",
    sessionSwitchedMsg: (id) => `🔄 Switched to AGY session: <code>${id.substring(0, 8)}</code>`,
    inspectError: "❌ Unable to inspect target page.",
    inspectFound: (n) => `📋 <b>Found ${n} form elements on page:</b><br>`,
    inspectNoLabel: "no label",
    inspectMore: (n) => `<i>...and ${n} more elements</i>`,
    readPrompt: "Summarize the key information and layout of this webpage.",
    analyzingWait: "🧠 AGY is analyzing page context and image...",
    cannotReadPage: "❌ Unable to read target tab (check if tab is still open and not chrome://)",
    bridgeOfflineAlert: `
      ❌ <b>AGY Bridge is not connected</b><br><br>
      1. Click <b>⚙️</b> above to download <code>start_bridge.bat</code><br>
      2. Double-click <code>start_bridge.bat</code> to connect AGY CLI, then try again.
    `,
    detectedActions: (n) => `<b>⚙️ Form detected with ${n} actions ready:</b><br>`,
    detectedScript: `<b>⚡ Automation actions prepared for this page:</b><br>`,
    moreActions: (n) => `<i>...and ${n} more actions</i><br>`,
    btnApplyActions: "🚀 Apply Actions to Page Now",
    actionRunning: "Applying actions...",
    actionDone: "✅ Completed successfully!",
    actionError: (err) => `❌ Error: ${err}`,
    imageAttachedPlaceholder: "(Image sent)"
  },
  th: {
    langButtonText: "EN",
    langButtonTitle: "สลับเป็นภาษาอังกฤษ",
    statusChecking: "กำลังตรวจสอบ Bridge...",
    statusOffline: "Bridge Offline (คลิก ⚙️ เชื่อมต่อ)",
    statusOnlineNew: "AGY Online (New Session)",
    statusOnlineSession: "AGY Session",
    sessionLabel: "💬 Session:",
    sessionNew: "➕ เปิดบทสนทนาใหม่",
    sessionCurrentPrefix: "📌 กำลังใช้อยู่: ",
    sessionRefreshTitle: "รีเฟรช 10 เซสชันล่าสุดของ AGY",
    sessionSelectorTitle: "เลือก AGY session (เซสชันปัจจุบันอยู่บนสุด, ต่อด้วย 10 ล่าสุด)",
    tabLabel: "🎯 เป้าหมาย:",
    tabActive: "📌 แท็บปัจจุบัน (Active Tab)",
    tabActiveBadge: " (กำลังเปิด)",
    tabRefreshTitle: "รีเฟรชรายชื่อแท็บ",
    tabSelectorTitle: "เลือกแท็บที่ต้องการให้ AI ควบคุม",
    btnInspect: "🔍 สแกนฟอร์มหน้าเว็บ",
    btnRead: "📖 สรุปเนื้อหาหน้านี้",
    btnClear: "🧹 ล้างแชท",
    btnSettingsTitle: "ตั้งค่าและคู่มือ",
    welcomeHtml: `สวัสดีครับ! ผมคือ <b>AGY Web Copilot</b> ที่เชื่อมกับ AGY Quota ของคุณ<br>คุณสามารถแชทสั่งให้ผมอ่านหน้าเว็บ วิเคราะห์ หรือกรอกข้อมูลลงฟอร์มได้เลยครับ`,
    imgPreviewLabel: "แนบรูปภาพแล้ว (Ctrl+V)",
    btnRemoveImgTitle: "ยกเลิกรูปภาพ",
    inputPlaceholder: "พิมพ์สั่งงาน หรือกด Ctrl+V วางรูปภาพ...",
    btnSend: "ส่ง",
    modalTitle: "🚀 การเชื่อมต่อกับ AGY CLI",
    modalDesc: "Extension นี้ใช้โควต้า AI จาก <b>Antigravity (AGY)</b> ฟรีบนเครื่องของคุณ",
    modalStepTitle: "วิธีเริ่มใช้งาน:",
    modalStepsHtml: `
      <li>ติดตั้ง <b>AGY CLI</b> (Windows: PowerShell / macOS: Terminal)</li>
      <li>ดาวน์โหลดไฟล์รัน Bridge ด้านล่าง: <b>start_bridge.bat</b> (Windows), <b>start_bridge.command</b> (macOS ดับเบิลคลิกได้ทันที), หรือ <b>start_bridge.sh</b> (Linux)</li>
      <li>รันไฟล์เพื่อเริ่มเชื่อมต่อกับ AGY CLI (เปิดหน้าต่าง Terminal ทิ้งไว้ขณะใช้งาน)</li>
    `,
    btnDownloadBat: "🪟 Windows (.bat)",
    btnDownloadCommand: "🍎 macOS (.command)",
    btnDownloadSh: "🐧 Linux (.sh)",
    btnCloseCfg: "ปิด",
    resetSuccessMsg: "🧹 ล้างประวัติและเริ่ม Session ใหม่เรียบร้อยแล้วครับ",
    sessionSwitchedMsg: (id) => `🔄 สลับไปสนทนาต่อใน Session: <code>${id.substring(0, 8)}</code>`,
    inspectError: "❌ ไม่สามารถสแกนหน้าเว็บได้",
    inspectFound: (n) => `📋 <b>พบฟอร์มและองค์ประกอบ ${n} จุด:</b><br>`,
    inspectNoLabel: "ไม่มี label",
    inspectMore: (n) => `<i>...และอีก ${n} จุด</i>`,
    readPrompt: "ช่วยสรุปเนื้อหาสำคัญและโครงสร้างของหน้านี้ให้ฟังหน่อย",
    analyzingWait: "🧠 AGY กำลังคิดวิเคราะห์บริบทและรูปภาพ...",
    cannotReadPage: "❌ ไม่สามารถอ่านหน้าเว็บเป้าหมายได้ (ตรวจสอบว่าแท็บยังเปิดอยู่และไม่ใช่หน้า chrome://)",
    bridgeOfflineAlert: `
      ❌ <b>ยังไม่ได้เชื่อมต่อ AGY Bridge บนเครื่อง</b><br><br>
      1. คลิกปุ่มฟันเฟือง <b>⚙️</b> ด้านบนเพื่อดาวน์โหลด <code>start_bridge.bat</code><br>
      2. ดับเบิลคลิกรัน <code>start_bridge.bat</code> เพื่อเริ่มเชื่อมต่อกับ AGY CLI แล้วลองใหม่อีกครั้งครับ
    `,
    detectedActions: (n) => `<b>⚙️ ตรวจพบฟอร์มและมีแผนดำเนินการ (${n} รายการ):</b><br>`,
    detectedScript: `<b>⚡ AI เตรียมชุดคำสั่งอัตโนมัติสำหรับหน้านี้เรียบร้อย:</b><br>`,
    moreActions: (n) => `<i>...และอีก ${n} รายการ</i><br>`,
    btnApplyActions: "🚀 กดดำเนินการลงในเว็บทันที",
    actionRunning: "กำลังดำเนินการ...",
    actionDone: "✅ ดำเนินการสำเร็จแล้ว!",
    actionError: (err) => `❌ ข้อผิดพลาด: ${err}`,
    imageAttachedPlaceholder: "(ส่งรูปภาพ)"
  }
};

function applyLanguage(lang) {
  currentLang = lang;
  const t = i18n[lang];

  btnLang.innerText = t.langButtonText;
  btnLang.title = t.langButtonTitle;
  sessionLabel.innerText = t.sessionLabel;
  sessionTrigger.title = t.sessionSelectorTitle;
  btnRefreshSessions.title = t.sessionRefreshTitle;
  tabLabel.innerText = t.tabLabel;
  btnRefreshTabs.title = t.tabRefreshTitle;
  tabSelector.title = t.tabSelectorTitle;
  btnInspect.innerText = t.btnInspect;
  btnRead.innerText = t.btnRead;
  btnClear.innerText = t.btnClear;
  btnSettings.title = t.btnSettingsTitle;
  imgPreviewLabel.innerText = t.imgPreviewLabel;
  btnRemoveImg.title = t.btnRemoveImgTitle;
  promptInput.placeholder = t.inputPlaceholder;
  btnSend.innerText = t.btnSend;
  
  if (welcomeMsg) {
    welcomeMsg.innerHTML = t.welcomeHtml;
  }

  modalTitle.innerText = t.modalTitle;
  modalDesc.innerHTML = t.modalDesc;
  modalStepTitle.innerText = t.modalStepTitle;
  modalSteps.innerHTML = t.modalStepsHtml;
  btnDownloadBat.innerText = t.btnDownloadBat;
  if (btnDownloadCommand) btnDownloadCommand.innerText = t.btnDownloadCommand;
  if (btnDownloadSh) btnDownloadSh.innerText = t.btnDownloadSh;
  btnCloseCfg.innerText = t.btnCloseCfg;

  updateSessionTriggerLabel();
  refreshTabList();
  checkBridge();
}

// Toggle language
btnLang.addEventListener("click", () => {
  const nextLang = currentLang === "en" ? "th" : "en";
  applyLanguage(nextLang);
  chrome.storage.local.set({ appLang: nextLang });
});

// Restore saved language or default to en
chrome.storage.local.get(["appLang"], (res) => {
  const saved = res.appLang || "en";
  applyLanguage(saved);
});

btnSettings.addEventListener("click", () => setupModal.style.display = "flex");
btnCloseCfg.addEventListener("click", () => setupModal.style.display = "none");

// One-click download start_bridge.bat from GitHub Raw
btnDownloadBat.addEventListener("click", () => {
  const batUrl = "https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/start_bridge.bat";
  const a = document.createElement("a");
  a.href = batUrl;
  a.download = "start_bridge.bat";
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// One-click download start_bridge.command for macOS
if (btnDownloadCommand) {
  btnDownloadCommand.addEventListener("click", () => {
    const cmdUrl = "https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/start_bridge.command";
    const a = document.createElement("a");
    a.href = cmdUrl;
    a.download = "start_bridge.command";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

// One-click download start_bridge.sh for macOS / Linux
if (btnDownloadSh) {
  btnDownloadSh.addEventListener("click", () => {
    const shUrl = "https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/start_bridge.sh";
    const a = document.createElement("a");
    a.href = shUrl;
    a.download = "start_bridge.sh";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

// Handle Clipboard Paste (Ctrl+V) for Images
document.addEventListener("paste", (event) => {
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  for (const item of items) {
    if (item.type.indexOf("image") !== -1) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => {
        attachedImageBase64 = e.target.result; // data:image/png;base64,...
        imgPreviewThumb.src = attachedImageBase64;
        imgPreviewBar.style.display = "flex";
      };
      reader.readAsDataURL(blob);
      event.preventDefault();
      break;
    }
  }
});

btnRemoveImg.addEventListener("click", () => {
  attachedImageBase64 = null;
  imgPreviewBar.style.display = "none";
  imgPreviewThumb.src = "";
});

// Reset Session Button
btnClear.addEventListener("click", async () => {
  chatContainer.innerHTML = "";
  currentSessionId = null;
  if (isBridgeOnline) {
    try {
      await fetch(`${BRIDGE_URL}/reset`, { method: "POST" });
    } catch (e) {}
  }
  renderSessionDropdown();
  appendMessage("msg-bot", i18n[currentLang].resetSuccessMsg);
});

// Check Bridge status
async function checkBridge() {
  const t = i18n[currentLang];
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      isBridgeOnline = true;
      statusDot.className = "status-dot online";
      if (data.active_session_id) {
        currentSessionId = data.active_session_id;
        statusText.innerText = `${t.statusOnlineSession} (${currentSessionId.substring(0, 8)})`;
      } else {
        statusText.innerText = t.statusOnlineNew;
      }
      return true;
    }
  } catch (e) {
    // offline
  }
  isBridgeOnline = false;
  statusDot.className = "status-dot";
  statusText.innerText = t.statusOffline;
  return false;
}
setInterval(checkBridge, 5000);

// Toggle Session Menu
sessionTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = sessionMenu.style.display === "block";
  if (isOpen) {
    closeSessionMenu();
  } else {
    openSessionMenu();
  }
});

function openSessionMenu() {
  sessionMenu.style.display = "block";
  if (cachedSessions.length === 0) {
    fetchRecentSessions(true);
  } else {
    renderSessionList();
  }
}

function closeSessionMenu() {
  sessionMenu.style.display = "none";
}

document.addEventListener("click", (e) => {
  if (!sessionDropdown.contains(e.target)) {
    closeSessionMenu();
  }
});

// Infinite Scroll / Lazy Loading on Session Menu
sessionMenu.addEventListener("scroll", () => {
  if (isLoadingSessions || !hasMoreSessions) return;
  const { scrollTop, scrollHeight, clientHeight } = sessionMenu;
  if (scrollTop + clientHeight >= scrollHeight - 15) {
    fetchRecentSessions(false); // load next 10 sessions
  }
});

// Fetch sessions from Bridge with pagination
async function fetchRecentSessions(reset = false) {
  if (!isBridgeOnline || isLoadingSessions) return;
  if (reset) {
    sessionOffset = 0;
    cachedSessions = [];
    hasMoreSessions = true;
  }
  if (!hasMoreSessions) return;

  isLoadingSessions = true;
  sessionLoadMore.style.display = "block";
  sessionLoadMore.innerText = currentLang === "th" ? "⏳ กำลังโหลดเพิ่ม..." : "⏳ Loading more...";

  try {
    const res = await fetch(`${BRIDGE_URL}/sessions?offset=${sessionOffset}&limit=${SESSION_LIMIT}`, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      const newSessions = data.sessions || [];
      if (reset) {
        cachedSessions = newSessions;
      } else {
        // Append without duplicating IDs
        newSessions.forEach(ns => {
          if (!cachedSessions.some(cs => cs.id === ns.id)) {
            cachedSessions.push(ns);
          }
        });
      }
      sessionOffset += newSessions.length;
      hasMoreSessions = data.has_more;

      if (data.active_session_id && !currentSessionId) {
        currentSessionId = data.active_session_id;
      }
      renderSessionList();
      updateSessionTriggerLabel();
    }
  } catch (e) {
    console.error("Failed to fetch sessions:", e);
  } finally {
    isLoadingSessions = false;
    sessionLoadMore.style.display = hasMoreSessions ? "block" : "none";
    if (hasMoreSessions) {
      sessionLoadMore.innerText = currentLang === "th" ? "▼ เลื่อนเพื่อดูเพิ่มเติม..." : "▼ Scroll to load more...";
    }
  }
}

// Update Top Trigger Button Text
function updateSessionTriggerLabel() {
  const t = i18n[currentLang];
  if (!currentSessionId) {
    sessionTriggerText.innerText = t.sessionNew;
    return;
  }
  const found = cachedSessions.find(s => s.id === currentSessionId);
  if (found) {
    sessionTriggerText.innerText = `${t.sessionCurrentPrefix}${found.title} (${found.time})`;
  } else {
    sessionTriggerText.innerText = `${t.sessionCurrentPrefix}${currentSessionId.substring(0, 8)}...`;
  }
}

// Render Dropdown items (New session + Current Pinned On Top + Paginated Sessions)
function renderSessionList() {
  const t = i18n[currentLang];
  sessionList.innerHTML = "";

  // 1. New Session Item
  const itemNew = document.createElement("div");
  itemNew.className = `session-item ${!currentSessionId ? "active" : ""}`;
  itemNew.innerHTML = `
    <div class="session-item-title" style="font-weight:bold; color:var(--accent);">${t.sessionNew}</div>
    <div class="session-item-header"><span>Start clean context</span></div>
  `;
  itemNew.addEventListener("click", () => switchSession(null));
  sessionList.appendChild(itemNew);

  // 2. Current Session (Pinned On Top)
  if (currentSessionId) {
    const found = cachedSessions.find(s => s.id === currentSessionId);
    const itemCurrent = document.createElement("div");
    itemCurrent.className = "session-item active";
    itemCurrent.innerHTML = `
      <div class="session-item-header">
        <span style="color:var(--success); font-weight:bold;">${t.sessionCurrentPrefix}</span>
        <span>${found ? found.time : ""}</span>
      </div>
      <div class="session-item-title">${found ? found.title : currentSessionId}</div>
    `;
    itemCurrent.addEventListener("click", () => {
      closeSessionMenu();
    });
    sessionList.appendChild(itemCurrent);
  }

  // 3. Paginated Sessions (excluding current if already pinned on top)
  cachedSessions.forEach((s) => {
    if (s.id !== currentSessionId) {
      const item = document.createElement("div");
      item.className = "session-item";
      item.innerHTML = `
        <div class="session-item-header">
          <span>${s.id.substring(0, 8)}</span>
          <span>${s.time}</span>
        </div>
        <div class="session-item-title">${s.title}</div>
      `;
      item.addEventListener("click", () => switchSession(s.id));
      sessionList.appendChild(item);
    }
  });
}

async function switchSession(newId) {
  closeSessionMenu();
  const t = i18n[currentLang];
  if (!newId) {
    currentSessionId = null;
    if (isBridgeOnline) {
      try {
        await fetch(`${BRIDGE_URL}/reset`, { method: "POST" });
      } catch (e) {}
    }
    chatContainer.innerHTML = "";
    appendMessage("msg-bot", t.resetSuccessMsg);
  } else {
    currentSessionId = newId;
    if (isBridgeOnline) {
      try {
        await fetch(`${BRIDGE_URL}/set_session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId })
        });
      } catch (e) {}
    }
    appendMessage("msg-bot", t.sessionSwitchedMsg(currentSessionId));
  }
  updateSessionTriggerLabel();
  renderSessionList();
  checkBridge();
}

btnRefreshSessions.addEventListener("click", () => fetchRecentSessions(true));

function appendMessage(type, htmlContent) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.innerHTML = htmlContent;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return div;
}

// Refresh Chrome tabs dropdown
async function refreshTabList() {
  try {
    const t = i18n[currentLang];
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const currentVal = tabSelector.value;
    tabSelector.innerHTML = `<option value="active">${t.tabActive}</option>`;
    
    tabs.forEach(tab => {
      // Filter out internal chrome pages
      if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://")) {
        const opt = document.createElement("option");
        opt.value = tab.id.toString();
        const cleanTitle = tab.title ? tab.title.slice(0, 35) : "Untitled";
        opt.innerText = `🌐 ${cleanTitle}`;
        if (tab.active) {
          opt.innerText += t.tabActiveBadge;
        }
        tabSelector.appendChild(opt);
      }
    });

    if (currentVal && Array.from(tabSelector.options).some(o => o.value === currentVal)) {
      tabSelector.value = currentVal;
    }
  } catch (e) {
    console.error("Error refreshing tabs:", e);
  }
}

btnRefreshTabs.addEventListener("click", refreshTabList);
chrome.tabs.onUpdated.addListener(() => refreshTabList());
chrome.tabs.onActivated.addListener(() => refreshTabList());

// Get targeted tab context (fallback gracefully if on restricted Chrome/WebStore pages)
async function getTargetTabContext() {
  let targetTabId = null;
  let tabInfo = null;
  const selected = tabSelector.value;

  if (selected && selected !== "active") {
    targetTabId = parseInt(selected, 10);
    try {
      tabInfo = await chrome.tabs.get(targetTabId);
    } catch (e) {}
  } else {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      targetTabId = activeTab.id;
      tabInfo = activeTab;
    }
  }

  if (!targetTabId) return null;

  // Check if page is restricted by Chrome security (chrome://, edge://, chrome.google.com/webstore)
  const isRestricted = tabInfo && tabInfo.url && (
    tabInfo.url.startsWith("chrome://") ||
    tabInfo.url.startsWith("edge://") ||
    tabInfo.url.includes("chrome.google.com/webstore") ||
    tabInfo.url.includes("chromewebstore.google.com")
  );

  if (isRestricted) {
    // Provide clean fallback context without breaking chat
    return {
      tabId: targetTabId,
      context: {
        url: tabInfo.url,
        title: tabInfo.title || "Restricted Page",
        tables: [],
        standaloneInputs: [],
        formFields: [],
        pageTextSummary: `[Restricted System Page: ${tabInfo.url} - Direct DOM reading is protected by Chrome Security Policy]`
      }
    };
  }

  try {
    const res = await chrome.tabs.sendMessage(targetTabId, { action: "GET_PAGE_CONTEXT" });
    return { tabId: targetTabId, context: res };
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ["content.js"]
      });
      const res = await chrome.tabs.sendMessage(targetTabId, { action: "GET_PAGE_CONTEXT" });
      return { tabId: targetTabId, context: res };
    } catch (e) {
      // Fallback context with tab title & url
      return {
        tabId: targetTabId,
        context: {
          url: tabInfo ? tabInfo.url : "",
          title: tabInfo ? tabInfo.title : "",
          tables: [],
          standaloneInputs: [],
          formFields: [],
          pageTextSummary: `Unable to inject script: ${e.message}`
        }
      };
    }
  }
}

// Execute actions on current page
async function executeOnPage(tabId, actions, customScript = null) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, {
      action: "EXECUTE_ACTIONS",
      actions: actions,
      customScript: customScript
    });
    return res;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Send user prompt
async function handleUserPrompt(userText) {
  const t = i18n[currentLang];
  const currentImg = attachedImageBase64;
  if (!userText.trim() && !currentImg) return;

  let displayMsg = userText.trim();
  if (currentImg) {
    displayMsg = `<div><img src="${currentImg}" style="max-width:180px; max-height:120px; border-radius:4px; display:block; margin-bottom:6px; border:1px solid rgba(255,255,255,0.2);" />${displayMsg || `<i>${t.imageAttachedPlaceholder}</i>`}</div>`;
  }
  appendMessage("msg-user", displayMsg);

  promptInput.value = "";
  // Reset image preview
  attachedImageBase64 = null;
  imgPreviewBar.style.display = "none";
  imgPreviewThumb.src = "";

  const botPlaceholder = appendMessage("msg-bot", t.analyzingWait);

  const pageInfo = await getTargetTabContext();
  if (!pageInfo) {
    botPlaceholder.innerHTML = t.cannotReadPage;
    return;
  }

  const defaultPrompt = currentLang === "th" 
    ? "ช่วยตรวจสอบหน้าเว็บเปรียบเทียบกับรูปภาพที่แนบมานี้" 
    : "Inspect the webpage and verify according to this attached image";

  const payload = {
    prompt: userText || defaultPrompt,
    context: pageInfo.context,
    image: currentImg,
    sessionId: currentSessionId,
    lang: currentLang
  };

  try {
    let replyData = null;

    if (isBridgeOnline) {
      const res = await fetch(`${BRIDGE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Bridge returned HTTP ${res.status}`);
      replyData = await res.json();
      if (replyData.sessionId) {
        currentSessionId = replyData.sessionId;
        statusText.innerText = `${t.statusOnlineSession} (${currentSessionId.substring(0, 8)})`;
        fetchRecentSessions();
      }
    } else {
      botPlaceholder.innerHTML = t.bridgeOfflineAlert;
      return;
    }

    renderBotResponse(botPlaceholder, replyData, pageInfo.tabId);
  } catch (err) {
    botPlaceholder.innerHTML = `❌ ${err.message}`;
  }
}

function renderBotResponse(container, data, tabId) {
  const t = i18n[currentLang];
  let replyText = data.reply || "";
  let html = replyText.replace(/\n/g, "<br>");

  const hasActions = data.actions && data.actions.length > 0;
  const hasScript = !!data.customScript;

  if (hasActions || hasScript) {
    html += `<div class="action-box">`;
    if (hasActions) {
      html += t.detectedActions(data.actions.length);
      data.actions.slice(0, 10).forEach((a, i) => {
        html += `• ${i + 1}. [${a.type}] <code>${a.agyId || a.selector || 'Field'}</code> ${a.value ? '=> "' + a.value + '"' : ''}<br>`;
      });
      if (data.actions.length > 10) html += t.moreActions(data.actions.length - 10);
    } else if (hasScript) {
      html += t.detectedScript;
    }

    html += `<button class="btn-confirm" id="btn-apply-actions">${t.btnApplyActions}</button>`;
    html += `</div>`;
    
    container.innerHTML = html;

    const btnApply = container.querySelector("#btn-apply-actions");
    if (btnApply) {
      btnApply.addEventListener("click", async () => {
        btnApply.disabled = true;
        btnApply.innerText = t.actionRunning;
        const execRes = await executeOnPage(tabId, data.actions || [], data.customScript || null);
        if (execRes.success) {
          btnApply.innerText = t.actionDone;
        } else {
          btnApply.innerText = t.actionError(execRes.error || "Execution error");
        }
      });
    }
  } else {
    container.innerHTML = html;
  }
}

// Event Listeners
btnSend.addEventListener("click", () => handleUserPrompt(promptInput.value));
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleUserPrompt(promptInput.value);
});

btnInspect.addEventListener("click", async () => {
  const t = i18n[currentLang];
  const page = await getTargetTabContext();
  if (!page) {
    appendMessage("msg-bot", t.inspectError);
    return;
  }
  const fields = page.context.formFields;
  let info = t.inspectFound(fields.length);
  fields.slice(0, 15).forEach((f) => {
    info += `• [${f.tag}:${f.type}] <code>${f.selector || f.id || f.name}</code> (${f.label || t.inspectNoLabel}) ค่า: "${f.currentValue}"<br>`;
  });
  if (fields.length > 15) info += t.inspectMore(fields.length - 15);
  appendMessage("msg-bot", info);
});

btnRead.addEventListener("click", async () => {
  handleUserPrompt(i18n[currentLang].readPrompt);
});

// Initial load
fetchRecentSessions();
