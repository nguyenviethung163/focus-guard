// FocusGuard v2 — Popup Script
'use strict';

let S = {};
let selectedLockMin = 15;
let selectedDays = new Set([1,2,3,4,5]);
let pomoInterval = null;

const $ = id => document.getElementById(id);
const DAY_NAMES = ['CN','T2','T3','T4','T5','T6','T7'];

async function getState() {
  return new Promise(r => chrome.runtime.sendMessage({ type: 'GET_STATE' }, r));
}
async function save(obj) {
  await chrome.storage.local.set(obj);
  S = { ...S, ...obj };
}
function fmt2(n) { return String(n).padStart(2,'0'); }
function fmtMs(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  return fmt2(Math.floor(s/60)) + ':' + fmt2(s%60);
}
function todayKey() { return new Date().toISOString().split('T')[0]; }
function dayKey(offset) {
  const d = new Date(); d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  S = await getState() || {};
  if (!S.snoozedSites) S.snoozedSites = {};
  render();
  setupTabs();
  setupBlock();
  setupPomodoro();
  setupSchedule();
  setupStats();
  setupImport();
})();

// ── Tabs ──────────────────────────────────────────────────────────────────────
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

function render() {
  renderHeader();
  renderSiteList();
  renderLock();
  renderCategories();
}

// ── Header ────────────────────────────────────────────────────────────────────
function renderHeader() {
  const isLocked = S.hardLock && S.hardLockUntil && Date.now() < S.hardLockUntil;
  const isPomo = S.pomodoroActive && !S.pomodoroInBreak;
  const active = isLocked || isPomo || S.isEnabled;

  const chk = $('enabledCheck');
  chk.checked = active;
  chk.disabled = isLocked || isPomo;
  $('masterToggle').classList.toggle('locked', isLocked || isPomo);

  let statusTxt = 'Đang bảo vệ bạn';
  if (isLocked) statusTxt = '🔒 Khóa cứng đang bật';
  else if (isPomo) statusTxt = '🍅 Pomodoro đang chạy';
  else if (!active) statusTxt = 'Đã tắt — click để bật lại';
  $('globalStatus').textContent = statusTxt;

  const today = S.stats?.[todayKey()];
  $('statBlocked').textContent = today?.blocked || 0;
  $('statSites').textContent = (S.blockedSites || []).length;
  $('statStreak').textContent = calcStreak();
}

function calcStreak() {
  const stats = S.stats || {};
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const k = dayKey(i);
    if (stats[k] && stats[k].blocked > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ── Block tab ─────────────────────────────────────────────────────────────────
function setupBlock() {
  $('enabledCheck').addEventListener('change', async e => {
    const isLocked = S.hardLock && S.hardLockUntil && Date.now() < S.hardLockUntil;
    if (isLocked || S.pomodoroActive) { e.target.checked = true; return; }
    await save({ isEnabled: e.target.checked });
    renderHeader();
  });
  $('addBtn').addEventListener('click', addSite);
  $('siteInput').addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });
  document.querySelectorAll('.chip[data-cat]').forEach(chip => {
    chip.addEventListener('click', () => toggleCategory(chip.dataset.cat));
  });
  document.querySelectorAll('.lock-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.lock-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedLockMin = parseInt(opt.dataset.min);
    });
  });
  $('lockBtn').addEventListener('click', activateLock);

  // Close any open snooze menus on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.snooze-menu.open').forEach(m => m.classList.remove('open'));
  });
}

// ── Snooze helpers ─────────────────────────────────────────────────────────────
function isSnoozed(site) {
  const snooze = S.snoozedSites || {};
  if (!snooze[site]) return false;
  if (snooze[site] === -1) return true; // indefinite
  return Date.now() < snooze[site];
}

function snoozeLabel(site) {
  const snooze = S.snoozedSites || {};
  if (!snooze[site]) return null;
  if (snooze[site] === -1) return 'Tạm dừng ∞';
  const rem = snooze[site] - Date.now();
  if (rem <= 0) return null;
  const m = Math.floor(rem / 60000);
  if (m < 60) return `Tạm dừng ${m}ph`;
  return `Tạm dừng ${Math.round(m/60)}h`;
}

