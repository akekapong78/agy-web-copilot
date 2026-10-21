/**
 * Advanced Semantic DOM Extractor
 * Extracts tables, rows, columns, criteria, labels, and exact interactive elements
 */
function extractPageContext() {
  // 1. Tag all interactive elements with a reliable data-agy-id
  let agyIdCounter = 1;
  const interactiveMap = [];

  // 2. Extract Structured Tables (PMS / Grid / Data forms)
  const tablesData = [];
  const tables = document.querySelectorAll("table");
  
  tables.forEach((tbl, tIdx) => {
    const headers = Array.from(tbl.querySelectorAll("th")).map(th => th.innerText.trim()).filter(Boolean);
    const rows = [];

    tbl.querySelectorAll("tbody tr, tr").forEach((tr, rIdx) => {
      // Find cells
      const cells = Array.from(tr.querySelectorAll("td, th"));
      if (cells.length === 0) return;

      const cellTexts = [];
      const rowInputs = [];

      cells.forEach((td, cIdx) => {
        // Collect text
        const txt = td.innerText.replace(/\s+/g, " ").trim();
        if (txt) cellTexts.push(txt);

        // Collect inputs inside cell
        td.querySelectorAll("input, textarea, select, button").forEach(el => {
          if (!el.getAttribute("data-agy-id")) {
            el.setAttribute("data-agy-id", `agy-${agyIdCounter++}`);
          }
          const aid = el.getAttribute("data-agy-id");
          const item = {
            agyId: aid,
            tag: el.tagName.toLowerCase(),
            type: el.type || el.tagName.toLowerCase(),
            value: el.value || "",
            placeholder: el.placeholder || "",
            cellTextNear: txt.slice(0, 100)
          };
          rowInputs.push(item);
          interactiveMap.push(item);
        });
      });

      if (cellTexts.length > 0 || rowInputs.length > 0) {
        rows.push({
          row: rIdx + 1,
          textSummary: cellTexts.join(" | "),
          inputs: rowInputs
        });
      }
    });

    if (rows.length > 0) {
      tablesData.push({
        tableIndex: tIdx + 1,
        headers: headers,
        rows: rows.slice(0, 25) // capture up to 25 rows
      });
    }
  });

  // 3. Fallback: Standalone inputs outside tables
  const standaloneInputs = [];
  document.querySelectorAll("input, textarea, select").forEach((el, idx) => {
    if (el.closest("table")) return; // already handled
    const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    if (!isVisible) return;

    if (!el.getAttribute("data-agy-id")) {
      el.setAttribute("data-agy-id", `agy-${agyIdCounter++}`);
    }
    const aid = el.getAttribute("data-agy-id");
    const label = el.labels && el.labels[0] ? el.labels[0].innerText.trim() : "";
    const parentText = el.closest(".form-group, .ant-form-item, div")?.innerText.replace(/\s+/g, " ").slice(0, 80) || "";

    const item = {
      agyId: aid,
      tag: el.tagName.toLowerCase(),
      type: el.type || el.tagName.toLowerCase(),
      label: label || el.placeholder || parentText || "",
      value: el.value || ""
    };
    standaloneInputs.push(item);
    interactiveMap.push(item);
  });

  return {
    url: window.location.href,
    title: document.title,
    tables: tablesData,
    standaloneInputs: standaloneInputs.slice(0, 30),
    totalInteractive: interactiveMap.length
  };
}

/**
 * Execute automation actions requested by AGY
 * Executes directly via Content Script DOM manipulation (100% CSP-Safe)
 */
function executePageActions(actions, customScript = null) {
  const results = [];

  // Parse actions if customScript contains structured JSON array
  let taskList = Array.isArray(actions) ? [...actions] : [];

  // If actions was empty but customScript had the data array (e.g. data = [ { id: '...', v: '...' } ])
  if (taskList.length === 0 && customScript && typeof customScript === "string") {
    try {
      const match = customScript.match(/\[\s*\{\s*id\s*:\s*['"]([^'"]+)['"]\s*,\s*v\s*:\s*['"]([^'"]+)['"]\s*\}[\s\S]*?\]/);
      if (match) {
        // Safely extract all { id: '...', v: '...' } pairs using regex without eval
        const itemRegex = /\{\s*id\s*:\s*['"]([^'"]+)['"]\s*,\s*v\s*:\s*['"]([^'"]+)['"]\s*\}/g;
        let m;
        while ((m = itemRegex.exec(customScript)) !== null) {
          taskList.push({
            type: "fill",
            agyId: m[1],
            value: m[2]
          });
        }
      }
    } catch (e) {
      console.warn("Regex action extraction notice:", e);
    }
  }

  // Execute directly on DOM elements (No eval, No new Function, No inline script injection)
  if (taskList.length > 0) {
    for (const act of taskList) {
      try {
        let targetEl = null;

        if (act.agyId) {
          targetEl = document.querySelector(`[data-agy-id="${act.agyId}"]`);
        } else if (act.selector) {
          targetEl = document.querySelector(act.selector);
        } else if (act.id) {
          targetEl = document.getElementById(act.id);
        }

        if (!targetEl) {
          results.push({ action: act, status: "failed", error: "Element not found" });
          continue;
        }

        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

        if (act.type === "fill" || act.type === "set") {
          targetEl.focus();
          targetEl.value = act.value;
          targetEl.dispatchEvent(new Event("input", { bubbles: true }));
          targetEl.dispatchEvent(new Event("change", { bubbles: true }));
          targetEl.blur();
          results.push({ action: act, status: "success", value: act.value });
        } else if (act.type === "click") {
          targetEl.focus();
          targetEl.click();
          results.push({ action: act, status: "success" });
        } else if (act.type === "select") {
          targetEl.value = act.value;
          targetEl.dispatchEvent(new Event("change", { bubbles: true }));
          results.push({ action: act, status: "success" });
        }
      } catch (err) {
        results.push({ action: act, status: "error", message: err.message });
      }
    }
    return { success: true, count: results.filter(r => r.status === "success").length, results };
  }

  return { success: false, error: "No executable actions found" };
}

// Listen to messages from Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_PAGE_CONTEXT") {
    sendResponse(extractPageContext());
  } else if (request.action === "EXECUTE_ACTIONS") {
    sendResponse(executePageActions(request.actions, request.customScript));
  }
  return true;
});
