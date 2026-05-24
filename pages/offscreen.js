'use strict';

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'PLAY_SOUND' && msg.target === 'offscreen') {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      
      // Gentle dual-tone beep chime
      osc.frequency.setValueAtTime(660, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.18);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.22);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      console.error('Audio Context Error:', e);
    }
  }
});
