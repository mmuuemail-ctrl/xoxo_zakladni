const { ipcRenderer } = require("electron");

const web = document.getElementById("web");
const address = document.getElementById("address");
const btnGo = document.getElementById("btnGo");
const btnBack = document.getElementById("btnBack");
const btnFwd = document.getElementById("btnFwd");
const btnReload = document.getElementById("btnReload");
const btnPick = document.getElementById("btnPick");
const btnSave = document.getElementById("btnSave");
const btnClose = document.getElementById("btnClose");

let pickMode = false;
let lastPick = null;

// při startu otevři URL
ipcRenderer.on("start-url", (e, url) => {
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  address.value = url;
  web.loadURL(url);
});

btnGo.addEventListener("click", () => {
  let url = address.value.trim();
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  web.loadURL(url);
});

btnBack.addEventListener("click", () => web.goBack());
btnFwd.addEventListener("click", () => web.goForward());
btnReload.addEventListener("click", () => web.reload());

// Režim označování prvků
btnPick.addEventListener("click", () => {
  pickMode = !pickMode;
  if (pickMode) {
    web.executeJavaScript(`
      // Barvy
      const colors = ["rgba(255,0,0,0.1)","rgba(0,255,0,0.1)","rgba(0,0,255,0.1)","rgba(255,255,0,0.1)","rgba(255,0,255,0.1)","rgba(0,255,255,0.1)"];
      let i = 0;
      document.querySelectorAll("*").forEach(el => {
        if (!el.__oldBg) el.__oldBg = el.style.backgroundColor;
        el.style.backgroundColor = colors[i % colors.length];
        i++;
      });

      // Negativní barva
      function invertColor(rgba){
        const parts = rgba.match(/rgba?\\((\\d+), ?(\\d+), ?(\\d+)(?:, ?([0-9.]+))?\\)/);
        if (!parts) return "rgba(0,0,0,0.3)";
        let r = 255 - parseInt(parts[1]);
        let g = 255 - parseInt(parts[2]);
        let b = 255 - parseInt(parts[3]);
        return "rgba(" + r + "," + g + "," + b + ",0.6)";
      }

      window.__uniqueSelector = function(el){
        if (el.id) return "#"+el.id;
        let path = el.tagName.toLowerCase();
        if (el.className) path += "."+el.className.trim().split(/\\s+/).join(".");
        return path;
      };

      let lastSelected = null;

      // Hover
      document.body.addEventListener("mouseover", window.__hover = function(e){
        if (!pickMode) return;
        if (e.target === lastSelected) return;
        if (!e.target.__oldBgHover) e.target.__oldBgHover = e.target.style.backgroundColor;
        e.target.style.backgroundColor = invertColor(getComputedStyle(e.target).backgroundColor);
      }, true);

      document.body.addEventListener("mouseout", window.__hoverOut = function(e){
        if (!pickMode) return;
        if (e.target === lastSelected) return;
        if (e.target.__oldBgHover){
          e.target.style.backgroundColor = e.target.__oldBgHover;
          e.target.__oldBgHover = null;
        }
      }, true);

      // Kliknutí
      document.body.addEventListener("click", window.__picker = function(e){
        e.preventDefault(); e.stopPropagation();

        // vrať barvu předchozího
        if (lastSelected){
          lastSelected.style.backgroundColor = lastSelected.__oldBgHover || lastSelected.__oldBg || "";
        }

        lastSelected = e.target;
        lastSelected.style.backgroundColor = invertColor(getComputedStyle(lastSelected).backgroundColor);

        let path = window.__uniqueSelector(e.target);
        window.postMessage({type:"pick", selector:path, text:e.target.innerText, url:location.href}, "*");
      }, true);
    `);
    btnPick.textContent = "Označit ON";
  } else {
    web.executeJavaScript(`
      // Vrátit barvy
      document.querySelectorAll("*").forEach(el => {
        if (el.__oldBg !== undefined) {
          el.style.backgroundColor = el.__oldBg;
          delete el.__oldBg;
        }
      });
      document.body.removeEventListener("click", window.__picker, true);
      document.body.removeEventListener("mouseover", window.__hover, true);
      document.body.removeEventListener("mouseout", window.__hoverOut, true);
    `);
    btnPick.textContent = "Označit OFF";
  }
});

// 📌 zprávy z <webview>
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "pick") {
    lastPick = event.data;
    alert("Vybráno: " + lastPick.selector + " / " + lastPick.text.slice(0, 50));
  }
});

// Uložení objektu
btnSave.addEventListener("click", () => {
  if (!lastPick) return alert("Nejdřív označ prvek!");
  ipcRenderer.send("object-saved", lastPick);
  alert("Objekt uložen.");
});

// Zavření okna
btnClose.addEventListener("click", () => {
  window.close();
});
