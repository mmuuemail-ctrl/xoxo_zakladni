const { ipcRenderer } = require('electron');

let picking = false;
let overlayStyleAdded = false;
let lastHighlighted = null;

function ensureStyle() {
  if (overlayStyleAdded) return;
  const st = document.createElement('style');
  st.textContent = `
  .xoxo-hover{ outline: 2px solid rgba(0,128,255,0.8) !important; cursor: crosshair !important; }
  .xoxo-picked{ outline: 3px solid rgba(0,255,128,0.9) !important; }
  `;
  document.documentElement.appendChild(st);
  overlayStyleAdded = true;
}

function cssPath(el) {
  if (!(el instanceof Element)) return '';
  const path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += '#' + el.id;
      path.unshift(selector);
      break;
    } else {
      let sib = el, nth = 1;
      while (sib = sib.previousElementSibling) {
        if (sib.nodeName.toLowerCase() == selector) nth++;
      }
      selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join('>');
}

function onMouseOver(e){
  if (!picking) return;
  ensureStyle();
  if (lastHighlighted) lastHighlighted.classList.remove('xoxo-hover');
  lastHighlighted = e.target;
  lastHighlighted.classList.add('xoxo-hover');
}
function onMouseOut(e){
  if (!picking) return;
  if (e.target === lastHighlighted) {
    e.target.classList.remove('xoxo-hover');
  }
}
function onClick(e){
  if (!picking) return;
  e.preventDefault();
  e.stopPropagation();
  if (lastHighlighted) lastHighlighted.classList.remove('xoxo-hover');
  const target = e.target;
  target.classList.add('xoxo-picked');

  const selector = cssPath(target);
  const text = (target.innerText || target.textContent || "").trim();
  const data = { selector, text, url: location.href };

  // Po vybrání zakážeme režim výběru (vždy jen jeden v daný okamžik)
  picking = false;

  const { ipcRenderer, webFrame } = require('electron');
  // pošli zpět do rendereru
  window.top.postMessage({ channel:'xoxo-picked', data }, '*');
}

window.addEventListener('mouseover', onMouseOver, true);
window.addEventListener('mouseout', onMouseOut, true);
window.addEventListener('click', onClick, true);

const { ipcRenderer: ipc } = require('electron');
window.addEventListener('message', (ev) => {
  // forward for safety
});

const { webFrame } = require('electron');

// Příjem povelu k zapnutí výběru
require('electron').ipcRenderer.on('xoxo-toggle-pick', (_e, {enable}) => {
  picking = !!enable;
  if (!enable && lastHighlighted) {
    lastHighlighted.classList.remove('xoxo-hover');
    lastHighlighted = null;
  }
});

// Po výběru pošleme zprávu zpět rendereru
window.addEventListener('message', (ev) => {
  if (ev.data && ev.data.channel === 'xoxo-picked') {
    // Přepošli do embedderu
    const { data } = ev.data;
    const { ipcRenderer } = require('electron');
    // webview <-> embedder komunikace: použijeme postMessage na embeddera
    // (renderer naslouchá webv 'ipc-message' v renderer.js)
    require('electron').ipcRenderer.sendToHost('xoxo-picked', data);
  }
});
