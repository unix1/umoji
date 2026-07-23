(() => {
  const EMOJI = window.UMOJI_DATA || [];
  const MAX_RESULTS = 512;

  const messageEl = document.getElementById("message");
  const searchEl = document.getElementById("search");
  const resultsEl = document.getElementById("results");
  const copyBtn = document.getElementById("copy-btn");
  const copyLinkBtn = document.getElementById("copy-link-btn");
  const clearBtn = document.getElementById("clear-btn");

  /** @type {string[]} */
  let message = [];
  let suppressUrl = false;

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  document.body.appendChild(toastEl);
  let toastTimer = 0;

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 1400);
  }

  function isEmojiChar(ch) {
    try {
      return /\p{Extended_Pictographic}/u.test(ch) || /\p{Emoji_Presentation}/u.test(ch);
    } catch {
      return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ch);
    }
  }

  function extractEmojis(text) {
    if (!text) return [];
    const out = [];
    try {
      const re = /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*/gu;
      const matches = text.match(re);
      if (matches) out.push(...matches);
      // keycap sequences like 1️⃣
      const keycaps = text.match(/[0-9#*]\uFE0F?\u20E3/g);
      if (keycaps) out.push(...keycaps);
    } catch {
      for (const ch of text) {
        if (isEmojiChar(ch)) out.push(ch);
      }
    }
    return out;
  }

  // App lives at this directory; message is appended as the path leaf: /🎉🔥
  const BASE_PATH = (() => {
    let path = location.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep raw */
    }
    if (path.endsWith("/index.html")) {
      return path.slice(0, -"index.html".length) || "/";
    }
    const leaf = path.split("/").pop() || "";
    const leafEmojis = extractEmojis(leaf);
    if (leaf && leafEmojis.length && leafEmojis.join("") === leaf) {
      const dir = path.slice(0, path.length - leaf.length);
      return dir || "/";
    }
    return path.endsWith("/") ? path : `${path}/`;
  })();

  function messageFromUrl() {
    let path = location.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep raw */
    }
    if (path.endsWith("/index.html")) return [];
    const leaf = path.startsWith(BASE_PATH)
      ? path.slice(BASE_PATH.length)
      : path.replace(/^\/+/, "");
    if (!leaf || leaf === "index.html") return [];
    return extractEmojis(leaf);
  }

  function urlForMessage(chars) {
    const joined = chars.join("");
    if (!joined) {
      return BASE_PATH === "/" ? "/" : BASE_PATH.replace(/\/+$/, "/") || "/";
    }
    return `${BASE_PATH.replace(/\/+$/, "/")}${joined}`;
  }

  function syncUrl(mode) {
    if (suppressUrl) return;
    const url = urlForMessage(message);
    const state = { message: message.join("") };
    if (mode === "replace") {
      history.replaceState(state, "", url);
    } else {
      history.pushState(state, "", url);
    }
  }

  function renderMessage() {
    const text = message.join("");
    if (messageEl.textContent !== text) {
      messageEl.textContent = text;
    }
    messageEl.dataset.empty = message.length ? "false" : "true";
    copyBtn.disabled = message.length === 0;
    copyLinkBtn.disabled = message.length === 0;
    clearBtn.disabled = message.length === 0;
  }

  function setMessage(chars, { urlMode = "push" } = {}) {
    message = chars.slice();
    renderMessage();
    if (urlMode !== "none") syncUrl(urlMode);
  }

  function appendEmojis(chars) {
    if (!chars.length) return;
    setMessage(message.concat(chars), { urlMode: "push" });
  }

  function clearMessage() {
    setMessage([], { urlMode: "push" });
    searchEl.focus();
  }

  function syncMessageFromEditor({ urlMode = "push" } = {}) {
    const chars = extractEmojis(messageEl.textContent || "");
    const joined = chars.join("");
    if (messageEl.textContent !== joined) {
      messageEl.textContent = joined;
    }
    if (joined === message.join("")) {
      messageEl.dataset.empty = chars.length ? "false" : "true";
      copyBtn.disabled = chars.length === 0;
      copyLinkBtn.disabled = chars.length === 0;
      clearBtn.disabled = chars.length === 0;
      return;
    }
    setMessage(chars, { urlMode });
  }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copied");
    }
  }

  function scoreEmoji(entry, query) {
    const q = query.trim().toLowerCase();
    if (!q) return 0;

    let best = 0;
    for (const word of entry.w) {
      const w = word.toLowerCase();
      if (w === q) best = Math.max(best, 100);
      else if (w.startsWith(q)) best = Math.max(best, 80 - Math.min(w.length - q.length, 20));
      else if (w.includes(q)) best = Math.max(best, 50 - Math.min(w.indexOf(q), 20));
    }

    // Multi-token: all tokens must match somewhere
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const ok = tokens.every((t) => entry.w.some((w) => w.toLowerCase().includes(t)));
      if (ok) best = Math.max(best, 70);
      else return 0;
    }

    return best;
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    resultsEl.textContent = "";
    if (!q) return;

    const ranked = [];
    for (const entry of EMOJI) {
      const s = scoreEmoji(entry, q);
      if (s > 0) ranked.push({ entry, s });
    }
    ranked.sort((a, b) => b.s - a.s || a.entry.c.localeCompare(b.entry.c));

    const frag = document.createDocumentFragment();
    for (const { entry } of ranked.slice(0, MAX_RESULTS)) {
      const el = document.createElement("span");
      el.className = "result";
      el.textContent = entry.c;
      el.title = entry.w.slice(0, 6).join(", ");
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.addEventListener("click", () => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && el.contains(sel.anchorNode)) return;
        appendEmojis([entry.c]);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          appendEmojis([entry.c]);
        }
      });
      frag.appendChild(el);
    }
    resultsEl.appendChild(frag);
  }

  searchEl.addEventListener("input", () => search(searchEl.value));

  copyBtn.addEventListener("click", () => copyText(message.join("")));
  copyLinkBtn.addEventListener("click", () => copyText(location.href));
  clearBtn.addEventListener("click", clearMessage);

  messageEl.addEventListener("input", () => syncMessageFromEditor({ urlMode: "push" }));

  messageEl.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") || "";
    const chars = extractEmojis(text);
    if (!chars.length) return;
    // Insert at caret when possible; otherwise append.
    if (document.execCommand) {
      document.execCommand("insertText", false, chars.join(""));
    } else {
      appendEmojis(chars);
    }
  });

  window.addEventListener("popstate", () => {
    suppressUrl = true;
    setMessage(messageFromUrl(), { urlMode: "none" });
    suppressUrl = false;
  });

  // Boot
  setMessage(messageFromUrl(), { urlMode: "replace" });
})();
