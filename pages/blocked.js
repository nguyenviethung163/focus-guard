// FocusGuard v2 — Blocked Page Controller
'use strict';

import { $, applyTheme } from '../lib/utils.js';
import { QUOTES } from '../lib/constants.js';
import { getState } from '../lib/storage.js';

const params = new URLSearchParams(location.search);
const site = params.get('site') || 'unknown';
const original = params.get('original') || '';

$('siteName').textContent = site;
$('favicon').src = 'https://www.google.com/s2/favicons?domain=' + site + '&sz=16';
document.title = 'Bị chặn: ' + site;

// Load state, apply theme and quotes
(async () => {
  const S = await getState();
  applyTheme(S.theme);

  const custom = S.customQuotes || [];
  
  // Adapt constants quotes to match format of custom quotes { text, author }
  const defaultQuotes = QUOTES.map(q => {
    // If quote is already an object, use it. Otherwise adapt string to object format.
    if (typeof q === 'object' && q.text) return q;
    return { text: q, author: 'Khuyết danh' };
  });

  const allQuotes = [...defaultQuotes, ...custom];
  const q = allQuotes[Math.floor(Math.random() * allQuotes.length)];
  $('quoteText').textContent = '"' + q.text + '"';
  $('quoteAuthor').textContent = q.author ? '— ' + q.author : '— Khuyết danh';
})();

// Buttons
$('backBtn').addEventListener('click', () => {
  if (window.history.length > 1) {
    history.back();
  } else {
    chrome.tabs.getCurrent(tab => {
      if (tab) chrome.tabs.remove(tab.id);
      else window.close();
    });
  }
});

$('newtabBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://newtab/' }, () => {
    chrome.tabs.getCurrent(tab => {
      if (tab) chrome.tabs.remove(tab.id);
    });
  });
});

// Allow dropdown
const allowBtn = $('allowBtn');
const allowMenu = $('allowMenu');

allowBtn.addEventListener('click', e => {
  e.stopPropagation();
  allowMenu.classList.toggle('open');
});
document.addEventListener('click', () => allowMenu.classList.remove('open'));

allowMenu.querySelectorAll('.allow-item').forEach(item => {
  item.addEventListener('click', async () => {
    const min = parseInt(item.dataset.min);
    await chrome.runtime.sendMessage({ type: 'TEMP_ALLOW', site, minutes: min });
    if (original) {
      location.href = original;
    } else {
      history.back();
    }
  });
});
