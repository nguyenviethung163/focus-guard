'use strict';

const params = new URLSearchParams(location.search);
const site = params.get('site') || 'unknown';
const original = params.get('original') || '';

document.getElementById('siteName').textContent = site;
document.getElementById('favicon').src =
  'https://www.google.com/s2/favicons?domain=' + site + '&sz=16';
document.title = 'Bị chặn: ' + site;

// Buttons
document.getElementById('backBtn').addEventListener('click', () => history.back());
document.getElementById('newtabBtn').addEventListener('click', () => {
  chrome.tabs.update({ url: 'chrome://newtab' });
});

// Quotes
const quotes = [
  { text: 'Sự tập trung không phải là từ chối điều xấu — mà là nói có với điều quan trọng nhất.', author: 'Steve Jobs' },
  { text: 'Người chiến thắng không làm nhiều hơn, họ tập trung hơn.', author: 'Gary Keller' },
  { text: 'Mỗi lần bạn cưỡng lại sự phân tâm, bạn đang luyện tập ý chí.', author: 'Khuyết danh' },
  { text: 'Những gì bạn chú ý đến sẽ trở thành cuộc sống của bạn.', author: 'Winifred Gallagher' },
  { text: 'Làm sâu hơn, không phải bận rộn hơn.', author: 'Cal Newport' },
  { text: 'Internet không phải kẻ thù. Sự mất tập trung mới là.', author: 'Khuyết danh' },
];
const q = quotes[Math.floor(Math.random() * quotes.length)];
document.getElementById('quoteText').textContent = '"' + q.text + '"';
document.getElementById('quoteAuthor').textContent = '— ' + q.author;

// Allow dropdown
const allowBtn = document.getElementById('allowBtn');
const allowMenu = document.getElementById('allowMenu');

allowBtn.addEventListener('click', e => {
  e.stopPropagation();
  allowMenu.classList.toggle('open');
});
document.addEventListener('click', () => allowMenu.classList.remove('open'));

allowMenu.querySelectorAll('.allow-item').forEach(item => {
  item.addEventListener('click', async () => {
    const min = parseInt(item.dataset.min);
    await chrome.runtime.sendMessage({ type: 'TEMP_ALLOW', site, minutes: min });
    if (original) {
      location.href = original;
    } else {
      history.back();
    }
  });
});
