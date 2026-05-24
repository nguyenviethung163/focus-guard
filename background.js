// FocusGuard v2 — Background Service Worker
'use strict';

import {
  DEFAULT_STATE,
  SYNCED_KEYS,
  ALIAS_MAP,
  TICK_ALARM_NAME,
  FLUSH_ALARM_NAME,
  CONTEXT_MENU_ID
} from './lib/constants.js';

import {
  todayKey
} from './lib/utils.js';

// ── Helpers & State Expiry ────────────────────────────────────────────────────

async function notify(title, message, type) {
  if (type === 'hardLock') {
    const d = await chrome.storage.local.get('notifyHardLock');
    if (d.notifyHardLock === false) return;
  }
  if (type === 'pomodoro') {
    const d = await chrome.storage.local.get('notifyPomodoro');
    if (d.notifyPomodoro === false) return;
  }
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message
  });
}

async function expireHardLock(notifyUser = false) {
  await chrome.storage.local.set({ hardLock: false, hardLockUntil: null });
  if (notifyUser) {
    notify("FocusGuard", "Khóa cứng đã hết hạn.", "hardLock");
  }
}

async function playPomoSound() {
  const data = await chrome.storage.local.get('pomoSound');
  if (data.pomoSound === false) return;
  
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'pages/offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Notification sounds for Pomodoro phase changes'
      });
    }
    
    chrome.runtime.sendMessage({
      type: 'PLAY_SOUND',
      target: 'offscreen'
    }).catch(() => {
      // Ignore errors if context is not fully ready or closed
    });
  } catch (e) {
    console.error('Failed to play offscreen sound', e);
  }
}

// ── Sync Logic ────────────────────────────────────────────────────────────────

async function initialSync() {
  try {
    const syncData = await chrome.storage.sync.get(SYNCED_KEYS);
    const localData = await chrome.storage.local.get(SYNCED_KEYS);
    const localUpdates = {};
    for (const key of SYNCED_KEYS) {
      if (syncData[key] !== undefined && JSON.stringify(syncData[key]) !== JSON.stringify(localData[key])) {
        localUpdates[key] = syncData[key];
      }
    }
    if (Object.keys(localUpdates).length > 0) {
      await chrome.storage.local.set(localUpdates);
    }
  } catch (e) {
    console.error("Sync failed on initialization", e);
  }
}

function updateBadge(stats) {
  const today = todayKey();
  const todayStats = stats?.[today];
  const count = todayStats?.blocked || 0;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: '#e8003a' });
}

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const merged = { ...DEFAULT_STATE, ...existing };
  
  await chrome.storage.local.set(merged);
  await initialSync();
  
  const fresh = await chrome.storage.local.get('stats');
  updateBadge(fresh.stats);

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Chặn trang này với FocusGuard",
      contexts: ["page"]
    });
  });

  chrome.alarms.create(TICK_ALARM_NAME, { periodInMinutes: 1 });
  chrome.alarms.create(FLUSH_ALARM_NAME, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create(TICK_ALARM_NAME, { periodInMinutes: 1 });
  chrome.alarms.create(FLUSH_ALARM_NAME, { periodInMinutes: 1 });
  await initialSync();
  const fresh = await chrome.storage.local.get('stats');
  updateBadge(fresh.stats);
});

// ── Alarms & Tick ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK_ALARM_NAME) {
    const data = await chrome.storage.local.get([
      "hardLock", "hardLockUntil", "pomodoroActive", "pomodoroEnd",
      "pomodoroInBreak", "pomodoroWork", "pomodoroBreak", "pomodoroCount",
      "tempAllowList", "tempAllowExpiry"
    ]);
    const updates = {};

    if (data.hardLock && data.hardLockUntil && Date.now() >= data.hardLockUntil) {
      await expireHardLock(true);
    }

    if (data.pomodoroActive && data.pomodoroEnd && Date.now() >= data.pomodoroEnd) {
      if (!data.pomodoroInBreak) {
        const breakMs = (data.pomodoroBreak || 5) * 60 * 1000;
        updates.pomodoroInBreak = true;
        updates.pomodoroEnd = Date.now() + breakMs;
        updates.pomodoroCount = (data.pomodoroCount || 0) + 1;
        updates.isEnabled = false;
        notify("FocusGuard 🍅", `Hoàn thành #${updates.pomodoroCount}! Nghỉ ${data.pomodoroBreak} phút.`, "pomodoro");
        playPomoSound();
      } else {
        const workMs = (data.pomodoroWork || 25) * 60 * 1000;
        updates.pomodoroInBreak = false;
        updates.pomodoroEnd = Date.now() + workMs;
        updates.isEnabled = true;
        notify("FocusGuard 🍅", "Giờ nghỉ kết thúc! Bắt đầu pomodoro mới.", "pomodoro");
        playPomoSound();
      }
    }

    const now = Date.now();
    const expiry = data.tempAllowExpiry || {};
    const allowed = (data.tempAllowList || []).filter(s => !expiry[s] || expiry[s] > now);
    if (allowed.length !== (data.tempAllowList || []).length) {
      updates.tempAllowList = allowed;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  } else if (alarm.name === FLUSH_ALARM_NAME) {
    await flushActiveTime();
  }
});

