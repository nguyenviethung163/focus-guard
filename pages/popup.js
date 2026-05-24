// FocusGuard v2 — Popup Coordinator Script
'use strict';

import { getState, saveWithProfile } from '../lib/storage.js';
import { $, applyTheme, isHardLocked, todayKey, dayKey, calcStreak, fmt2 } from '../lib/utils.js';

import { setupBlock, renderSiteList, renderCategories } from './popup/block-tab.js';
import { setupPomodoro, renderPomodoro } from './popup/pomodoro.js';
import { setupSchedule, renderSchedule } from './popup/schedule.js';
import { setupStats, renderStats } from './popup/stats-tab.js';
import { setupImport } from './popup/import-export.js';
import { setupProfiles } from './popup/profiles.js';
import { setupLimits, renderLimitsList } from './popup/limits.js';

// State Wrapper
export const state = {
  S: {}
};

let countdownInterval = null;

export async function save(obj) {
  const updated = await saveWithProfile(obj);
  state.S = { ...state.S, ...updated };
  renderAll();
}

export function renderAll() {
  applyTheme(state.S.theme);
  renderHeader();
  renderSiteList();
  renderLock();
  renderCategories();
  renderLimitsList();
  
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    if (activeTab.dataset.tab === 'stats') renderStats();
    if (activeTab.dataset.tab === 'pomodoro') renderPomodoro();
  }
}

// ── Header Rendering ──────────────────────────────────────────────────────────

export function renderHeader() {
  const isLocked = isHardLocked(state.S);
  const isPomo = state.S.pomodoroActive && !state.S.pomodoroInBreak;
  const active = isLocked || isPomo || state.S.isEnabled;

  const chk = $('enabledCheck');
  chk.checked = active;
  chk.disabled = isLocked || isPomo;
  $('masterToggle').classList.toggle('locked', isLocked || isPomo);

  let statusTxt = 'Đang bảo vệ bạn';
  if (isLocked) {
    statusTxt = '🔒 Khóa cứng đang bật';
  } else if (isPomo) {
    statusTxt = '🍅 Pomodoro đang chạy';
  } else if (!active) {
    statusTxt = 'Đã tắt — click để bật lại';
  }
  $('globalStatus').textContent = statusTxt;

  const today = state.S.stats?.[todayKey()];
  $('statBlocked').textContent = today?.blocked || 0;
  $('statSites').textContent = (state.S.blockedSites || []).length;
  $('statStreak').textContent = calcStreak(state.S.stats);
}

// ── Hard Lock Management ──────────────────────────────────────────────────────

export function renderLock() {
  const isLocked = isHardLocked(state.S);
  const alert = $('lockAlert');
  const btn = $('lockBtn');
  if (isLocked) {
    alert.classList.add('show');
    btn.textContent = '🔒 Đang khóa…';
    btn.disabled = true;
    updateCountdown();
    if (!countdownInterval) {
      countdownInterval = setInterval(updateCountdown, 1000);
    }
  } else {
    alert.classList.remove('show');
    btn.textContent = '🔒 Kích hoạt khóa cứng';
    btn.disabled = false;
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
}

function updateCountdown() {
  if (!state.S.hardLockUntil) return;
  const rem = state.S.hardLockUntil - Date.now();
  if (rem <= 0) {
    $('lockCountdown').textContent = '00:00';
    save({ hardLock: false, hardLockUntil: null });
    return;
  }
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  $('lockCountdown').textContent = fmt2(m) + ':' + fmt2(s);
}

// ── Tab Management ────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('page-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'stats') renderStats();
      if (tab.dataset.tab === 'pomodoro') renderPomodoro();
    });
  });
}

// ── Initialization ────────────────────────────────────────────────────────────

(async () => {
  state.S = await getState() || {};
  if (!state.S.snoozedSites) state.S.snoozedSites = {};
  
  applyTheme(state.S.theme);
  
  // Set up submodules
  setupTabs();
  setupBlock();
  setupPomodoro();
  setupSchedule();
  setupStats();
  setupImport();
  setupProfiles();
  setupLimits();

  renderAll();

  $('openOptionsBtn').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html');
    }
  });

  $('openStatsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/stats.html') });
  });
})();

// ── Storage Events ────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    const fresh = await getState();
    if (!fresh) return;
    state.S = fresh;
    if (!state.S.snoozedSites) state.S.snoozedSites = {};
    
    renderAll();
  }
});

export { renderSiteList };
