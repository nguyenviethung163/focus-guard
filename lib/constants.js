// FocusGuard v2 — Shared Constants

export const DEFAULT_BLOCKED = [
  "facebook.com", "twitter.com", "x.com", "instagram.com", "tiktok.com",
  "youtube.com", "reddit.com", "9gag.com", "threads.net", "snapchat.com",
  "twitch.tv", "pinterest.com", "tumblr.com"
];

export const DEFAULT_STATE = {
  blockedSites: DEFAULT_BLOCKED,
  isEnabled: true,
  hardLock: false,
  hardLockUntil: null,
  scheduleEnabled: false,
  scheduleSlots: [],
  pomodoroActive: false,
  pomodoroEnd: null,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  pomodoroCount: 0,
  pomodoroInBreak: false,
  stats: {},
  tempAllowList: [],
  tempAllowExpiry: {},
  snoozedSites: {},      // { domain: expiryTs | -1 }
  categories: {
    social: ["facebook.com", "instagram.com", "twitter.com", "x.com", "threads.net", "snapchat.com"],
    video: ["youtube.com", "tiktok.com", "twitch.tv", "vimeo.com"],
    news: ["reddit.com", "9gag.com", "buzzfeed.com", "dailymail.co.uk"],
    shopping: ["shopee.vn", "lazada.vn", "tiki.vn", "amazon.com"]
  },
  notifyHardLock: true,
  notifyPomodoro: true,
  theme: "light",
  customQuotes: [],
  allowlistMode: false,
  breatheMode: false,
  pomoSound: true,
  timeLimits: {},
  timeSpent: {},
  activeProfile: "Mặc định",
  profiles: {
    "Mặc định": {
      blockedSites: DEFAULT_BLOCKED,
      scheduleSlots: []
    },
    "💼 Làm việc": {
      blockedSites: ["facebook.com", "instagram.com", "tiktok.com", "youtube.com", "twitch.tv", "reddit.com", "9gag.com"],
      scheduleSlots: []
    },
    "🎓 Học tập": {
      blockedSites: ["facebook.com", "instagram.com", "tiktok.com", "shopee.vn", "lazada.vn", "tiki.vn"],
      scheduleSlots: []
    }
  }
};

export const SYNCED_KEYS = [
  'blockedSites', 'categories', 'scheduleSlots', 'isEnabled',
  'notifyHardLock', 'notifyPomodoro', 'profiles', 'activeProfile',
  'timeLimits', 'theme', 'customQuotes', 'allowlistMode', 'breatheMode',
  'pomoSound'
];

export const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const BUILT_IN_CATEGORIES = ['social', 'video', 'news', 'shopping'];

export const CATEGORIES_EMOJI_MAP = {
  social: '📱',
  video: '🎬',
  news: '📰',
  shopping: '🛒'
};

export const ALIAS_MAP = {
  "fb.com": "facebook.com",
  "fb.me": "facebook.com",
  "m.facebook.com": "facebook.com",
  "l.facebook.com": "facebook.com",
  "lm.facebook.com": "facebook.com",
  "t.co": "twitter.com",
  "youtu.be": "youtube.com",
  "m.youtube.com": "youtube.com",
  "vm.tiktok.com": "tiktok.com",
  "m.instagram.com": "instagram.com",
  "instagr.am": "instagram.com",
  "redd.it": "reddit.com",
  "old.reddit.com": "reddit.com",
  "np.reddit.com": "reddit.com"
};

export const MS_PER_MIN = 60 * 1000;
export const POMO_CIRCUMFERENCE = 276.46;
export const POMO_WORK_DEFAULT = 25;
export const POMO_BREAK_DEFAULT = 5;
export const TIME_SAVED_PER_BLOCK_MIN = 5;
export const LOCK_DEFAULT_MIN = 15;
export const SNOOZE_OPTIONS = [15, 30, 60, 120, 480, -1];
export const TICK_ALARM_NAME = 'tick';
export const FLUSH_ALARM_NAME = 'timeFlush';
export const CONTEXT_MENU_ID = 'blockSite';

export const QUOTES = [
  "Người chiến thắng không bao giờ bỏ cuộc, người bỏ cuộc không bao giờ chiến thắng.",
  "Tập trung là chìa khóa của mọi thành công.",
  "Đừng để sự xao nhãng đánh cắp tương lai của bạn.",
  "Bắt đầu từ nơi bạn đứng. Sử dụng những gì bạn có. Làm những gì bạn có thể.",
  "Chỉ một giờ tập trung cao độ có giá trị hơn cả ngày bận rộn vô nghĩa.",
  "Tương lai được mua bằng hiện tại.",
  "Hãy kỷ luật bản thân nếu không muốn người khác kỷ luật bạn.",
  "Thành công là tổng của những nỗ lực nhỏ, lặp đi lặp lại ngày này qua ngày khác."
];

export const WEEKLY_QUOTES = [
  "Sự tập trung là chiếc chìa khóa mở cánh cửa dẫn tới mọi thành công.",
  "Người chiến thắng không làm nhiều hơn, họ tập trung hơn.",
  "Mỗi lần bạn cưỡng lại sự phân tâm, bạn đang luyện tập ý chí của mình.",
  "Làm sâu hơn, không phải bận rộn hơn.",
  "Những gì bạn chú ý đến sẽ trở thành cuộc sống của bạn."
];
