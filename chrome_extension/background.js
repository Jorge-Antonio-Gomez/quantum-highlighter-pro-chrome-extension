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
