const BRIDGE_URL = "http://127.0.0.1:8765";

const chatContainer = document.getElementById("chat-container");
const promptInput = document.getElementById("prompt-input");
const btnSend = document.getElementById("btn-send");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const tabSelector = document.getElementById("tab-selector");
const btnRefreshTabs = document.getElementById("btn-refresh-tabs");
const btnInspect = document.getElementById("btn-inspect");
const btnRead = document.getElementById("btn-read");
const btnClear = document.getElementById("btn-clear");
const btnSettings = document.getElementById("btn-settings");
const setupModal = document.getElementById("setup-modal");
const btnCloseCfg = document.getElementById("btn-close-cfg");
const btnSaveCfg = document.getElementById("btn-save-cfg");
const cfgApiKey = document.getElementById("cfg-api-key");
const imgPreviewBar = document.getElementById("img-preview-bar");
const imgPreviewThumb = document.getElementById("img-preview-thumb");
const btnRemoveImg = document.getElementById("btn-remove-img");

let isBridgeOnline = false;
let currentSessionId = null;
let customApiKey = "";
let attachedImageBase64 = null; // Stored base64 image from Ctrl+V

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

// Load stored settings
chrome.storage.local.get(["geminiApiKey"], (res) => {
  if (res.geminiApiKey) {
    customApiKey = res.geminiApiKey;
    cfgApiKey.value = customApiKey;
  }
});

btnSettings.addEventListener("click", () => setupModal.style.display = "flex");
btnCloseCfg.addEventListener("click", () => setupModal.style.display = "none");
btnSaveCfg.addEventListener("click", () => {
  customApiKey = cfgApiKey.value.trim();
  chrome.storage.local.set({ geminiApiKey: customApiKey }, () => {
    alert("บันทึกการตั้งค่าเรียบร้อยแล้ว");
    setupModal.style.display = "none";
  });
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
  appendMessage("msg-bot", "🧹 ล้างประวัติและเริ่ม Session ใหม่เรียบร้อยแล้วครับ");
});

// Check Bridge status
async function checkBridge() {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      isBridgeOnline = true;
      statusDot.className = "status-dot online";
      if (data.active_session_id) {
        currentSessionId = data.active_session_id;
        statusText.innerText = `AGY Session (${currentSessionId.substring(0, 8)})`;
      } else {
        statusText.innerText = "AGY Online (New Session)";
      }
      return true;
    }
  } catch (e) {
    // offline
  }
  isBridgeOnline = false;
  statusDot.className = "status-dot";
  statusText.innerText = customApiKey ? "Direct API Mode" : "Bridge Offline (คลิก ⚙️)";
  return false;
}
setInterval(checkBridge, 5000);
checkBridge();

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
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const currentVal = tabSelector.value;
    tabSelector.innerHTML = `<option value="active">📌 แท็บปัจจุบัน (Active Tab)</option>`;
    
    tabs.forEach(tab => {
      // Filter out internal chrome pages
      if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://")) {
        const opt = document.createElement("option");
        opt.value = tab.id.toString();
        const cleanTitle = tab.title ? tab.title.slice(0, 35) : "Untitled";
        opt.innerText = `🌐 ${cleanTitle}`;
        if (tab.active) {
          opt.innerText += " (กำลังเปิด)";
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
// Listen to Chrome tab changes to keep list fresh
chrome.tabs.onUpdated.addListener(() => refreshTabList());
chrome.tabs.onActivated.addListener(() => refreshTabList());
refreshTabList();

// Get targeted tab context
async function getTargetTabContext() {
  let targetTabId = null;
  const selected = tabSelector.value;

  if (selected && selected !== "active") {
    targetTabId = parseInt(selected, 10);
  } else {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) targetTabId = activeTab.id;
  }

  if (!targetTabId) return null;

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
      console.error("Failed to inject content script into tab:", targetTabId, e);
      return null;
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
  const currentImg = attachedImageBase64;
  if (!userText.trim() && !currentImg) return;

  let displayMsg = userText.trim();
  if (currentImg) {
    displayMsg = `<div><img src="${currentImg}" style="max-width:180px; max-height:120px; border-radius:4px; display:block; margin-bottom:6px; border:1px solid rgba(255,255,255,0.2);" />${displayMsg || "<i>(ส่งรูปภาพ)</i>"}</div>`;
  }
  appendMessage("msg-user", displayMsg);

  promptInput.value = "";
  // Reset image preview
  attachedImageBase64 = null;
  imgPreviewBar.style.display = "none";
  imgPreviewThumb.src = "";

  const botPlaceholder = appendMessage("msg-bot", "🧠 AGY กำลังคิดวิเคราะห์บริบทและรูปภาพ...");

  const pageInfo = await getTargetTabContext();
  if (!pageInfo) {
    botPlaceholder.innerHTML = "❌ ไม่สามารถอ่านหน้าเว็บเป้าหมายได้ (ตรวจสอบว่าแท็บยังเปิดอยู่และไม่ใช่หน้า chrome://)";
    return;
  }

  const payload = {
    prompt: userText || "ช่วยตรวจสอบหน้าเว็บเปรียบเทียบกับรูปภาพที่แนบมานี้",
    context: pageInfo.context,
    image: currentImg,
    sessionId: currentSessionId,
    apiKey: customApiKey || null
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
        statusText.innerText = `AGY Session (${currentSessionId.substring(0, 8)})`;
      }
    } else if (customApiKey) {
      botPlaceholder.innerHTML = "⏳ ส่งคำสั่งตรงไปยัง Gemini API...";
      replyData = await callDirectGemini(payload);
    } else {
      botPlaceholder.innerHTML = `
        ❌ <b>ยังไม่ได้เชื่อมต่อ Bridge และไม่มี API Key</b><br>
        กรุณาเปิดรัน <code>start_bridge.bat</code> บนเครื่อง<br>
        หรือคลิกปุ่ม ⚙️ เพื่อใส่ Google Gemini API Key
      `;
      return;
    }

    renderBotResponse(botPlaceholder, replyData, pageInfo.tabId);
  } catch (err) {
    botPlaceholder.innerHTML = `❌ เกิดข้อผิดพลาด: ${err.message}`;
  }
}

