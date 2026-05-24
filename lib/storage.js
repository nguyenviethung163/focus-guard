// FocusGuard v2 — Storage Utilities

export const getState = () => {
  return new Promise(resolve => {
    chrome.storage.local.get(null, data => {
      resolve(data || {});
    });
  });
};

export const saveState = async (obj) => {
  await chrome.storage.local.set(obj);
  return obj;
};

export const saveWithProfile = async (obj) => {
  if (obj.blockedSites !== undefined || obj.scheduleSlots !== undefined) {
    const data = await chrome.storage.local.get(['profiles', 'activeProfile']);
    const profiles = data.profiles || {};
    const active = data.activeProfile || 'Mặc định';
    if (!profiles[active]) profiles[active] = {};
    if (obj.blockedSites !== undefined) {
      profiles[active].blockedSites = obj.blockedSites;
    }
    if (obj.scheduleSlots !== undefined) {
      profiles[active].scheduleSlots = obj.scheduleSlots;
    }
    obj.profiles = profiles;
  }
  await chrome.storage.local.set(obj);
  return obj;
};
