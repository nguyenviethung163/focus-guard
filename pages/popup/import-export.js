// FocusGuard v2 — Popup Import/Export Module
'use strict';

import { $, downloadBlob } from '../../lib/utils.js';
import { state, save, renderHeader } from '../popup.js';
import { renderSiteList } from './block-tab.js';

export function setupImport() {
  $('importBtn').addEventListener('click', () => {
    $('importModal').classList.add('open');
    $('importText').value = '';
    $('importResult').className = 'import-result';
    $('importResult').textContent = '';
  });
  $('importCancelBtn').addEventListener('click', closeModal);
  $('importModal').addEventListener('click', e => {
    if (e.target === $('importModal')) closeModal();
  });
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
  $('dropZone').addEventListener('dragover', e => {
    e.preventDefault();
    $('dropZone').classList.add('drag-over');
  });
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
        if (Array.isArray(data)) {
          parsed = data.join('\n');
        } else if (data.blockedSites) {
          parsed = data.blockedSites.join('\n');
        } else {
          parsed = Object.values(data).flat().join('\n');
        }
      } catch {
        parsed = text;
      }
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
    .map(line => {
      let s = line.trim().toLowerCase();
      if (!s || s.startsWith('!') || s.startsWith('#')) return null;
      
      if (s.startsWith('||')) {
        s = s.substring(2);
      }
      if (s.endsWith('^')) {
        s = s.substring(0, s.length - 1);
      }
      
      s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
      s = s.split('?')[0].split('#')[0];
      if (s.endsWith('/')) {
        s = s.substring(0, s.length - 1);
      }
      
      return s;
    })
    .filter(s => s && s.includes('.') && s.length > 3);
}

async function doImport() {
  const raw = $('importText').value;
  if (!raw.trim()) return;

  const incoming = parseDomains(raw);
  if (incoming.length === 0) {
    showImportResult('err', 'Không tìm thấy domain hợp lệ nào.');
    return;
  }

  const existing = state.S.blockedSites || [];
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
  const sites = state.S.blockedSites || [];
  if (sites.length === 0) return;
  const blob = new Blob([sites.join('\n')], { type: 'text/plain' });
  downloadBlob(blob, 'focusguard-blocklist.txt');
}
