// FocusGuard v2 — Popup Pomodoro Module
'use strict';

import { $, fmt2, fmtMs } from '../../lib/utils.js';
import { POMO_CIRCUMFERENCE } from '../../lib/constants.js';
import { state } from '../popup.js';

let pomoInterval = null;

export function setupPomodoro() {
  $('pomoStartBtn').addEventListener('click', startPomodoro);
  $('pomoStopBtn').addEventListener('click', stopPomodoro);
}

async function startPomodoro() {
  const workMin = parseInt($('pomoWork').value) || 25;
  const breakMin = parseInt($('pomoBreak').value) || 5;
  await chrome.runtime.sendMessage({ type: 'START_POMODORO', workMin, breakMin });
  // S state is updated via storage onChanged listener, which will re-render
}

async function stopPomodoro() {
  await chrome.runtime.sendMessage({ type: 'STOP_POMODORO' });
  if (pomoInterval) {
    clearInterval(pomoInterval);
    pomoInterval = null;
  }
}

export function renderPomodoro() {
  const active = state.S.pomodoroActive;
  const inBreak = state.S.pomodoroInBreak;
  const workMin = state.S.pomodoroWork || 25;
  const breakMin = state.S.pomodoroBreak || 5;
  const count = state.S.pomodoroCount || 0;
  const totalMs = (inBreak ? breakMin : workMin) * 60 * 1000;
  const circum = POMO_CIRCUMFERENCE;

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
    if (pomoInterval) {
      clearInterval(pomoInterval);
      pomoInterval = null;
    }
    return;
  }

  function tick() {
    if (!state.S.pomodoroActive || !state.S.pomodoroEnd) return;
    const rem = Math.max(0, state.S.pomodoroEnd - Date.now());
    $('pomoTime').textContent = fmtMs(rem);
    $('pomoPhase').textContent = state.S.pomodoroInBreak ? 'Nghỉ ngơi' : 'Tập trung';
    $('pomoStartBtn').textContent = state.S.pomodoroInBreak ? '☕ Đang nghỉ' : '⏳ Đang làm';
    const elapsed = totalMs - rem;
    $('pomoRingFill').style.strokeDashoffset = String(circum * (1 - Math.min(1, elapsed / totalMs)));
    $('pomoBadge').innerHTML = inBreak
      ? '<span class="badge badge-green">☕ Giờ nghỉ</span>'
      : '<span class="badge badge-red">🔥 Đang tập trung</span>';
  }

  tick();
  if (pomoInterval) clearInterval(pomoInterval);
  pomoInterval = setInterval(tick, 1000);
}
