// FocusGuard v2 — Popup Stats Tab Module
'use strict';

import { $, fmt2, todayKey, dayKey } from '../../lib/utils.js';
import { state, save } from '../popup.js';

export function setupStats() {
  $('clearStatsBtn').addEventListener('click', async () => {
    if (confirm('Xóa toàn bộ thống kê?')) {
      await save({ stats: {}, timeSpent: {} });
      renderStats();
    }
  });
}

export function renderStats() {
  const stats = state.S.stats || {};
  const today = stats[todayKey()];
  let weekBlocked = 0;
  let totalBlocked = 0;
  
  for (let i = 0; i < 7; i++) {
    weekBlocked += stats[dayKey(i)]?.blocked || 0;
  }
  Object.values(stats).forEach(d => {
    totalBlocked += d.blocked || 0;
  });

  $('statsToday').textContent = today?.blocked || 0;
  $('statsWeek').textContent = weekBlocked;
  $('statsTotal').textContent = totalBlocked;

  const maxVal = Math.max(1, ...Array.from({ length: 7 }, (_, i) => stats[dayKey(i)]?.blocked || 0));
  
  $('barChart').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const k = dayKey(6 - i);
    const v = stats[k]?.blocked || 0;
    const d = new Date(k);
    const label = i === 6 ? 'Hôm' : fmt2(d.getDate()) + '/' + fmt2(d.getMonth() + 1);
    const pct = Math.round((v / maxVal) * 100);
    return `<div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"><span class="bar-val">${v || ''}</span></div></div>
    </div>`;
  }).join('');

  const siteMap = {};
  Object.values(stats).forEach(d => {
    Object.entries(d.sites || {}).forEach(([s, n]) => {
      siteMap[s] = (siteMap[s] || 0) + n;
    });
  });
  const sorted = Object.entries(siteMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $('topSites').innerHTML = sorted.length === 0
    ? '<div class="empty">Chưa có dữ liệu</div>'
    : sorted.map(([site, n]) => `
        <div class="top-site-row">
          <span class="top-site-name">${site}</span>
          <span class="top-site-n">${n}×</span>
        </div>`).join('');
}
