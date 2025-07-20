chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleSidebar") {
        chrome.tabs.sendMessage(sender.tab.id, { action: "toggleSidebar" });
    }
});