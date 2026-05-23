// FocusGuard v2 — Background Service Worker

const DEFAULT_BLOCKED = [
  "facebook.com","twitter.com","x.com","instagram.com","tiktok.com",
  "youtube.com","reddit.com","9gag.com","threads.net","snapchat.com",
  "twitch.tv","pinterest.com","tumblr.com"
];

const DEFAULT_STATE = {
  blockedSites: DEFAULT_BLOCKED,
  isEnabled: true,
  hardLock: false,
  hardLockUntil: null,
  scheduleEnabled: false,
  scheduleSlots: [],
  pomodoroActive: false,
  pomodoroEnd: null,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  pomodoroCount: 0,
  pomodoroInBreak: false,
  stats: {},
  tempAllowList: [],
  tempAllowExpiry: {},
  categories: {
    social: ["facebook.com","instagram.com","twitter.com","x.com","threads.net","snapchat.com"],
    video: ["youtube.com","tiktok.com","twitch.tv","vimeo.com"],
    news: ["reddit.com","9gag.com","buzzfeed.com","dailymail.co.uk"],
    shopping: ["shopee.vn","lazada.vn","tiki.vn","amazon.com"]
  }
};

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const merged = { ...DEFAULT_STATE };
  if (existing.blockedSites) merged.blockedSites = existing.blockedSites;
  if (existing.stats) merged.stats = existing.stats;
  if (existing.scheduleSlots) merged.scheduleSlots = existing.scheduleSlots;
  await chrome.storage.local.set(merged);
  chrome.alarms.create("tick", { periodInMinutes: 1 });
});

// ── Tick ──────────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tick") return;

  const data = await chrome.storage.local.get([
    "hardLock","hardLockUntil","pomodoroActive","pomodoroEnd",
    "pomodoroInBreak","pomodoroWork","pomodoroBreak","pomodoroCount",
    "tempAllowList","tempAllowExpiry"
  ]);
  const updates = {};

  if (data.hardLock && data.hardLockUntil && Date.now() >= data.hardLockUntil) {
    updates.hardLock = false;
    updates.hardLockUntil = null;
    notify("FocusGuard", "Khóa cứng đã hết hạn.");
  }

  if (data.pomodoroActive && data.pomodoroEnd && Date.now() >= data.pomodoroEnd) {
    if (!data.pomodoroInBreak) {
      const breakMs = (data.pomodoroBreak || 5) * 60 * 1000;
      updates.pomodoroInBreak = true;
      updates.pomodoroEnd = Date.now() + breakMs;
      updates.pomodoroCount = (data.pomodoroCount || 0) + 1;
      updates.isEnabled = false;
      notify("FocusGuard 🍅", `Hoàn thành #${updates.pomodoroCount}! Nghỉ ${data.pomodoroBreak} phút.`);
    } else {
      const workMs = (data.pomodoroWork || 25) * 60 * 1000;
      updates.pomodoroInBreak = false;
      updates.pomodoroEnd = Date.now() + workMs;
      updates.isEnabled = true;
      notify("FocusGuard 🍅", "Giờ nghỉ kết thúc! Bắt đầu pomodoro mới.");
    }
  }

  const now = Date.now();
  const expiry = data.tempAllowExpiry || {};
  const allowed = (data.tempAllowList || []).filter(s => !expiry[s] || expiry[s] > now);
  if (allowed.length !== (data.tempAllowList || []).length) {
    updates.tempAllowList = allowed;
  }

  if (Object.keys(updates).length > 0) await chrome.storage.local.set(updates);
});

// ── Schedule check ────────────────────────────────────────────────────────────
function isInSchedule(slots) {
  const now = new Date();
  const day = now.getDay();
  const hhmm = now.getHours() * 60 + now.getMinutes();
  return slots.some(slot => {
    if (!slot.days.includes(day)) return false;
    const [fh, fm] = slot.from.split(":").map(Number);
    const [th, tm] = slot.to.split(":").map(Number);
    return hhmm >= fh * 60 + fm && hhmm < th * 60 + tm;
  });
}

// ── Normalise any hostname alias to canonical blocked domain ──────────────────
// Maps known short aliases → canonical form already in the blocklist
const ALIAS_MAP = {
  "fb.com": "facebook.com",
  "fb.me": "facebook.com",
  "m.facebook.com": "facebook.com",
  "l.facebook.com": "facebook.com",   // FB link-shim redirect target
  "lm.facebook.com": "facebook.com",
  "t.co": "twitter.com",
  "youtu.be": "youtube.com",
  "m.youtube.com": "youtube.com",
  "vm.tiktok.com": "tiktok.com",
  "m.instagram.com": "instagram.com",
  "instagr.am": "instagram.com",
  "redd.it": "reddit.com",
  "old.reddit.com": "reddit.com",
  "np.reddit.com": "reddit.com",
};

