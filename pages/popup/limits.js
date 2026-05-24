// FocusGuard v2 — Popup Limits Module
'use strict';

import { $, escapeHtml, todayKey } from '../../lib/utils.js';
import { state, save } from '../popup.js';

export function setupLimits() {
  const addBtn = $('addLimitBtn');
  if (!addBtn) return;
  
  addBtn.addEventListener('click', async () => {
    const site = $('limitSiteSelect').value;
    const min = parseInt($('limitInput').value);
    if (!site || isNaN(min) || min <= 0) {
      alert("Vui lòng chọn trang và nhập số phút hợp lệ!");
      return;
    }
    const limits = { ...(state.S.timeLimits || {}) };
    limits[site] = min;
    await save({ timeLimits: limits });
    $('limitInput').value = '';
    renderLimitsList();
  });
}

export function renderLimitsList() {
  const select = $('limitSiteSelect');
  const list = $('limitList');
  if (!select || !list) return;

  const blockedSites = state.S.blockedSites || [];
  select.innerHTML = blockedSites.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  const limits = state.S.timeLimits || {};
  const spentToday = state.S.timeSpent?.[todayKey()] || {};
  
  if (Object.keys(limits).length === 0) {
    list.innerHTML = '<div class="empty">Chưa giới hạn trang nào</div>';
    return;
  }

  list.innerHTML = Object.entries(limits).map(([site, limitMin]) => {
    const secSpent = spentToday[site] || 0;
    const minSpent = Math.floor(secSpent / 60);
    const escSite = escapeHtml(site);
    return `
      <div class="site-item">
        <span class="site-domain">${escSite}</span>
        <span style="font-size: 11px; color: var(--t2); font-weight: 500;">${minSpent}p / ${limitMin}p</span>
        <button class="site-remove remove-limit-btn" data-site="${escSite}" title="Xóa giới hạn">✕</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.remove-limit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const site = btn.dataset.site;
      const updated = { ...(state.S.timeLimits || {}) };
      delete updated[site];
      await save({ timeLimits: updated });
      renderLimitsList();
    });
  });
}
