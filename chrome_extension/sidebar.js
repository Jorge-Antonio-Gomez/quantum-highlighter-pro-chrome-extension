document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTS ---
    const resizeHandle = document.getElementById('resize-handle');
    const lockButton = document.getElementById('lock-button');
    const configButton = document.getElementById('config-button');
    const closeButton = document.getElementById('close-button');
    const annotationsList = document.getElementById('annotations-list');
    const forceBlackSwitch = document.getElementById('force-black-switch');
    const disablePageSwitch = document.getElementById('disable-page-switch');
    const disableDomainSwitch = document.getElementById('disable-domain-switch');
    const configPopup = document.getElementById('config-popup');
    const languageSelectWrapper = document.getElementById('language-select-wrapper');
    const websiteInfoCard = document.getElementById('website-info-card');
    const websiteFavicon = document.getElementById('website-favicon');
    const websiteTitle = document.getElementById('website-title');
    const websiteDescription = document.getElementById('website-description');
    const websiteDomain = document.getElementById('website-domain');
    const refreshButtons = document.querySelectorAll('.refresh-button');
    const refreshContainer = document.getElementById('refresh-container');
    const refreshToast = document.getElementById('refresh-toast');
    const refreshToastText = document.getElementById('refresh-toast-text');

    // --- STATE ---
    let myTabId = null;
    let isLocked = false;
    let lastStoredWidth = 420;
    let settings = {
        useDarkText: false,
    };

    // --- FLOATING UI ---
    const { computePosition, offset, flip, shift } = FloatingUIDOM;

    // --- CORE FUNCTIONS ---

    function saveSettings() {
        chrome.storage.sync.set({ 'highlighter-settings': settings });
        if (myTabId) {
            chrome.tabs.sendMessage(myTabId, {
                action: 'settingChanged',
                settings: settings
            });
        }
    }

    function localizeUI() {
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            const message = chrome.i18n.getMessage(key);
            if (message) {
                if (el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'LABEL' || el.tagName === 'SPAN' || el.tagName === 'P') {
                    el.textContent = message;
                } else {
                    el.setAttribute('aria-label', message);
                }
            }
        });
        const lockLabelKey = isLocked ? 'unlockSidebarWidth' : 'lockSidebarWidth';
        const lockLabel = chrome.i18n.getMessage(lockLabelKey);
        lockButton.setAttribute('aria-label', lockLabel);
    }

    function updateAnnotationTextStyles() {
        annotationsList.classList.toggle('dark-text', settings.useDarkText);
    }

    // --- RESIZE AND LOCK LOGIC ---

    const setLockedState = (locked) => {
        isLocked = locked;
        document.body.classList.toggle('locked', locked);
        const lockLabelKey = isLocked ? 'unlockSidebarWidth' : 'lockSidebarWidth';
        lockButton.setAttribute('aria-label', chrome.i18n.getMessage(lockLabelKey));
        chrome.storage.sync.set({ sidebarLocked: locked });

        if (!myTabId) return;

        if (locked) {
            chrome.tabs.sendMessage(myTabId, { action: 'getSidebarWidth' }, (response) => {
                if (chrome.runtime.lastError) { console.warn(chrome.runtime.lastError.message); return; }
                if (response && response.width) {
                    lastStoredWidth = response.width;
                    chrome.storage.sync.set({ sidebarWidth: response.width });
                }
            });
        } else {
            chrome.tabs.sendMessage(myTabId, { action: 'setSidebarWidth', width: lastStoredWidth });
        }
    };

    // --- POPUP AND UI LOGIC ---

    const showPopup = () => {
        configPopup.style.display = 'block';
        computePosition(configButton, configPopup, {
            placement: 'bottom-end',
            middleware: [offset(5), flip(), shift({ padding: 5 })],
        }).then(({ x, y }) => {
            configPopup.style.left = `${x}px`;
            configPopup.style.top = `${y}px`;
        });
    };

    const hidePopup = () => {
        configPopup.style.display = 'none';
    };

    // --- ANNOTATION RENDERING ---

    function renderAnnotations(annotations) {
        const emptyStateContent = document.getElementById('empty-state-content');
        const hasAnnotations = annotations && annotations.length > 0;

        annotationsList.classList.toggle('is-hidden', !hasAnnotations);
        emptyStateContent.classList.toggle('is-hidden', hasAnnotations);
        refreshContainer.classList.toggle('visible', hasAnnotations);

        if (!hasAnnotations) {
            annotationsList.innerHTML = '';
            return;
        }

        const annotationsContainer = annotationsList;
        const existingIds = new Set(Array.from(annotationsContainer.querySelectorAll('.annotation-card')).map(el => el.dataset.annotationId));
        const receivedAnnotationsMap = new Map(annotations);

        for (const id of existingIds) {
            if (!receivedAnnotationsMap.has(id)) {
                const cardToRemove = annotationsContainer.querySelector(`[data-annotation-id="${id}"]`);
                if (cardToRemove && !cardToRemove.classList.contains('deleting')) {
                    cardToRemove.classList.add('deleting');
                    cardToRemove.addEventListener('animationend', () => cardToRemove.remove(), { once: true });
                }
            }
        }

        let lastElement = null;
        annotations.forEach(([id, annotation]) => {
            let card = annotationsContainer.querySelector(`[data-annotation-id="${id}"]`);

            if (card) {
                const textEl = card.querySelector('.text');
                const commentEl = card.querySelector('.comment');
                const colorBar = card.querySelector('.annotation-color-bar');

                if (textEl.innerHTML !== annotation.text) textEl.innerHTML = annotation.text;
                const newCommentHtml = annotation.comment || `<span class="no-comment-placeholder">${chrome.i18n.getMessage('noComment')}</span>`;
                if (commentEl.innerHTML !== newCommentHtml) commentEl.innerHTML = newCommentHtml;
                if (colorBar.style.backgroundColor !== annotation.color) colorBar.style.backgroundColor = annotation.color;
                card.dataset.comment = annotation.comment || '';
            } else {
                card = createAnnotationCard(id, annotation);
                card.classList.add('newly-added');

                if (lastElement) {
                    lastElement.after(card);
                } else {
                    annotationsContainer.prepend(card);
                }
                card.addEventListener('animationend', () => card.classList.remove('newly-added'), { once: true });
            }
            lastElement = card;
        });
    }

    function createAnnotationCard(id, annotation) {
        const card = document.createElement('div');
        card.className = 'annotation-card';
        card.dataset.annotationId = id;
        card.dataset.comment = annotation.comment || '';

        const colorBar = document.createElement('div');
        colorBar.className = 'annotation-color-bar';
        colorBar.style.backgroundColor = annotation.color;
        card.appendChild(colorBar);

        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        
        const text = document.createElement('div');
        text.className = 'text';
        text.innerHTML = annotation.text;
        
        const commentDisplay = document.createElement('div');
        commentDisplay.className = 'comment';
        commentDisplay.innerHTML = annotation.comment ? annotation.comment : `<span class="no-comment-placeholder">${chrome.i18n.getMessage('noComment')}</span>`;
        
        mainContent.appendChild(text);
        mainContent.appendChild(commentDisplay);

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'actions-container';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', chrome.i18n.getMessage('deleteAnnotation'));
        deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V6H17H19C19.5523 6 20 6.44772 20 7C20 7.55228 19.5523 8 19 8H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V8H5C4.44772 8 4 7.55228 4 7C4 6.44772 4.44772 6 5 6H7H9V5ZM10 8H8V18C8 18.5523 8.44772 19 9 19H15C15.5523 19 16 18.5523 16 18V8H14H10ZM13 6H11V5H13V6ZM10 9C10.5523 9 11 9.44772 11 10V17C11 17.5523 10.5523 18 10 18C9.44772 18 9 17.5523 9 17V10C9 9.44772 9.44772 9 10 9ZM14 9C14.5523 9 15 9.44772 15 10V17C15 17.5523 14.5523 18 14 18C13.4477 18 13 17.5523 13 17V10C13 9.44772 13.4477 9 14 9Z" fill="currentColor"/></svg>`;
        actionsContainer.appendChild(deleteBtn);

        card.appendChild(mainContent);
        card.appendChild(actionsContainer);

        mainContent.addEventListener('click', () => {
            if (myTabId) {
                chrome.tabs.sendMessage(myTabId, { action: 'scrollToAnnotation', annotationId: id });
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (myTabId) {
                chrome.tabs.sendMessage(myTabId, { action: 'deleteAnnotation', annotationId: id });
            }
        });

        return card;
    }

    function showToast(messageKey) {
        const message = chrome.i18n.getMessage(messageKey);
        refreshToastText.textContent = message;
        if (refreshContainer.classList.contains('visible')) {
            const containerHeight = refreshContainer.offsetHeight;
            refreshToast.style.bottom = `${containerHeight + 10}px`;
        } else {
            refreshToast.style.bottom = '20px';
        }
        refreshToast.classList.add('show');
        setTimeout(() => {
            refreshToast.classList.remove('show');
        }, 2200);
    }

    function loadAnnotations(showToastOnComplete = false) {
        if (!myTabId) {
            renderAnnotations([]);
            return;
        }
        chrome.tabs.get(myTabId, (currentTab) => {
            if (chrome.runtime.lastError) {
                console.warn(`Highlighter: Could not get tab info. ${chrome.runtime.lastError.message}`);
                renderAnnotations([]);
                return;
            }
            if (currentTab.url && currentTab.url.startsWith('chrome-extension://')) {
                annotationsList.innerHTML = `<p>${chrome.i18n.getMessage('noAnnotations')}</p>`;
                return;
            }
            refreshButtons.forEach(button => {
                button.classList.add('refreshing');
                button.disabled = true;
            });
            chrome.tabs.sendMessage(myTabId, { action: 'getAnnotations' }, (response) => {
                setTimeout(() => {
                    refreshButtons.forEach(button => {
                        button.classList.remove('refreshing');
                        button.disabled = false;
                    });
                }, 600);
                if (chrome.runtime.lastError) {
                    console.warn(`Highlighter: Could not connect. ${chrome.runtime.lastError.message}`);
                    annotationsList.innerHTML = `<p>${chrome.i18n.getMessage('errorLoading')}</p>`;
                    return;
                }
                renderAnnotations(response?.data || []);
                if (showToastOnComplete) {
                    showToast('annotationsRefreshed');
                }
            });
        });
    }

    function loadPageInfo() {
        if (!myTabId) return;
        chrome.tabs.sendMessage(myTabId, { action: 'getPageInfo' }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn(`Highlighter: Could not get page info. ${chrome.runtime.lastError.message}`);
                websiteInfoCard.style.display = 'none';
                return;
            }
            if (response) {
                websiteTitle.textContent = response.title || 'No Title';
                websiteDescription.textContent = response.description || 'No description available.';
                websiteDomain.textContent = response.domain || '';
                if (response.favicon) {
                    websiteFavicon.src = response.favicon;
                    websiteFavicon.style.display = 'block';
                } else {
                    websiteFavicon.style.display = 'none';
                }
                if (response.image) {
                    websiteInfoCard.style.backgroundImage = `url('${response.image}')`;
                    websiteInfoCard.classList.add('has-image');
                } else {
                    websiteInfoCard.style.backgroundImage = '';
                    websiteInfoCard.classList.remove('has-image');
                }
                websiteInfoCard.style.display = 'flex';
            } else {
                websiteInfoCard.style.display = 'none';
            }
        });
    }

    // --- EVENT LISTENERS ---
    refreshButtons.forEach(button => {
        button.addEventListener('click', () => loadAnnotations(true));
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (sender.tab && sender.tab.id !== myTabId) {
            return;
        }
        if (request.action === 'annotationsUpdated') {
            renderAnnotations(request.data);
        }
    });

    lockButton.addEventListener('mousedown', (e) => e.stopPropagation());
    lockButton.addEventListener('click', () => setLockedState(!isLocked));
    resizeHandle.addEventListener('mousedown', (e) => {
        if (isLocked || !myTabId) return;
        e.preventDefault();
        chrome.tabs.sendMessage(myTabId, { action: 'startSidebarResize' });
    });

    configButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = configPopup.style.display === 'none' || !configPopup.style.display;
        isHidden ? showPopup() : hidePopup();
    });

    closeButton.addEventListener('click', () => {
        if (myTabId) {
            chrome.tabs.sendMessage(myTabId, { action: 'toggleSidebar' });
        }
    });

    // The language selector is now managed by browser settings, this can be removed.
    if (languageSelectWrapper) {
        languageSelectWrapper.style.display = 'none';
    }

    forceBlackSwitch.addEventListener('change', () => {
        settings.useDarkText = forceBlackSwitch.checked;
        updateAnnotationTextStyles();
        saveSettings();
    });

    disablePageSwitch.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (!myTabId) return;
        chrome.tabs.get(myTabId, (tab) => {
            if (!tab || !tab.url) return;
            const href = tab.url;
            chrome.storage.sync.get({ disabledPages: [] }, (data) => {
                let disabledPages = data.disabledPages;
                if (checked) {
                    if (!disabledPages.includes(href)) disabledPages.push(href);
                } else {
                    disabledPages = disabledPages.filter(page => page !== href);
                }
                chrome.storage.sync.set({ disabledPages }, () => {
                    chrome.tabs.sendMessage(myTabId, { action: 'toggleActivation', disabled: checked });
                });
            });
        });
    });

    disableDomainSwitch.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (!myTabId) return;
        chrome.tabs.get(myTabId, (tab) => {
            if (!tab || !tab.url) return;
            const hostname = new URL(tab.url).hostname;
            chrome.storage.sync.get({ disabledSites: [] }, (data) => {
                let disabledSites = data.disabledSites;
                if (checked) {
                    if (!disabledSites.includes(hostname)) disabledSites.push(hostname);
                } else {
                    disabledSites = disabledSites.filter(site => site !== hostname);
                }
                chrome.storage.sync.set({ disabledSites }, () => {
                    chrome.tabs.sendMessage(myTabId, { action: 'toggleActivation', disabled: checked });
                });
            });
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (configPopup.style.display === 'block') hidePopup();
        }
    });

    document.addEventListener('click', (e) => {
        if (configPopup.style.display === 'block' && !configPopup.contains(e.target) && !configButton.contains(e.target)) {
            hidePopup();
        }
    });

    // --- INITIALIZATION ---
    const initialize = () => {
        localizeUI();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                console.error("Highlighter sidebar: Could not identify the host tab.");
                return;
            }
            const currentTab = tabs[0];
            myTabId = currentTab.id;

            loadPageInfo();
            loadAnnotations();

            chrome.storage.sync.get(['sidebarLocked', 'sidebarWidth', 'highlighter-settings', 'disabledPages', 'disabledSites'], (data) => {
                const isLocked = data.sidebarLocked === undefined ? true : data.sidebarLocked;
                setLockedState(isLocked);
                lastStoredWidth = Math.max(data.sidebarWidth || 420, 380);

                const defaultSettings = {
                    useDarkText: false
                };
                settings = { ...defaultSettings, ...data['highlighter-settings'] };
                
                forceBlackSwitch.checked = settings.useDarkText;
                updateAnnotationTextStyles();
                saveSettings();

                if (currentTab.url) {
                    const url = new URL(currentTab.url);
                    const disabledSites = data.disabledSites || [];
                    const disabledPages = data.disabledPages || [];
                    disableDomainSwitch.checked = disabledSites.includes(url.hostname);
                    disablePageSwitch.checked = disabledPages.includes(url.href);
                }
            });
        });
    };

    initialize();
});
