// FocusGuard v2 — Popup Profiles Module
'use strict';

import { $ } from '../../lib/utils.js';
import { state, save, renderHeader } from '../popup.js';
import { renderSiteList, renderCategories } from './block-tab.js';
import { renderSchedule } from './schedule.js';
import { renderLimitsList } from './limits.js';

export function setupProfiles() {
  const select = $('profileSelect');
  if (!select) return;

  const renderProfileOptions = () => {
    select.innerHTML = '';
    const profiles = state.S.profiles || {};
    const active = state.S.activeProfile || 'Mặc định';
    
    Object.keys(profiles).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === active) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  };

  renderProfileOptions();

  select.addEventListener('change', async (e) => {
    const active = e.target.value;
    const profiles = state.S.profiles || {};
    const target = profiles[active] || { blockedSites: [], scheduleSlots: [] };
    
    await save({
      activeProfile: active,
      blockedSites: target.blockedSites || [],
      scheduleSlots: target.scheduleSlots || []
    });
    
    renderSiteList();
    renderHeader();
    renderCategories();
    renderSchedule();
    renderLimitsList();
  });
}