// ── Schedule Check ────────────────────────────────────────────────────────────

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

// ── Domain / Matching Logic ────────────────────────────────────────────────────

function resolveHostname(hostname) {
  const clean = hostname.replace(/^www\./, "");
  return ALIAS_MAP[clean] || clean;
}

function matchPattern(urlStr, pattern) {
  let normPattern = pattern.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  let normUrl = urlStr.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  
  if (normPattern.includes('*')) {
    const combatRegexChars = /[-\/\\^$+?.()|[\]{}]/g;
    const escaped = normPattern.replace(combatRegexChars, '\\$&');
    const regexStr = '^' + escaped.replace(/\\\*/g, '.*') + '$';
    try {
      const regex = new RegExp(regexStr);
      try {
        const urlObj = new URL(urlStr);
        const host = urlObj.hostname.replace(/^www\./, '');
        if (regex.test(host)) return true;
      } catch(e) {}
      
      return regex.test(normUrl);
    } catch(e) {
      return false;
    }
  }
  
  try {
    const urlObj = new URL(urlStr);
    const host = urlObj.hostname.replace(/^www\./, '');
    const cleanPatternHost = normPattern.split('/')[0];
    
    if (host === cleanPatternHost || host.endsWith('.' + cleanPatternHost)) {
      const patternPath = normPattern.substring(cleanPatternHost.length);
      if (patternPath && patternPath !== '/') {
        const urlPath = normUrl.substring(host.length);
        return urlPath.startsWith(patternPath);
      }
      return true;
    }
  } catch(e) {
    return normUrl.includes(normPattern);
  }
  return false;
}

// ── Blocking Core ─────────────────────────────────────────────────────────────

async function checkAndBlock(details) {
  if (details.frameId !== 0) return;

  let url;
  try { url = new URL(details.url); } catch { return; }
  if (!["http:", "https:"].includes(url.protocol)) return;

  // Skip our own blocked and interstitial pages
  const blockedPage = chrome.runtime.getURL("pages/blocked.html");
  const interstitialPage = chrome.runtime.getURL("pages/interstitial.html");
  if (details.url.startsWith(blockedPage) || details.url.startsWith(interstitialPage)) return;

  const data = await chrome.storage.local.get([
    "isEnabled", "blockedSites", "hardLock", "hardLockUntil",
    "scheduleEnabled", "scheduleSlots", "tempAllowList",
    "pomodoroActive", "pomodoroInBreak", "stats", "snoozedSites",
    "allowlistMode", "breatheMode"
  ]);

  // Expire stale hard lock
  if (data.hardLock && data.hardLockUntil && Date.now() >= data.hardLockUntil) {
    await expireHardLock(false);
    return;
  }

  // Is blocking active?
  let shouldBlock = false;
  if (data.hardLock) shouldBlock = true;
  else if (data.pomodoroActive && !data.pomodoroInBreak) shouldBlock = true;
  else if (data.scheduleEnabled && isInSchedule(data.scheduleSlots || [])) shouldBlock = true;
  else if (data.isEnabled) shouldBlock = true;
  if (!shouldBlock) return;

  const hostname = resolveHostname(url.hostname);

  // Snooze check — only in blocklist mode
  if (!data.hardLock && !data.allowlistMode) {
    const snoozed = data.snoozedSites || {};
    const snoozedEntry = snoozed[hostname];
    if (snoozedEntry !== undefined) {
      if (snoozedEntry === -1) return; // indefinite snooze
      if (Date.now() < snoozedEntry) return; // still within snooze window
      const updatedSnooze = { ...snoozed };
      delete updatedSnooze[hostname];
      chrome.storage.local.set({ snoozedSites: updatedSnooze });
    }
  }

  // Temp allow check
  const tempAllow = (data.tempAllowList || []);
  if (tempAllow.some(s => matchPattern(details.url, s))) return;

  // Blocked list check
  const blocked = (data.blockedSites || []);
  const isMatched = blocked.some(site => matchPattern(details.url, site));

  let blockSite = false;
  if (data.allowlistMode) {
    const isExtensionPage = details.url.startsWith("chrome-extension://") || details.url.startsWith("chrome://") || details.url.startsWith("edge://") || details.url.startsWith("about:");
    const isSpecialHost = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isMatched && !isExtensionPage && !isSpecialHost) {
      blockSite = true;
    }
  } else {
    if (isMatched) {
      blockSite = true;
    }
  }

  if (!blockSite) return;

  // Record stats
  const today = todayKey();
  const stats = data.stats || {};
  if (!stats[today]) stats[today] = { blocked: 0, sites: {} };
  stats[today].blocked += 1;
  stats[today].sites[hostname] = (stats[today].sites[hostname] || 0) + 1;
  await chrome.storage.local.set({ stats });

  const targetPageName = data.breatheMode ? "interstitial.html" : "blocked.html";
  const redirectPage = chrome.runtime.getURL(`pages/${targetPageName}`);

  const blockedUrl = redirectPage
    + "?site=" + encodeURIComponent(hostname)
    + "&original=" + encodeURIComponent(details.url);

  chrome.tabs.update(details.tabId, { url: blockedUrl }).catch(() => {});
}

