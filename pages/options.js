// FocusGuard v2 — Options Page Controller
'use strict';

import { $, escapeHtml, applyTheme, downloadBlob } from '../lib/utils.js';
import {
  DEFAULT_STATE,
  BUILT_IN_CATEGORIES,
  CATEGORIES_EMOJI_MAP
} from '../lib/constants.js';
import { getState, saveWithProfile } from '../lib/storage.js';

let S = {};
let selectedCategoryKey = null;
let importPendingData = null;
let resetClickCount = 0;

async function loadData() {
  S = await getState();
  if (S.notifyHardLock === undefined) S.notifyHardLock = true;
  if (S.notifyPomodoro === undefined) S.notifyPomodoro = true;
}

async function save(obj) {
  const updated = await saveWithProfile(obj);
  S = { ...S, ...updated };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCategoryInfo(key) {
  let label = key;
  let emoji = CATEGORIES_EMOJI_MAP[key] || '📁';
  
  if (key === 'social') label = 'Mạng xã hội';
  else if (key === 'video') label = 'Video';
  else if (key === 'news') label = 'Tin tức';
  else if (key === 'shopping') label = 'Mua sắm';
  else if (key.includes('_')) {
    const parts = key.split('_');
    emoji = parts[0];
    label = parts.slice(1).join('_');
  }
  return { label, emoji };
}

// ── Tab Controller ────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ── Category Manager ──────────────────────────────────────────────────────────

function renderCategories() {
  const cats = S.categories || {};
  const listEl = $('catItemsList');
  listEl.innerHTML = '';

  Object.entries(cats).forEach(([key, sites]) => {
    const isBuiltIn = BUILT_IN_CATEGORIES.includes(key);
    const { label, emoji } = getCategoryInfo(key);

    const item = document.createElement('div');
    item.className = `cat-item ${selectedCategoryKey === key ? 'active' : ''}`;
    item.dataset.key = key;

    const left = document.createElement('div');
    left.className = 'cat-item-left';
    left.innerHTML = `<span class="cat-emoji">${emoji}</span> <span class="cat-name">${label}</span>`;
    item.appendChild(left);

    if (!isBuiltIn) {
      const delBtn = document.createElement('button');
      delBtn.className = 'cat-remove';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Xóa nhóm này';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Bạn có chắc chắn muốn xóa nhóm "${label}"?`)) {
          const updatedCats = { ...S.categories };
          delete updatedCats[key];
          await save({ categories: updatedCats });
          if (selectedCategoryKey === key) selectedCategoryKey = null;
          renderCategories();
        }
      });
      item.appendChild(delBtn);
    }

    item.addEventListener('click', () => {
      selectedCategoryKey = key;
      renderCategories();
    });

    listEl.appendChild(item);
  });

  renderCategorySites();
}

