const { ipcRenderer } = require("electron");

const webv = document.getElementById('webv');
const urlInput = document.getElementById('urlInput');
const btnOpen = document.getElementById('btnOpen');
const btnUpdate = document.getElementById('btnUpdate');
const btnAutoStart = document.getElementById('btnAutoStart');
const btnAutoStop = document.getElementById('btnAutoStop');
const autoInterval = document.getElementById('autoInterval');
const btnExport = document.getElementById('btnExport');

const nameInput = document.getElementById('nameInput');
const noteInput = document.getElementById('noteInput');
const btnAddRow = document.getElementById('btnAddRow');
const lastPickInfo = document.getElementById('lastPickInfo');

const trialInfo = document.getElementById('trialInfo');
const licenseInput = document.getElementById('licenseInput');
const btnSetLicense = document.getElementById('btnSetLicense');

const btnContinueBrowser = document.getElementById('btnContinueBrowser');

const tbody = document.querySelector('#tbl tbody');

let state = {
  licenseOk: false,
  daysLeft: 0,
  items: [],
  autoIntervalSec: 0
};
let lastPick = null;
let timer = null;

async function loadState() {
  state = await window.xoxo.getState();
  autoInterval.value = state.autoIntervalSec || 0;
  updateTrialInfo();
  renderRows();
}

function updateTrialInfo() {
  if (state.licenseOk) {
    trialInfo.textContent = "Aktivováno (bez omezení)";
    trialInfo.className = "good";
  } else {
    trialInfo.textContent = `Zkušební verze – zbývá ${state.daysLeft} dní`;
    trialInfo.className = state.daysLeft > 0 ? "" : "bad";
  }
}

function renderRows() {
  tbody.innerHTML = "";
  state.items.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td contenteditable="true" data-f="name">${it.name||''}</td>
      <td contenteditable="true" data-f="note">${it.note||''}</td>
      <td>${it.lastValue||''}</td>
      <td class="small" title="${it.url||''}">${it.url||''}</td>
      <td class="small" title="${it.selector||''}">${it.selector||''}</td>
      <td><button class="rowbtn" data-idx="${idx}" data-act="del">Smazat</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function saveEditableCells() {
  const trs = Array.from(tbody.querySelectorAll('tr'));
  trs.forEach((tr, i) => {
    const nameTd = tr.querySelector('[data-f="name"]');
    const noteTd = tr.querySelector('[data-f="note"]');
    if (state.items[i]) {
      state.items[i].name = (nameTd.textContent||'').trim();
      state.items[i].note = (noteTd.textContent||'').trim();
    }
  });
}

async function persistItems() {
  saveEditableCells();
  await window.xoxo.saveItems(state.items);
}

btnSetLicense.addEventListener('click', async () => {
  const key = licenseInput.value;
  const res = await window.xoxo.setLicense(key);
  await loadState();
  alert(res.ok ? "Licenční klíč přijat." : "Klíč neplatný nebo vypršel trial.");
});

// --- Otevřít stránku v externím browser okně ---
btnOpen.addEventListener("click", () => {
  const url = urlInput.value.trim();
  if (!url) {
    alert("Zadej URL");
    return;
  }
  ipcRenderer.send("open-url-in-window", url);
});

// --- Pokračovat v prohlížeči (znovu otevřít) ---
btnContinueBrowser.addEventListener("click", () => {
  const url = urlInput.value.trim();
  if (!url) {
    alert("Zadej URL");
    return;
  }
  ipcRenderer.send("open-url-in-window", url);
});

// --- Přijetí uloženého objektu z browser okna ---
ipcRenderer.on("object-saved", async (e, data) => {
  if (!data) return;
  state.items.push({
    name: data.name || "",
    note: data.note || "",
    url: data.url,
    selector: data.selector,
    lastValue: data.text
  });
  await persistItems();
  renderRows();
  lastPickInfo.textContent = `Uloženo: ${data.selector} (text: ${data.text.slice(0,80)})`;
});

// --- Aktualizace dat ---
btnUpdate.addEventListener('click', async () => {
  await doUpdateAll();
});

btnAutoStart.addEventListener('click', async () => {
  const s = Number(autoInterval.value||0);
  if (s <= 0) return alert("Zadej interval v sekundách (>0).");
  clearInterval(timer);
  timer = setInterval(doUpdateAll, s*1000);
  await window.xoxo.setIntervalSec(s);
  alert("Automatická aktualizace spuštěna.");
});

btnAutoStop.addEventListener('click', async () => {
  clearInterval(timer);
  await window.xoxo.setIntervalSec(0);
  alert("Automatická aktualizace zastavena.");
});

btnExport.addEventListener('click', async () => {
  await persistItems();
  const res = await window.xoxo.exportCsv(state.items);
  if (res && res.ok) alert("Exportováno: "+res.path);
  else alert("Export zrušen nebo selhal.");
});

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act="del"]');
  if (btn) {
    const idx = Number(btn.getAttribute('data-idx'));
    state.items.splice(idx,1);
    await persistItems();
    renderRows();
  }
});

async function doUpdateAll() {
  if (!state.items.length) return;
  for (let i=0;i<state.items.length;i++){
    const it = state.items[i];
    if (!it.url || !it.selector) continue;
    await loadInWebview(it.url);
    const text = await getTextBySelector(it.selector);
    it.lastValue = text ?? '';
  }
  await persistItems();
  renderRows();
}

function loadInWebview(u) {
  return new Promise((resolve) => {
    const done = () => {
      webv.removeEventListener('did-finish-load', done);
      setTimeout(resolve, 300);
    };
    webv.addEventListener('did-finish-load', done);
    webv.setAttribute('src', u);
  });
}

function getTextBySelector(sel) {
  return webv.executeJavaScript(`
    (function(){
      try{
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null;
        return (el.innerText || el.textContent || "").trim();
      }catch(e){ return null; }
    })();
  `);
}

window.addEventListener('DOMContentLoaded', loadState);
