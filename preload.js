const { ipcRenderer } = require("electron");

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "xoxo-pick-element") {
    ipcRenderer.sendToHost("xoxo-picked", event.data.payload);
  }
});

ipcRenderer.on("xoxo-toggle-pick", (event, { enable }) => {
  if (enable) {
    document.body.addEventListener("click", pickHandler, true);
  } else {
    document.body.removeEventListener("click", pickHandler, true);
  }
});

function pickHandler(e) {
  e.preventDefault();
  e.stopPropagation();

  const el = e.target;
  const selector = getUniqueSelector(el);
  const text = (el.innerText || el.textContent || "").trim();

  window.postMessage({
    type: "xoxo-pick-element",
    payload: {
      url: window.location.href,
      selector,
      text
    }
  });

  // vypnutí režimu výběru po jednom kliknutí
  document.body.removeEventListener("click", pickHandler, true);
}

function getUniqueSelector(el) {
  if (el.id) return `#${el.id}`;
  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className) {
      selector += "." + Array.from(el.classList).join(".");
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(" > ");
}