// ── Navigation Listeners ──────────────────────────────────────────────────────

chrome.webNavigation.onBeforeNavigate.addListener(checkAndBlock);

chrome.webNavigation.onCommitted.addListener((details) => {
  const redirectTypes = ["server_redirect", "client_redirect"];
  if (redirectTypes.includes(details.transitionType) ||
      (details.transitionQualifiers && details.transitionQualifiers.some(q => q.includes("redirect")))) {
    checkAndBlock(details);
  }
});

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
    chrome.storage.local.get(["tempAllowList", "tempAllowExpiry"]).then(d => {
      const list = d.tempAllowList || [];
      const expiry = d.tempAllowExpiry || {};
      if (!list.includes(msg.site)) list.push(msg.site);
      expiry[msg.site] = msg.minutes ? Date.now() + msg.minutes * 60 * 1000 : Infinity;
      chrome.storage.local.set({ tempAllowList: list, tempAllowExpiry: expiry })
        .then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});

// ── Time Tracking ─────────────────────────────────────────────────────────────

async function getActiveTabInfo() {
  const d = await chrome.storage.local.get('activeTabInfo');
  return d.activeTabInfo || { domain: null, startTime: null, id: null };
}

async function setActiveTabInfo(info) {
  await chrome.storage.local.set({ activeTabInfo: info });
}

async function flushActiveTime() {
  const info = await getActiveTabInfo();
  if (!info.domain || !info.startTime) return;
  const elapsed = Math.floor((Date.now() - info.startTime) / 1000);
  if (elapsed <= 0) return;

  info.startTime = Date.now();
  await setActiveTabInfo(info);

  const today = todayKey();
  const data = await chrome.storage.local.get(['timeSpent', 'timeLimits', 'stats', 'breatheMode']);
  const timeSpent = data.timeSpent || {};
  if (!timeSpent[today]) timeSpent[today] = {};

  const currentSpent = (timeSpent[today][info.domain] || 0) + elapsed;
  timeSpent[today][info.domain] = currentSpent;

  await chrome.storage.local.set({ timeSpent });

  const limits = data.timeLimits || {};
  const limitMin = limits[info.domain];
  if (limitMin !== undefined) {
    const limitSec = limitMin * 60;
    if (currentSpent >= limitSec) {
      const pageName = data.breatheMode ? "interstitial.html" : "blocked.html";
      const blockedPage = chrome.runtime.getURL(`pages/${pageName}`);
      try {
        const tab = await chrome.tabs.get(info.id);
        if (tab && tab.url && !tab.url.startsWith(chrome.runtime.getURL("pages/"))) {
          const todayStats = data.stats || {};
          if (!todayStats[today]) todayStats[today] = { blocked: 0, sites: {} };
          todayStats[today].blocked += 1;
          todayStats[today].sites[info.domain] = (todayStats[today].sites[info.domain] || 0) + 1;

          await chrome.storage.local.set({ stats: todayStats });

          const blockedUrl = blockedPage
            + "?site=" + encodeURIComponent(info.domain)
            + "&original=" + encodeURIComponent(tab.url);
          chrome.tabs.update(info.id, { url: blockedUrl }).catch(() => {});
        }
      } catch (e) {
        // Tab might have been closed
      }
    }
  }
}

