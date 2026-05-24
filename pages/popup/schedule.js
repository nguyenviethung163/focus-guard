// FocusGuard v2 — Popup Schedule Module
'use strict';

import { $ } from '../../lib/utils.js';
import { DAY_NAMES } from '../../lib/constants.js';
import { state, save } from '../popup.js';

let selectedDays = new Set([1, 2, 3, 4, 5]);

export function setupSchedule() {
  document.querySelectorAll('.day-btn').forEach(btn => {
    const d = parseInt(btn.dataset.day);
    if (selectedDays.has(d)) btn.classList.add('on');
    btn.addEventListener('click', () => {
      if (selectedDays.has(d)) {
        selectedDays.delete(d);
      } else {
        selectedDays.add(d);
      }
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

  if (from >= to) {
    alert("Giờ bắt đầu phải trước giờ kết thúc!");
    return;
  }

  const slots = [...(state.S.scheduleSlots || [])];

  // Overlap verification
  const overlap = slots.some(slot => {
    const commonDay = slot.days.some(d => selectedDays.has(d));
    if (!commonDay) return false;
    return from < slot.to && to > slot.from;
  });

  if (overlap) {
    alert("Khung giờ này trùng lặp với lịch đã có!");
    return;
  }

  slots.push({ days: [...selectedDays], from, to });
  await save({ scheduleSlots: slots });
  renderSchedule();
}

export function renderSchedule() {
  $('scheduleEnabled').checked = !!state.S.scheduleEnabled;
  const slots = state.S.scheduleSlots || [];
  const list = $('scheduleList');
  if (slots.length === 0) {
    list.innerHTML = '<div class="empty">Chưa có lịch nào</div>';
    return;
  }
  list.innerHTML = slots.map((slot, i) => `
    <div class="schedule-item">
      <span class="schedule-days">${slot.days.sort().map(d => DAY_NAMES[d]).join(', ')}</span>
      <span class="schedule-time">${slot.from} → ${slot.to}</span>
      <button class="site-remove" data-si="${i}" title="Xóa">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-si]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slots2 = [...(state.S.scheduleSlots || [])];
      slots2.splice(parseInt(btn.dataset.si), 1);
      await save({ scheduleSlots: slots2 });
      renderSchedule();
    });
  });
}
