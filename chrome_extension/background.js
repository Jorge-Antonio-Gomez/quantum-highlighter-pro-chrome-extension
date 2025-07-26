chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "welcome.html"
    });
  }
  if (details.reason === "install" || details.reason === "update") {
    const url = chrome.runtime.getURL("excluded-websites.json");
    try {
      const response = await fetch(url);
      const { version, sites } = await response.json();

      const { excluded_websites_version, disabledSites = [] } = await chrome.storage.sync.get([
          "excluded_websites_version",
          "disabledSites",
        ]);

      if (version !== excluded_websites_version) {
        const newDisabledSites = [...new Set([...disabledSites, ...sites])];
        await chrome.storage.sync.set({
          disabledSites: newDisabledSites,
          excluded_websites_version: version,
        });
      }
    } catch (error) {
      console.error("Error loading excluded sites:", error);
    }
  }
});

chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }).catch(err => {
            // This error is expected on pages where the content script can't run,
            // so we can safely ignore it.
            console.log("Quantum Highlighter: Could not connect to content script. This is expected on some pages (e.g., chrome://newtab).");
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openTab') {
        chrome.tabs.create({ url: request.url, active: true });
    }
});