async function updateActiveTab(tabId) {
  await flushActiveTime();
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && tab.active) {
      let url;
      try { url = new URL(tab.url); } catch { return; }
      if (["http:", "https:"].includes(url.protocol)) {
        const domain = resolveHostname(url.hostname);
        await setActiveTabInfo({
          id: tabId,
          domain: domain,
          startTime: Date.now()
        });
      } else {
        await setActiveTabInfo({ id: null, domain: null, startTime: null });
      }
    }
  } catch (e) {
    await setActiveTabInfo({ id: null, domain: null, startTime: null });
  }
}

chrome.tabs.onActivated.addListener(activeInfo => {
  updateActiveTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateActiveTab(tabId);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushActiveTime();
    await setActiveTabInfo({ id: null, domain: null, startTime: null });
  } else {
    chrome.tabs.query({ active: true, windowId: windowId }, tabs => {
      if (tabs && tabs[0]) {
        updateActiveTab(tabs[0].id);
      }
    });
  }
});

// ── Storage Synchronization ───────────────────────────────────────────────────

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && changes.stats) {
    updateBadge(changes.stats.newValue);
  }

  if (namespace === 'local') {
    const keysToQuery = [];
    const changedLocalVals = {};
    for (const key of SYNCED_KEYS) {
      if (changes[key]) {
        keysToQuery.push(key);
        changedLocalVals[key] = changes[key].newValue;
      }
    }
    if (keysToQuery.length > 0) {
      try {
        const syncData = await chrome.storage.sync.get(keysToQuery);
        const syncUpdates = {};
        for (const key of keysToQuery) {
          if (JSON.stringify(syncData[key]) !== JSON.stringify(changedLocalVals[key])) {
            syncUpdates[key] = changedLocalVals[key];
          }
        }
        if (Object.keys(syncUpdates).length > 0) {
          await chrome.storage.sync.set(syncUpdates);
        }
      } catch (e) {
        console.error("Local to sync sync failed", e);
      }
    }
  } else if (namespace === 'sync') {
    const keysToQuery = [];
    const changedSyncVals = {};
    for (const key of SYNCED_KEYS) {
      if (changes[key]) {
        keysToQuery.push(key);
        changedSyncVals[key] = changes[key].newValue;
      }
    }
    if (keysToQuery.length > 0) {
      try {
        const localData = await chrome.storage.local.get(keysToQuery);
        const localUpdates = {};
        for (const key of keysToQuery) {
          if (JSON.stringify(localData[key]) !== JSON.stringify(changedSyncVals[key])) {
            localUpdates[key] = changedSyncVals[key];
          }
        }
        if (Object.keys(localUpdates).length > 0) {
          await chrome.storage.local.set(localUpdates);
        }
      } catch (e) {
        console.error("Sync to local sync failed", e);
      }
    }
  }
});

// ── Context Menus & Commands ──────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab && tab.url) {
    try {
      const url = new URL(tab.url);
      if (["http:", "https:"].includes(url.protocol)) {
        const hostname = resolveHostname(url.hostname);
        const data = await chrome.storage.local.get(['blockedSites', 'profiles', 'activeProfile']);
        const blocked = data.blockedSites || [];
        if (!blocked.includes(hostname)) {
          blocked.push(hostname);
          const updates = { blockedSites: blocked };
          
          const profiles = data.profiles || {};
          const active = data.activeProfile || 'Mặc định';
          if (!profiles[active]) profiles[active] = {};
          profiles[active].blockedSites = blocked;
          updates.profiles = profiles;

          await chrome.storage.local.set(updates);

          const blockedPage = chrome.runtime.getURL("pages/blocked.html");
          const blockedUrl = blockedPage
            + "?site=" + encodeURIComponent(hostname)
            + "&original=" + encodeURIComponent(tab.url);
          chrome.tabs.update(tab.id, { url: blockedUrl }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Context menu block error:", e);
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-enable") {
    const data = await chrome.storage.local.get(['isEnabled', 'hardLock', 'hardLockUntil', 'pomodoroActive']);
    const isLocked = data.hardLock && data.hardLockUntil && Date.now() < data.hardLockUntil;
    if (isLocked || data.pomodoroActive) {
      notify("FocusGuard", "Không thể tắt khi đang Khóa cứng hoặc chạy Pomodoro.", "system");
      return;
    }
    const nextState = !data.isEnabled;
    await chrome.storage.local.set({ isEnabled: nextState });
    notify("FocusGuard", nextState ? "Đã bật bảo vệ." : "Đã tạm dừng bảo vệ.", "system");
  }
});