async function snoozeSite(site, minutes) {
  const snooze = { ...(S.snoozedSites || {}) };
  snooze[site] = minutes === -1 ? -1 : Date.now() + minutes * 60 * 1000;
  await save({ snoozedSites: snooze });
  renderSiteList();
}

async function unsnoozeSite(site) {
  const snooze = { ...(S.snoozedSites || {}) };
  delete snooze[site];
  await save({ snoozedSites: snooze });
  renderSiteList();
}

// ── Site list ─────────────────────────────────────────────────────────────────
function renderSiteList() {
  const sites = S.blockedSites || [];
  const today = S.stats?.[todayKey()]?.sites || {};
  const isLocked = S.hardLock && S.hardLockUntil && Date.now() < S.hardLockUntil;
  const list = $('siteList');

  $('countBadge').textContent = sites.length + ' trang';

  if (sites.length === 0) {
    list.innerHTML = '<div class="empty">Chưa có trang nào</div>';
    return;
  }

  list.innerHTML = sites.map((site, i) => {
    const snoozed = isSnoozed(site);
    const slabel = snoozeLabel(site);
    return `
    <div class="site-item${snoozed ? ' snoozed' : ''}">
      <img class="site-favicon" src="https://www.google.com/s2/favicons?domain=${site}&sz=16" onerror="this.style.display='none'" alt=""/>
      <span class="site-domain">${site}</span>
      ${today[site] ? `<span class="site-count">${today[site]}×</span>` : ''}
      ${slabel ? `<span class="snooze-badge">⏸ ${slabel}</span>` : ''}
      <div class="snooze-wrap">
        <button class="snooze-btn" data-site="${site}" title="Tạm dừng chặn">⏸</button>
        <div class="snooze-menu" id="sm-${i}">
          <div class="snooze-item" data-site="${site}" data-min="15">⏸ 15 phút</div>
          <div class="snooze-item" data-site="${site}" data-min="30">⏸ 30 phút</div>
          <div class="snooze-item" data-site="${site}" data-min="60">⏸ 1 giờ</div>
          <div class="snooze-item" data-site="${site}" data-min="120">⏸ 2 giờ</div>
          <div class="snooze-item" data-site="${site}" data-min="480">⏸ 8 giờ</div>
          <div class="snooze-item" data-site="${site}" data-min="-1">⏸ Cho đến khi tắt</div>
          ${snoozed ? `<div class="snooze-item unsnooze" data-site="${site}" data-unsnooze="1">▶ Bật lại ngay</div>` : ''}
        </div>
      </div>
      <button class="site-remove" data-i="${i}" ${isLocked ? 'disabled' : ''} title="Xóa khỏi danh sách">✕</button>
    </div>`;
  }).join('');

  // Snooze button toggles menu
  list.querySelectorAll('.snooze-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const site = btn.dataset.site;
      const idx = (S.blockedSites || []).indexOf(site);
      const menu = $('sm-' + idx);
      const wasOpen = menu.classList.contains('open');
      document.querySelectorAll('.snooze-menu.open').forEach(m => m.classList.remove('open'));
      if (!wasOpen) menu.classList.add('open');
    });
  });

  // Snooze menu items
  list.querySelectorAll('.snooze-item').forEach(item => {
    item.addEventListener('click', async e => {
      e.stopPropagation();
      const site = item.dataset.site;
      document.querySelectorAll('.snooze-menu.open').forEach(m => m.classList.remove('open'));
      if (item.dataset.unsnooze) {
        await unsnoozeSite(site);
      } else {
        await snoozeSite(site, parseInt(item.dataset.min));
      }
    });
  });

  // Remove buttons
  list.querySelectorAll('.site-remove').forEach(btn => {
    btn.addEventListener('click', () => removeSite(parseInt(btn.dataset.i)));
  });
}

async function addSite() {
  let val = $('siteInput').value.trim().toLowerCase();
  if (!val) return;
  val = val.replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
  if (!val.includes('.')) {
    $('siteInput').style.borderColor = 'var(--red)';
    setTimeout(() => $('siteInput').style.borderColor = '', 800);
    return;
  }
  const sites = S.blockedSites || [];
  if (!sites.includes(val)) {
    sites.push(val);
    await save({ blockedSites: sites });
  }
  $('siteInput').value = '';
  renderSiteList();
  renderHeader();
}