function renderBotResponse(container, data, tabId) {
  let replyText = data.reply || "";
  let html = replyText.replace(/\n/g, "<br>");

  const hasActions = data.actions && data.actions.length > 0;
  const hasScript = !!data.customScript;

  if (hasActions || hasScript) {
    html += `<div class="action-box">`;
    if (hasActions) {
      html += `<b>⚙️ ตรวจพบฟอร์มและมีแผนดำเนินการ (${data.actions.length} รายการ):</b><br>`;
      data.actions.slice(0, 10).forEach((a, i) => {
        html += `• ${i + 1}. [${a.type}] <code>${a.agyId || a.selector || 'Field'}</code> ${a.value ? '=> "' + a.value + '"' : ''}<br>`;
      });
      if (data.actions.length > 10) html += `<i>...และอีก ${data.actions.length - 10} รายการ</i><br>`;
    } else if (hasScript) {
      html += `<b>⚡ AI เตรียมชุดคำสั่งอัตโนมัติสำหรับหน้านี้เรียบร้อย:</b><br>`;
    }

    html += `<button class="btn-confirm" id="btn-apply-actions">🚀 กดดำเนินการลงในเว็บทันที</button>`;
    html += `</div>`;
    
    container.innerHTML = html;

    const btnApply = container.querySelector("#btn-apply-actions");
    if (btnApply) {
      btnApply.addEventListener("click", async () => {
        btnApply.disabled = true;
        btnApply.innerText = "กำลังดำเนินการ...";
        const execRes = await executeOnPage(tabId, data.actions || [], data.customScript || null);
        if (execRes.success) {
          btnApply.innerText = "✅ ดำเนินการสำเร็จแล้ว!";
        } else {
          btnApply.innerText = `❌ ข้อผิดพลาด: ${execRes.error || "Execution error"}`;
        }
      });
    }
  } else {
    container.innerHTML = html;
  }
}

// Fallback direct Gemini API caller
async function callDirectGemini(payload) {
  const parts = [];

  if (payload.image && payload.image.includes("base64,")) {
    const [mimePart, b64Data] = payload.image.split(";base64,");
    const mimeType = mimePart.replace("data:", "") || "image/png";
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: b64Data
      }
    });
  }

  const prompt = `
You are an expert web copilot AI assistant.
The user is viewing a web page:
Title: ${payload.context.title}
URL: ${payload.context.url}
Form Fields: ${JSON.stringify(payload.context.formFields ? payload.context.formFields.slice(0, 30) : [])}

User instruction: "${payload.prompt}"

Respond in valid JSON format ONLY:
{
  "reply": "Explain your answer or comparison with the image in natural Thai",
  "actions": [
    { "type": "fill" | "click" | "select", "selector": "#id or [name=...] or css selector", "value": "value to fill if fill" }
  ]
}
Return ONLY valid JSON.
`;
  parts.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${payload.apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  const json = await resp.json();
  const rawText = json.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

// Event Listeners
btnSend.addEventListener("click", () => handleUserPrompt(promptInput.value));
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleUserPrompt(promptInput.value);
});

btnInspect.addEventListener("click", async () => {
  const page = await getTargetTabContext();
  if (!page) {
    appendMessage("msg-bot", "❌ ไม่สามารถสแกนหน้าเว็บได้");
    return;
  }
  const fields = page.context.formFields;
  let info = `📋 <b>พบฟอร์มและองค์ประกอบ ${fields.length} จุด:</b><br>`;
  fields.slice(0, 15).forEach((f) => {
    info += `• [${f.tag}:${f.type}] <code>${f.selector || f.id || f.name}</code> (${f.label || 'ไม่มี label'}) ค่า: "${f.currentValue}"<br>`;
  });
  if (fields.length > 15) info += `<i>...และอีก ${fields.length - 15} จุด</i>`;
  appendMessage("msg-bot", info);
});

btnRead.addEventListener("click", async () => {
  handleUserPrompt("ช่วยสรุปเนื้อหาสำคัญและโครงสร้างของหน้านี้ให้ฟังหน่อย");
});
