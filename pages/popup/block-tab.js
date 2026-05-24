// FocusGuard v2 — Popup Block Tab Module
'use strict';

import { $, escapeHtml, isHardLocked } from '../../lib/utils.js';
import { LOCK_DEFAULT_MIN, SNOOZE_OPTIONS } from '../../lib/constants.js';
import { state, save, renderHeader } from '../popup.js';
import { isSnoozed, snoozeLabel, snoozeSite, unsnoozeSite } from './snooze.js';
import { renderLimitsList } from './limits.js';

let selectedLockMin = LOCK_DEFAULT_MIN;

export function setupBlock() {
  $('enabledCheck').addEventListener('change', async e => {
    if (isHardLocked(state.S) || state.S.pomodoroActive) {
      e.target.checked = true;
      return;
    }
    await save({ isEnabled: e.target.checked });
    renderHeader();
  });

  $('allowlistModeToggle').checked = !!state.S.allowlistMode;
  $('allowlistModeToggle').addEventListener('change', async e => {
    await save({ allowlistMode: e.target.checked });
    renderSiteList();
    renderLimitsList();
  });

  $('addBtn').addEventListener('click', addSite);
  $('siteInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addSite();
  });

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

export function renderSiteList() {
  const sites = state.S.blockedSites || [];
  const today = state.S.stats?.[new Date().toISOString().split('T')[0]]?.sites || {};
  const isLocked = isHardLocked(state.S);
  const list = $('siteList');

  const isAllowlist = !!state.S.allowlistMode;
  const countLabel = document.querySelector('#statSites + .stat-label');
  if (countLabel) countLabel.textContent = isAllowlist ? 'Cho phép' : 'Trang chặn';

  const sectionTitle = document.querySelector('#page-block .section-title');
  if (sectionTitle) {
    sectionTitle.innerHTML = isAllowlist
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Danh sách cho phép`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Danh sách chặn`;
  }
  $('siteInput').placeholder = isAllowlist ? 'google.com (cho phép)' : 'facebook.com';
  $('countBadge').textContent = sites.length + ' trang';

  if (sites.length === 0) {
    list.innerHTML = '<div class="empty">Chưa có trang nào</div>';
    return;
  }

  list.innerHTML = sites.map((site, i) => {
    const snoozed = isSnoozed(site);
    const slabel = snoozeLabel(site);
    const escSite = escapeHtml(site);
    const showSnooze = !state.S.allowlistMode;
    
    return `
    <div class="site-item${snoozed ? ' snoozed' : ''}">
      <img class="site-favicon" src="https://www.google.com/s2/favicons?domain=${escSite}&sz=16" onerror="this.style.display='none'" alt=""/>
      <span class="site-domain">${escSite}</span>
      ${today[site] ? `<span class="site-count">${today[site]}×</span>` : ''}
      ${slabel ? `<span class="snooze-badge">⏸ ${slabel}</span>` : ''}
      ${showSnooze ? `
      <div class="snooze-wrap">
        <button class="snooze-btn" data-site="${escSite}" title="Tạm dừng chặn">⏸</button>
        <div class="snooze-menu" id="sm-${i}">
          <div class="snooze-item" data-site="${escSite}" data-min="15">⏸ 15 phút</div>
          <div class="snooze-item" data-site="${escSite}" data-min="30">⏸ 30 phút</div>
          <div class="snooze-item" data-site="${escSite}" data-min="60">⏸ 1 giờ</div>
          <div class="snooze-item" data-site="${escSite}" data-min="120">⏸ 2 giờ</div>
          <div class="snooze-item" data-site="${escSite}" data-min="480">⏸ 8 giờ</div>
          <div class="snooze-item" data-site="${escSite}" data-min="-1">⏸ Cho đến khi tắt</div>
          ${snoozed ? `<div class="snooze-item unsnooze" data-site="${escSite}" data-unsnooze="1">▶ Bật lại ngay</div>` : ''}
        </div>
      </div>` : ''}
      <button class="site-remove" data-i="${i}" ${isLocked ? 'disabled' : ''} title="Xóa khỏi danh sách">✕</button>
    </div>`;
  }).join('');

  // Snooze button toggles menu
  if (!state.S.allowlistMode) {
    list.querySelectorAll('.snooze-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const site = btn.dataset.site;
        const idx = (state.S.blockedSites || []).indexOf(site);
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
  }

  // Remove buttons
  list.querySelectorAll('.site-remove').forEach(btn => {
    btn.addEventListener('click', () => removeSite(parseInt(btn.dataset.i)));
  });
}

async function addSite() {
  let val = $('siteInput').value.trim().toLowerCase();
  if (!val) return;
  val = val.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!val.includes('.')) {
    $('siteInput').classList.add('input-error');
    setTimeout(() => $('siteInput').classList.remove('input-error'), 800);
    return;
  }
  const sites = state.S.blockedSites || [];
  if (!sites.includes(val)) {
    sites.push(val);
    await save({ blockedSites: sites });
  }
  $('siteInput').value = '';
  renderSiteList();
  renderHeader();
}

async function removeSite(idx) {
  const sites = [...(state.S.blockedSites || [])];
  const site = sites[idx];
  sites.splice(idx, 1);
  // Also clear snooze for this site
  const snooze = { ...(state.S.snoozedSites || {}) };
  delete snooze[site];
  await save({ blockedSites: sites, snoozedSites: snooze });
  renderSiteList();
  renderHeader();
}

export function renderCategories() {
  const cats = state.S.categories || {};
  const blocked = state.S.blockedSites || [];
  document.querySelectorAll('.chip[data-cat]').forEach(chip => {
    const catSites = cats[chip.dataset.cat] || [];
    const allIn = catSites.length > 0 && catSites.every(s => blocked.includes(s));
    chip.classList.toggle('active', allIn);
  });
}

async function toggleCategory(cat) {
  const cats = state.S.categories || {};
  const catSites = cats[cat] || [];
  let blocked = [...(state.S.blockedSites || [])];
  const allIn = catSites.every(s => blocked.includes(s));
  if (allIn) {
    blocked = blocked.filter(s => !catSites.includes(s));
  } else {
    catSites.forEach(s => {
      if (!blocked.includes(s)) blocked.push(s);
    });
  }
  await save({ blockedSites: blocked });
  renderSiteList();
  renderHeader();
  renderCategories();
}

async function activateLock() {
  const dur = selectedLockMin;
  const label = dur >= 60 ? (dur / 60) + ' giờ' : dur + ' phút';
  if (!confirm(`Khóa cứng ${label}?\n\nTrong thời gian này bạn KHÔNG THỂ tắt FocusGuard.`)) return;
  const until = Date.now() + dur * 60 * 1000;
  await save({ hardLock: true, hardLockUntil: until, isEnabled: true });
}
