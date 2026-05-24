// FocusGuard v2 — Popup Snooze Module
'use strict';

import { state, save, renderSiteList } from '../popup.js';

export function isSnoozed(site) {
  const snooze = state.S.snoozedSites || {};
  if (!snooze[site]) return false;
  if (snooze[site] === -1) return true; // indefinite
  return Date.now() < snooze[site];
}

export function snoozeLabel(site) {
  const snooze = state.S.snoozedSites || {};
  if (!snooze[site]) return null;
  if (snooze[site] === -1) return 'Tạm dừng ∞';
  const rem = snooze[site] - Date.now();
  if (rem <= 0) return null;
  const m = Math.floor(rem / 60000);
  if (m < 60) return `Tạm dừng ${m}ph`;
  return `Tạm dừng ${Math.round(m / 60)}h`;
}

export async function snoozeSite(site, minutes) {
  const snooze = { ...(state.S.snoozedSites || {}) };
  snooze[site] = minutes === -1 ? -1 : Date.now() + minutes * 60 * 1000;
  await save({ snoozedSites: snooze });
  renderSiteList();
}

export async function unsnoozeSite(site) {
  const snooze = { ...(state.S.snoozedSites || {}) };
  delete snooze[site];
  await save({ snoozedSites: snooze });
  renderSiteList();
}
