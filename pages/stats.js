// FocusGuard v2 — Stats Page Controller
'use strict';

import {
  $,
  fmt2,
  todayKey,
  dayKey,
  calcStreak,
  applyTheme,
  escapeHtml,
  downloadBlob
} from '../lib/utils.js';

import {
  TIME_SAVED_PER_BLOCK_MIN,
  WEEKLY_QUOTES
} from '../lib/constants.js';

import {
  getState
} from '../lib/storage.js';

let S = {};

async function loadData() {
  S = await getState();
}

function renderDashboard() {
  const stats = S.stats || {};
  const today = stats[todayKey()];

  // Calculate Cards Data
  let weekBlocked = 0;
  let monthBlocked = 0;
  let totalBlocked = 0;

  for (let i = 0; i < 7; i++) {
    weekBlocked += stats[dayKey(i)]?.blocked || 0;
  }
  for (let i = 0; i < 30; i++) {
    monthBlocked += stats[dayKey(i)]?.blocked || 0;
  }
  Object.values(stats).forEach(d => {
    totalBlocked += d.blocked || 0;
  });

  $('statsToday').textContent = today?.blocked || 0;
  $('statsWeek').textContent = weekBlocked;
  $('statsMonth').textContent = monthBlocked;
  $('statsTotal').textContent = totalBlocked;

  // Calculate Distracted Time spent today
  const todaySpent = S.timeSpent?.[todayKey()] || {};
  const blockedSites = S.blockedSites || [];
  let distractedMin = 0;
  Object.entries(todaySpent).forEach(([domain, sec]) => {
    const isBlocked = blockedSites.some(site => {
      const clean = site.replace(/^www\./, "");
      const cleanDom = domain.replace(/^www\./, "");
      return cleanDom === clean || cleanDom.endsWith("." + clean);
    });
    if (isBlocked) distractedMin += Math.round(sec / 60);
  });
  $('distractedTime').textContent = `${distractedMin} phút`;

  // Total time saved: 5 mins per block (using TIME_SAVED_PER_BLOCK_MIN)
  $('timeSaved').textContent = `${totalBlocked * TIME_SAVED_PER_BLOCK_MIN} phút`;

  // Render 30-Day Bar Chart
  const barChart = $('barChart');
  const days30 = [];
  let maxBlockedVal = 1;

  for (let i = 29; i >= 0; i--) {
    const k = dayKey(i);
    const v = stats[k]?.blocked || 0;
    days30.push({ key: k, val: v });
    if (v > maxBlockedVal) maxBlockedVal = v;
  }

  barChart.innerHTML = days30.map(day => {
    const [_, m, d] = day.key.split('-');
    const label = `${d}/${m}`;
    const pct = Math.round((day.val / maxBlockedVal) * 100);
    return `
      <div class="chart-bar-wrap">
        <div class="chart-tooltip">${label}: ${day.val} lần</div>
        <div class="chart-bar" style="height: ${pct}%"></div>
        <div class="chart-label-day">${label.split('/')[0]}</div>
      </div>
    `;
  }).join('');

  // Process Top Blocked Sites & Achievements
  const siteMap = {};
  let activeDaysCount = 0;
  let peakDay = 'N/A';
  let peakVal = 0;

  Object.entries(stats).forEach(([dateKey, data]) => {
    if (data.blocked > 0) {
      activeDaysCount++;
      if (data.blocked > peakVal) {
        peakVal = data.blocked;
        const [y, m, d] = dateKey.split('-');
        peakDay = `${d}/${m}/${y} (${data.blocked} lần)`;
      }
    }
    Object.entries(data.sites || {}).forEach(([site, n]) => {
      siteMap[site] = (siteMap[site] || 0) + n;
    });
  });

  const sortedSites = Object.entries(siteMap).sort((a, b) => b[1] - a[1]);
  const top10 = sortedSites.slice(0, 10);

  // Render Table
  const tbody = $('topSitesList');
  if (top10.length === 0) {
    tbody.innerHTML = '';
    $('topSitesEmpty').style.display = 'block';
  } else {
    $('topSitesEmpty').style.display = 'none';
    tbody.innerHTML = top10.map(([site, count]) => {
      const escSite = escapeHtml(site);
      return `
        <tr>
          <td>
            <div class="site-cell">
              <img class="site-icon" src="https://www.google.com/s2/favicons?domain=${escSite}&sz=32" onerror="this.src='../icons/icon16.png'" alt=""/>
              <span class="site-name">${escSite}</span>
            </div>
          </td>
          <td style="text-align: right;"><span class="count-badge">${count}</span></td>
        </tr>
      `;
    }).join('');
  }

  // Streak & Summary Achievements
  $('statsStreak').textContent = `${calcStreak(S.stats)} ngày`;
  $('mostBlockedSite').textContent = top10[0] ? top10[0][0] : 'Không có';
  
  const avg = activeDaysCount > 0 ? (totalBlocked / activeDaysCount).toFixed(1) : '0';
  $('avgBlockedPerDay').textContent = avg;
  $('peakBlockedDay').textContent = peakDay;
}