function resolveHostname(hostname) {
  const clean = hostname.replace(/^www\./, "");
  return ALIAS_MAP[clean] || clean;
}

// ── Core block logic (shared across all navigation events) ────────────────────
async function checkAndBlock(details) {
  if (details.frameId !== 0) return;

  let url;
  try { url = new URL(details.url); } catch { return; }
  if (!["http:", "https:"].includes(url.protocol)) return;

  // Skip our own blocked page
  const blockedPage = chrome.runtime.getURL("pages/blocked.html");
  if (details.url.startsWith(blockedPage)) return;

  const data = await chrome.storage.local.get([
    "isEnabled","blockedSites","hardLock","hardLockUntil",
    "scheduleEnabled","scheduleSlots","tempAllowList",
    "pomodoroActive","pomodoroInBreak","stats"
  ]);

  // Expire stale hard lock
  if (data.hardLock && data.hardLockUntil && Date.now() >= data.hardLockUntil) {
    await chrome.storage.local.set({ hardLock: false, hardLockUntil: null });
    return;
  }

  // Is blocking active?
  let shouldBlock = false;
  if (data.hardLock) shouldBlock = true;
  else if (data.pomodoroActive && !data.pomodoroInBreak) shouldBlock = true;
  else if (data.scheduleEnabled && isInSchedule(data.scheduleSlots || [])) shouldBlock = true;
  else if (data.isEnabled) shouldBlock = true;
  if (!shouldBlock) return;

  // Resolve aliases: fb.com → facebook.com, youtu.be → youtube.com, etc.
  const hostname = resolveHostname(url.hostname);

  // Temp allow check
  const tempAllow = (data.tempAllowList || []);
  if (tempAllow.some(s => {
    const sc = s.replace(/^www\./, "");
    return hostname === sc || hostname.endsWith("." + sc);
  })) return;

  // Blocked list check
  const blocked = (data.blockedSites || []);
  const isBlocked = blocked.some(site => {
    const clean = site.replace(/^www\./, "");
    return hostname === clean || hostname.endsWith("." + clean);
  });
  if (!isBlocked) return;

  // Record stats
  const today = new Date().toISOString().split("T")[0];
  const stats = data.stats || {};
  if (!stats[today]) stats[today] = { blocked: 0, sites: {} };
  stats[today].blocked += 1;
  stats[today].sites[hostname] = (stats[today].sites[hostname] || 0) + 1;
  await chrome.storage.local.set({ stats });

  const blockedUrl = blockedPage
    + "?site=" + encodeURIComponent(hostname)
    + "&original=" + encodeURIComponent(details.url);

  chrome.tabs.update(details.tabId, { url: blockedUrl });
}

// ── Navigation listeners — cover every path a redirect can take ───────────────

// 1. User types URL or clicks a link — fires before any network request
chrome.webNavigation.onBeforeNavigate.addListener(checkAndBlock);

// 2. Server-side redirect (301/302) or meta-refresh — fires after redirect resolves
chrome.webNavigation.onCommitted.addListener((details) => {
  // Only act on redirects; normal user-initiated navigations are already caught above
  const redirectTypes = ["server_redirect", "client_redirect"];
  if (redirectTypes.includes(details.transitionType) ||
      (details.transitionQualifiers && details.transitionQualifiers.some(q => q.includes("redirect")))) {
    checkAndBlock(details);
  }
});

// 3. JS-driven navigation (history.pushState / location.replace) — SPA routers
chrome.webNavigation.onHistoryStateUpdated.addListener(checkAndBlock);

// ── Messages ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    chrome.storage.local.get(null).then(sendResponse);
    return true;
  }
  if (msg.type === "START_POMODORO") {
    const workMs = (msg.workMin || 25) * 60 * 1000;
    chrome.storage.local.set({
      pomodoroActive: true,
      pomodoroEnd: Date.now() + workMs,
      pomodoroInBreak: false,
      pomodoroWork: msg.workMin || 25,
      pomodoroBreak: msg.breakMin || 5,
      pomodoroCount: 0,
      isEnabled: true
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "STOP_POMODORO") {
    chrome.storage.local.set({ pomodoroActive: false, pomodoroEnd: null, pomodoroInBreak: false })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "TEMP_ALLOW") {
    chrome.storage.local.get(["tempAllowList","tempAllowExpiry"]).then(d => {
      const list = d.tempAllowList || [];
      const expiry = d.tempAllowExpiry || {};
      if (!list.includes(msg.site)) list.push(msg.site);
      expiry[msg.site] = msg.minutes ? Date.now() + msg.minutes * 60 * 1000 : null;
      chrome.storage.local.set({ tempAllowList: list, tempAllowExpiry: expiry })
        .then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});

function notify(title, message) {
  chrome.notifications.create({
    type: "basic", iconUrl: "icons/icon48.png", title, message
  });
}