function renderCategorySites() {
  const listEl = $('catSitesList');
  const addRow = $('catAddRow');
  const headerEl = $('selectedCatHeader');

  if (!selectedCategoryKey || !S.categories[selectedCategoryKey]) {
    listEl.innerHTML = '<div class="empty-state">Chọn một nhóm để xem danh sách trang</div>';
    addRow.style.display = 'none';
    headerEl.textContent = 'Chọn một nhóm...';
    return;
  }

  addRow.style.display = 'flex';
  
  const { label, emoji } = getCategoryInfo(selectedCategoryKey);
  headerEl.textContent = `${emoji} Danh sách thuộc nhóm: ${label}`;

  const sites = S.categories[selectedCategoryKey] || [];
  if (sites.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nhóm này chưa có trang nào. Thêm trang bên dưới.</div>';
  } else {
    listEl.innerHTML = sites.map((site, i) => {
      const escSite = escapeHtml(site);
      return `
        <div class="cat-site-item">
          <span class="cat-site-domain">${escSite}</span>
          <button class="cat-remove remove-site-btn" data-i="${i}" title="Xóa trang">✕</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.remove-site-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = parseInt(btn.dataset.i);
        const updatedCats = { ...S.categories };
        updatedCats[selectedCategoryKey].splice(i, 1);
        await save({ categories: updatedCats });
        renderCategorySites();
      });
    });
  }
}

// ── Notification & Appearance Settings ─────────────────────────────────────────

function setupAppearanceAndNotifications() {
  $('notifyHardLock').checked = !!S.notifyHardLock;
  $('notifyPomodoro').checked = !!S.notifyPomodoro;
  $('darkModeToggle').checked = S.theme === 'dark';
  $('breatheModeToggle').checked = !!S.breatheMode;
  $('pomoSoundToggle').checked = !!S.pomoSound;

  $('notifyHardLock').addEventListener('change', e => {
    save({ notifyHardLock: e.target.checked });
  });
  $('notifyPomodoro').addEventListener('change', e => {
    save({ notifyPomodoro: e.target.checked });
  });
  $('darkModeToggle').addEventListener('change', e => {
    const nextTheme = e.target.checked ? 'dark' : 'light';
    save({ theme: nextTheme });
    applyTheme(nextTheme);
  });
  $('breatheModeToggle').addEventListener('change', e => {
    save({ breatheMode: e.target.checked });
  });
  $('pomoSoundToggle').addEventListener('change', e => {
    save({ pomoSound: e.target.checked });
  });
}

// ── Data Management ───────────────────────────────────────────────────────────

function setupDataManagement() {
  // Export backup
  $('exportBackupBtn').addEventListener('click', () => {
    const backupStr = JSON.stringify(S, null, 2);
    const blob = new Blob([backupStr], { type: 'application/json' });
    downloadBlob(blob, `focusguard-full-backup-${new Date().toISOString().split('T')[0]}.json`);
  });

  // Import triggers
  $('importBackupTrigger').addEventListener('click', () => {
    $('importBackupInput').click();
  });

  $('importBackupInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    $('importBackupFileLabel').textContent = file.name;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.blockedSites && typeof parsed.categories === 'object') {
          importPendingData = parsed;
          $('importBackupBtn').disabled = false;
        } else {
          alert('File JSON không đúng cấu trúc backup của FocusGuard.');
          $('importBackupFileLabel').textContent = 'Chưa chọn file';
          importPendingData = null;
          $('importBackupBtn').disabled = true;
        }
      } catch {
        alert('File không hợp lệ hoặc lỗi định dạng JSON.');
        $('importBackupFileLabel').textContent = 'Chưa chọn file';
        importPendingData = null;
        $('importBackupBtn').disabled = true;
      }
    };
    reader.readAsText(file);
  });

  $('importBackupBtn').addEventListener('click', async () => {
    if (!importPendingData) return;
    if (confirm('Cảnh báo: Nhập cấu hình sẽ GHI ĐÈ toàn bộ dữ liệu, danh sách và thống kê hiện tại của bạn. Bạn vẫn muốn tiếp tục?')) {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(importPendingData);
      alert('Nhập cấu hình sao lưu thành công! Trang cài đặt sẽ tự động reload.');
      location.reload();
    }
  });

  // Reset default
  $('resetDefaultBtn').addEventListener('click', async () => {
    resetClickCount++;
    if (resetClickCount === 1) {
      $('resetWarning').style.display = 'block';
      setTimeout(() => {
        resetClickCount = 0;
        $('resetWarning').style.display = 'none';
      }, 5000);
    } else if (resetClickCount === 2) {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(DEFAULT_STATE);
      alert('Đã khôi phục cài đặt gốc thành công!');
      location.reload();
    }
  });
}

// ── Bind Interactive Actions ─────────────────────────────────────────────────

function setupBindings() {
  // Create Category
  $('createCatBtn').addEventListener('click', async () => {
    const name = $('newCatName').value.trim();
    const emoji = $('newCatEmoji').value.trim() || '📁';
    
    if (!name) return;
    
    const key = `${emoji}_${name}`;
    const updatedCats = { ...S.categories };
    
    // Check for normalized category key collision
    const cleanName = name.toLowerCase().replace(/\s+/g, '');
    const exists = Object.keys(updatedCats).some(k => {
      if (k === cleanName) return true;
      if (k.includes('_')) {
        const existingName = k.split('_').slice(1).join('_').toLowerCase().replace(/\s+/g, '');
        if (existingName === cleanName) return true;
      }
      // Built-in checks translated
      if (cleanName === 'mạngxãhội' && k === 'social') return true;
      if (cleanName === 'video' && k === 'video') return true;
      if (cleanName === 'tintức' && k === 'news') return true;
      if (cleanName === 'muasắm' && k === 'shopping') return true;
      return false;
    });
    
    if (exists) {
      alert('Nhóm trang này đã tồn tại!');
      return;
    }
    
    updatedCats[key] = [];
    await save({ categories: updatedCats });
    
    $('newCatName').value = '';
    $('newCatEmoji').value = '';
    renderCategories();
  });

  // Add Site to Category
  $('catAddSiteBtn').addEventListener('click', async () => {
    let domain = $('catSiteInput').value.trim().toLowerCase();
    if (!domain) return;
    
    domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!domain.includes('.')) {
      alert('Vui lòng nhập domain hợp lệ!');
      return;
    }
    
    if (!selectedCategoryKey || !S.categories[selectedCategoryKey]) return;
    
    const updatedCats = { ...S.categories };
    if (!updatedCats[selectedCategoryKey].includes(domain)) {
      updatedCats[selectedCategoryKey].push(domain);
      await save({ categories: updatedCats });
      $('catSiteInput').value = '';
      renderCategorySites();
    } else {
      alert('Domain này đã có trong nhóm!');
    }
  });

  $('catSiteInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('catAddSiteBtn').click();
  });
}

// ── Custom Motivational Quotes ───────────────────────────────────────────────

function setupQuotes() {
  const addBtn = $('addQuoteBtn');
  if (!addBtn) return;

  addBtn.addEventListener('click', async () => {
    const text = $('newQuoteText').value.trim();
    const author = $('newQuoteAuthor').value.trim();
    if (!text) {
      alert('Vui lòng nhập câu nhắc nhở!');
      return;
    }
    const quotes = [...(S.customQuotes || [])];
    quotes.push({ text, author });
    await save({ customQuotes: quotes });
    $('newQuoteText').value = '';
    $('newQuoteAuthor').value = '';
    renderQuotesList();
  });
  renderQuotesList();
}

function renderQuotesList() {
  const list = $('customQuotesList');
  if (!list) return;

  const quotes = S.customQuotes || [];
  if (quotes.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:10px 0; text-align:center;">Chưa có câu nhắc nhở tự tạo nào</div>';
    return;
  }

  list.innerHTML = quotes.map((q, i) => {
    const escText = escapeHtml(q.text);
    const escAuthor = q.author ? escapeHtml(q.author) : '';
    
    return `
      <div class="cat-site-item" style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:8px 12px; background:var(--s1); border:1px solid var(--border); border-radius:var(--r);">
        <div style="flex:1; text-align:left;">
          <span style="font-weight:500; font-size:13px; display:block; line-height:1.4; margin-bottom:2px;">"${escText}"</span>
          ${escAuthor ? `<span style="font-size:10px; color:var(--t3); display:block;">— ${escAuthor}</span>` : ''}
        </div>
        <button class="cat-remove remove-quote-btn" data-i="${i}" title="Xóa lời nhắc" style="margin-top:2px;">✕</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.remove-quote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.i);
      const quotes = [...(S.customQuotes || [])];
      quotes.splice(idx, 1);
      await save({ customQuotes: quotes });
      renderQuotesList();
    });
  });
}

// ── Storage Events ────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Only trigger re-render if options-related variables have actually changed
    const relevantKeys = ['theme', 'customQuotes', 'categories', 'notifyHardLock', 'notifyPomodoro', 'breatheMode', 'pomoSound'];
    const hasChanges = relevantKeys.some(k => changes[k] !== undefined);
    if (hasChanges) {
      loadData().then(() => {
        applyTheme(S.theme);
        renderQuotesList();
        renderCategories();
      });
    }
  }
});

// ── Initialization ────────────────────────────────────────────────────────────

(async () => {
  setupTabs();
  await loadData();
  applyTheme(S.theme);
  renderCategories();
  setupAppearanceAndNotifications();
  setupDataManagement();
  setupBindings();
  setupQuotes();
})();
