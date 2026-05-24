// FocusGuard v2 — Interstitial Page Controller
'use strict';

import { $, applyTheme } from '../lib/utils.js';
import { getState } from '../lib/storage.js';

const params = new URLSearchParams(location.search);
const site = params.get('site') || 'unknown';
const original = params.get('original') || '';

// Load state and apply theme
(async () => {
  const S = await getState();
  applyTheme(S.theme);
})();

let count = 10;
const countdownEl = $('countdown');
const instructionEl = $('instruction');
const proceedBtn = $('proceedBtn');
const backBtn = $('backBtn');

function updateInstruction(sec) {
  // Cycle every 5 seconds (2.5s inhale, 2.5s exhale)
  const phase = sec % 5;
  if (phase >= 2.5 || phase === 0) {
    instructionEl.textContent = 'Thở ra...';
    instructionEl.style.color = 'var(--red)';
  } else {
    instructionEl.textContent = 'Hít vào...';
    instructionEl.style.color = 'var(--green)';
  }
}

updateInstruction(count);

const timer = setInterval(() => {
  count--;
  countdownEl.textContent = count;
  updateInstruction(count);
  
  if (count <= 0) {
    clearInterval(timer);
    countdownEl.textContent = '✓';
    instructionEl.textContent = 'Sẵn sàng tập trung!';
    instructionEl.style.color = 'var(--green)';
    proceedBtn.disabled = false;
  }
}, 1000);

backBtn.addEventListener('click', () => {
  if (window.history.length > 1) {
    history.back();
  } else {
    chrome.tabs.getCurrent(tab => {
      if (tab) chrome.tabs.remove(tab.id);
      else window.close();
    });
  }
});

proceedBtn.addEventListener('click', async () => {
  // Allow site for 5 minutes
  await chrome.runtime.sendMessage({ type: 'TEMP_ALLOW', site, minutes: 5 });
  if (original) {
    location.href = original;
  } else {
    history.back();
  }
});