async function removeSite(idx) {
  const sites = [...(S.blockedSites||[])];
  const site = sites[idx];
  sites.splice(idx, 1);
  // Also clear snooze for this site
  const snooze = { ...(S.snoozedSites || {}) };
  delete snooze[site];
  await save({ blockedSites: sites, snoozedSites: snooze });
  renderSiteList();
  renderHeader();
}

function renderCategories() {
  const cats = S.categories || {};
  const blocked = S.blockedSites || [];
  document.querySelectorAll('.chip[data-cat]').forEach(chip => {
    const catSites = cats[chip.dataset.cat] || [];
    const allIn = catSites.length > 0 && catSites.every(s => blocked.includes(s));
    chip.classList.toggle('active', allIn);
  });
}

async function toggleCategory(cat) {
  const cats = S.categories || {};
  const catSites = cats[cat] || [];
  let blocked = [...(S.blockedSites||[])];
  const allIn = catSites.every(s => blocked.includes(s));
  if (allIn) {
    blocked = blocked.filter(s => !catSites.includes(s));
  } else {
    catSites.forEach(s => { if (!blocked.includes(s)) blocked.push(s); });
  }
  await save({ blockedSites: blocked });
  renderSiteList();
  renderHeader();
  renderCategories();
}

// ── Import / Export ───────────────────────────────────────────────────────────
function setupImport() {
  $('importBtn').addEventListener('click', () => {
    $('importModal').classList.add('open');
    $('importText').value = '';
    $('importResult').className = 'import-result';
    $('importResult').textContent = '';
  });
  $('importCancelBtn').addEventListener('click', closeModal);
  $('importModal').addEventListener('click', e => { if (e.target === $('importModal')) closeModal(); });
  $('importConfirmBtn').addEventListener('click', doImport);

  // File picker
  $('browseLink').addEventListener('click', () => $('fileInput').click());
  $('dropZone').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) readFile(file);
    e.target.value = '';
  });

  // Drag & drop
  $('dropZone').addEventListener('dragover', e => { e.preventDefault(); $('dropZone').classList.add('drag-over'); });
  $('dropZone').addEventListener('dragleave', () => $('dropZone').classList.remove('drag-over'));
  $('dropZone').addEventListener('drop', e => {
    e.preventDefault();
    $('dropZone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  // Export
  $('exportBtn').addEventListener('click', doExport);
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    let parsed = '';
    if (file.name.endsWith('.json')) {
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) parsed = data.join('\n');
        else if (data.blockedSites) parsed = data.blockedSites.join('\n');
        else parsed = Object.values(data).flat().join('\n');
      } catch { parsed = text; }
    } else {
      parsed = text;
    }
    $('importText').value = parsed;
  };
  reader.readAsText(file);
}

function parseDomains(raw) {
  return raw
    .split(/[\n,;\s]+/)
    .map(s => s.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
    )
    .filter(s => s.includes('.') && s.length > 3 && !s.startsWith('#'));
}

async function doImport() {
  const raw = $('importText').value;
  if (!raw.trim()) return;

  const incoming = parseDomains(raw);
  if (incoming.length === 0) {
    showImportResult('err', 'Không tìm thấy domain hợp lệ nào.');
    return;
  }

  const existing = S.blockedSites || [];
  const toAdd = incoming.filter(s => !existing.includes(s));
  const dupes = incoming.length - toAdd.length;
  const merged = [...existing, ...toAdd];

  await save({ blockedSites: merged });
  renderSiteList();
  renderHeader();

  const msg = `✅ Đã thêm ${toAdd.length} trang.${dupes > 0 ? ` (${dupes} trùng lặp bỏ qua)` : ''}`;
  showImportResult('ok', msg);
  setTimeout(closeModal, 1800);
}

function showImportResult(type, msg) {
  const el = $('importResult');
  el.className = 'import-result ' + type;
  el.textContent = msg;
}

function closeModal() {
  $('importModal').classList.remove('open');
}

