// FocusGuard v2 — Shared Utilities

export const $ = id => document.getElementById(id);

export const escapeHtml = str => {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
};

export const fmt2 = n => String(n).padStart(2, '0');

export const fmtMs = ms => {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  return fmt2(Math.floor(s / 60)) + ':' + fmt2(s % 60);
};

export const todayKey = () => new Date().toISOString().split('T')[0];

export const dayKey = offset => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
};

export const calcStreak = (stats = {}) => {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const k = dayKey(i);
    if (stats[k] && stats[k].blocked > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
};

export const applyTheme = theme => {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
};

export const isHardLocked = S => {
  return !!(S.hardLock && S.hardLockUntil && Date.now() < S.hardLockUntil);
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