// ── Event Handlers ────────────────────────────────────────────────────────────

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

$('exportStatsBtn').addEventListener('click', () => {
  const stats = S.stats || {};
  if (Object.keys(stats).length === 0) {
    alert('Chưa có dữ liệu thống kê để xuất.');
    return;
  }
  const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `focusguard-stats-${todayKey()}.json`);
});

$('clearStatsBtn').addEventListener('click', async () => {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ thống kê? Thao tác này không thể hoàn tác.')) {
    await chrome.storage.local.set({ stats: {}, timeSpent: {} });
    S.stats = {};
    S.timeSpent = {};
    renderDashboard();
  }
});

// ── Weekly Report Modal ───────────────────────────────────────────────────────

$('weeklyReportBtn').addEventListener('click', () => {
  const stats = S.stats || {};
  
  // Calculate date range (6 days ago -> today)
  const dStart = new Date(dayKey(6));
  const dEnd = new Date(dayKey(0));
  const dateRangeStr = `${fmt2(dStart.getDate())}/${fmt2(dStart.getMonth()+1)}/${dStart.getFullYear()} – ${fmt2(dEnd.getDate())}/${fmt2(dEnd.getMonth()+1)}/${dEnd.getFullYear()}`;
  $('weeklyDateRange').textContent = dateRangeStr;

  // Calculate stats this week
  let weeklyBlocked = 0;
  const weeklySiteMap = {};
  for (let i = 0; i < 7; i++) {
    const k = dayKey(i);
    const dayData = stats[k] || {};
    weeklyBlocked += dayData.blocked || 0;
    Object.entries(dayData.sites || {}).forEach(([site, n]) => {
      weeklySiteMap[site] = (weeklySiteMap[site] || 0) + n;
    });
  }

  const sortedSites = Object.entries(weeklySiteMap).sort((a, b) => b[1] - a[1]);
  const topSite = sortedSites[0] ? sortedSites[0][0] : 'Không có';

  $('weeklyTotalBlocked').textContent = `${weeklyBlocked} lần`;
  $('weeklyStreak').textContent = `${calcStreak(S.stats)} ngày`;
  $('weeklyTopSite').textContent = topSite;
  $('weeklyTimeSaved').textContent = `${weeklyBlocked * TIME_SAVED_PER_BLOCK_MIN} phút`;

  // Quote selection
  const randQuote = WEEKLY_QUOTES[Math.floor(Math.random() * WEEKLY_QUOTES.length)];
  $('weeklyMotivationalQuote').textContent = `"${randQuote}"`;

  // Show modal
  $('weeklyModal').style.display = 'flex';
});

$('closeWeeklyBtn').addEventListener('click', () => {
  $('weeklyModal').style.display = 'none';
});

$('weeklyModal').addEventListener('click', (e) => {
  if (e.target === $('weeklyModal')) {
    $('weeklyModal').style.display = 'none';
  }
});

$('shareBtn').addEventListener('click', () => {
  alert("Bạn hãy nhấn tổ hợp phím Win + Shift + S (trên Windows) để chụp lại vùng thẻ báo cáo này và lưu về máy nhé!");
});

// ── Live Updates ──────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.stats) {
    loadData().then(() => {
      renderDashboard();
    });
  }
});

// ── Initialization ────────────────────────────────────────────────────────────

(async () => {
  await loadData();
  applyTheme(S.theme);
  renderDashboard();
})();