function doExport() {
  const sites = S.blockedSites || [];
  if (sites.length === 0) return;
  const blob = new Blob([sites.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'focusguard-blocklist.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Lock ──────────────────────────────────────────────────────────────────────
function renderLock() {
  const isLocked = S.hardLock && S.hardLockUntil && Date.now() < S.hardLockUntil;
  const alert = $('lockAlert');
  const btn = $('lockBtn');
  if (isLocked) {
    alert.classList.add('show');
    btn.textContent = '🔒 Đang khóa…';
    btn.disabled = true;
    updateCountdown();
    if (!window._countdownInterval) {
      window._countdownInterval = setInterval(updateCountdown, 1000);
    }
  } else {
    alert.classList.remove('show');
    btn.textContent = '🔒 Kích hoạt khóa cứng';
    btn.disabled = false;
    clearInterval(window._countdownInterval);
    window._countdownInterval = null;
  }
}

function updateCountdown() {
  if (!S.hardLockUntil) return;
  const rem = S.hardLockUntil - Date.now();
  if (rem <= 0) {
    $('lockCountdown').textContent = '00:00';
    S.hardLock = false; S.hardLockUntil = null;
    renderLock(); renderHeader();
    return;
  }
  const m = Math.floor(rem/60000), s = Math.floor((rem%60000)/1000);
  $('lockCountdown').textContent = fmt2(m) + ':' + fmt2(s);
}

async function activateLock() {
  const dur = selectedLockMin;
  const label = dur >= 60 ? (dur/60) + ' giờ' : dur + ' phút';
  if (!confirm(`Khóa cứng ${label}?\n\nTrong thời gian này bạn KHÔNG THỂ tắt FocusGuard.`)) return;
  const until = Date.now() + dur * 60 * 1000;
  await save({ hardLock: true, hardLockUntil: until, isEnabled: true });
  renderLock();
  renderHeader();
}

// ── Pomodoro ──────────────────────────────────────────────────────────────────
function setupPomodoro() {
  $('pomoStartBtn').addEventListener('click', startPomodoro);
  $('pomoStopBtn').addEventListener('click', stopPomodoro);
}

async function startPomodoro() {
  const workMin = parseInt($('pomoWork').value) || 25;
  const breakMin = parseInt($('pomoBreak').value) || 5;
  await chrome.runtime.sendMessage({ type: 'START_POMODORO', workMin, breakMin });
  S = await getState();
  renderPomodoro();
}

async function stopPomodoro() {
  await chrome.runtime.sendMessage({ type: 'STOP_POMODORO' });
  S = await getState();
  clearInterval(pomoInterval);
  pomoInterval = null;
  renderPomodoro();
}

function renderPomodoro() {
  const active = S.pomodoroActive;
  const inBreak = S.pomodoroInBreak;
  const workMin = S.pomodoroWork || 25;
  const breakMin = S.pomodoroBreak || 5;
  const count = S.pomodoroCount || 0;
  const totalMs = (inBreak ? breakMin : workMin) * 60 * 1000;
  const circum = 276.46;

  $('pomoCount').textContent = '🍅 × ' + count;
  $('pomoStartBtn').disabled = active;
  $('pomoStopBtn').disabled = !active;
  $('pomoSettings').style.opacity = active ? '0.4' : '';
  $('pomoSettings').style.pointerEvents = active ? 'none' : '';
  $('pomoRingFill').classList.toggle('break', !!inBreak);

  if (!active) {
    $('pomoTime').textContent = fmt2(workMin) + ':00';
    $('pomoPhase').textContent = 'Sẵn sàng';
    $('pomoStartBtn').textContent = '▶ Bắt đầu';
    $('pomoRingFill').style.strokeDashoffset = '0';
    $('pomoBadge').innerHTML = '';
    clearInterval(pomoInterval); pomoInterval = null;
    return;
  }

  function tick() {
    if (!S.pomodoroActive || !S.pomodoroEnd) return;
    const rem = Math.max(0, S.pomodoroEnd - Date.now());
    $('pomoTime').textContent = fmtMs(rem);
    $('pomoPhase').textContent = S.pomodoroInBreak ? 'Nghỉ ngơi' : 'Tập trung';
    $('pomoStartBtn').textContent = S.pomodoroInBreak ? '☕ Đang nghỉ' : '⏳ Đang làm';
    const elapsed = totalMs - rem;
    $('pomoRingFill').style.strokeDashoffset = circum * (1 - Math.min(1, elapsed / totalMs));
    $('pomoBadge').innerHTML = inBreak
      ? '<span class="badge badge-green">☕ Giờ nghỉ</span>'
      : '<span class="badge badge-red">🔥 Đang tập trung</span>';
  }
  tick();
  clearInterval(pomoInterval);
  pomoInterval = setInterval(tick, 1000);
}

// ── Schedule ──────────────────────────────────────────────────────────────────
function setupSchedule() {
  document.querySelectorAll('.day-btn').forEach(btn => {
    const d = parseInt(btn.dataset.day);
    if (selectedDays.has(d)) btn.classList.add('on');
    btn.addEventListener('click', () => {
      if (selectedDays.has(d)) selectedDays.delete(d); else selectedDays.add(d);
      btn.classList.toggle('on', selectedDays.has(d));
    });
  });
  $('scheduleEnabled').addEventListener('change', async e => {
    await save({ scheduleEnabled: e.target.checked });
  });
  $('addSlotBtn').addEventListener('click', addSlot);
  renderSchedule();
}

async function addSlot() {
  const from = $('timeFrom').value;
  const to = $('timeTo').value;
  if (!from || !to || selectedDays.size === 0) return;
  const slots = [...(S.scheduleSlots||[])];
  slots.push({ days: [...selectedDays], from, to });
  await save({ scheduleSlots: slots });
  renderSchedule();
}

function renderSchedule() {
  $('scheduleEnabled').checked = !!S.scheduleEnabled;
  const slots = S.scheduleSlots || [];
  const list = $('scheduleList');
  if (slots.length === 0) {
    list.innerHTML = '<div class="empty">Chưa có lịch nào</div>';
    return;
  }
  list.innerHTML = slots.map((slot, i) => `
    <div class="schedule-item">
      <span class="schedule-days">${slot.days.sort().map(d=>DAY_NAMES[d]).join(', ')}</span>
      <span class="schedule-time">${slot.from} → ${slot.to}</span>
      <button class="site-remove" data-si="${i}" title="Xóa">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-si]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slots2 = [...(S.scheduleSlots||[])];
      slots2.splice(parseInt(btn.dataset.si),1);
      await save({ scheduleSlots: slots2 });
      renderSchedule();
    });
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function setupStats() {
  $('clearStatsBtn').addEventListener('click', async () => {
    if (confirm('Xóa toàn bộ thống kê?')) {
      await save({ stats: {} }); S.stats = {};
      renderStats();
    }
  });
}

function renderStats() {
  const stats = S.stats || {};
  const today = stats[todayKey()];
  let weekBlocked = 0, totalBlocked = 0;
  for (let i = 0; i < 7; i++) weekBlocked += stats[dayKey(i)]?.blocked || 0;
  Object.values(stats).forEach(d => totalBlocked += d.blocked || 0);

  $('statsToday').textContent = today?.blocked || 0;
  $('statsWeek').textContent = weekBlocked;
  $('statsTotal').textContent = totalBlocked;

  const maxVal = Math.max(1, ...Array.from({length:7},(_,i)=>stats[dayKey(i)]?.blocked||0));
  $('barChart').innerHTML = Array.from({length:7},(_,i)=>{
    const k = dayKey(6-i);
    const v = stats[k]?.blocked || 0;
    const d = new Date(k);
    const label = i===6 ? 'Hôm' : fmt2(d.getDate())+'/'+fmt2(d.getMonth()+1);
    const pct = Math.round((v/maxVal)*100);
    return `<div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"><span class="bar-val">${v||''}</span></div></div>
    </div>`;
  }).join('');

  const siteMap = {};
  Object.values(stats).forEach(d => {
    Object.entries(d.sites||{}).forEach(([s,n]) => { siteMap[s]=(siteMap[s]||0)+n; });
  });
  const sorted = Object.entries(siteMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  $('topSites').innerHTML = sorted.length === 0
    ? '<div class="empty">Chưa có dữ liệu</div>'
    : sorted.map(([site,n]) => `
        <div class="top-site-row">
          <span class="top-site-name">${site}</span>
          <span class="top-site-n">${n}×</span>
        </div>`).join('');
}

// ── Periodic refresh ──────────────────────────────────────────────────────────
setInterval(async () => {
  const fresh = await getState();
  if (!fresh) return;
  S = fresh;
  if (!S.snoozedSites) S.snoozedSites = {};
  renderHeader();
  renderLock();
  // Expire snoozed sites silently
  renderSiteList();
}, 5000);
