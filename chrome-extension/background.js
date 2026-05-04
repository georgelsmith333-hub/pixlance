// Pixlance Extension Background Service Worker

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "openTab" && message.url) {
    chrome.tabs.create({ url: message.url, active: true });
    sendResponse({ ok: true });
  }
  return true;
});
