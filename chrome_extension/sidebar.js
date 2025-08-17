document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTS ---
    const resizeHandle = document.getElementById('resize-handle');
    const lockButton = document.getElementById('lock-button');
    const configButton = document.getElementById('config-button');
    const closeButton = document.getElementById('close-button');
    const annotationsList = document.getElementById('annotations-list');
    const forceBlackSwitch = document.getElementById('force-black-switch');
    const forceSolidSwitch = document.getElementById('force-solid-switch');
    const disablePageSwitch = document.getElementById('disable-page-switch');
    const disableDomainSwitch = document.getElementById('disable-domain-switch');
    const sidebarDarkModeSwitch = document.getElementById('sidebar-dark-mode-switch');
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
    const tooltip = document.getElementById('tooltip');

    // --- STATE ---
    let myTabId = null;
    let isLocked = false;
    let lastStoredWidth = 420;
    let settings = {
        useDarkText: false,
        sidebarDarkMode: false,
        forceSolidHighlights: false,
    };

    // --- FLOATING UI ---
    const { computePosition, offset, flip, shift } = FloatingUIDOM;

    // --- TOOLTIP ---
    const setupTooltip = (trigger, key) => {
        const showTooltip = (e) => {
            const message = chrome.i18n.getMessage(key);
            if (!message) return;

            tooltip.textContent = message;
            tooltip.style.display = 'block';
            
            computePosition(e.target, tooltip, {
                placement: 'top',
                middleware: [offset(5), flip(), shift({ padding: 5 })]
            }).then(({ x, y }) => {
                Object.assign(tooltip.style, {
                    left: `${x}px`,
                    top: `${y}px`,
                });
            });
        };

        const hideTooltip = () => {
            tooltip.style.display = 'none';
        };

        const updatePosition = (e) => {
            if (tooltip.style.display === 'block') {
                computePosition(e.target, tooltip, {
                    placement: 'top',
                    middleware: [offset(5), flip(), shift({ padding: 5 })]
                }).then(({ x, y }) => {
                    Object.assign(tooltip.style, {
                        left: `${x}px`,
                        top: `${y}px`,
                    });
                });
            }
        };

        trigger.addEventListener('mouseover', showTooltip);
        trigger.addEventListener('mouseout', hideTooltip);
        trigger.addEventListener('mousemove', updatePosition);
    };

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

    function applyDarkMode() {
        document.body.classList.toggle('dark-mode', settings.sidebarDarkMode);
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

    function updateSwitchStates() {
        if (!myTabId) {
            disablePageSwitch.disabled = true;
            disableDomainSwitch.disabled = true;
            return;
        }
    
        chrome.tabs.sendMessage(myTabId, { action: 'getPageInfo' }, (response) => {
            if (chrome.runtime.lastError || !response || !response.url) {
                console.warn("Highlighter: Could not get page info for switch states.", chrome.runtime.lastError?.message);
                disablePageSwitch.disabled = true;
                disableDomainSwitch.disabled = true;
                return;
            }
    
            const { url, domain } = response;
    
            chrome.storage.sync.get(['disabledPages', 'disabledSites'], (data) => {
                if (chrome.runtime.lastError) {
                    console.warn("Highlighter: Error getting disabled sites/pages.", chrome.runtime.lastError);
                    return;
                }
                const disabledPages = data.disabledPages || [];
                const disabledSites = data.disabledSites || [];
    
                disablePageSwitch.checked = disabledPages.includes(url);
                disableDomainSwitch.checked = disabledSites.includes(domain);
    
                disablePageSwitch.disabled = false;
                disableDomainSwitch.disabled = false;
            });
        });
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
        const existingNodesMap = new Map();
        annotationsContainer.querySelectorAll('.annotation-card').forEach(node => {
            existingNodesMap.set(node.dataset.annotationId, node);
        });

        const receivedIds = new Set(annotations.map(([id]) => id));

        // 1. Remove nodes that are no longer in the annotations list.
        // This happens if a deletion was finalized while the sidebar was closed.
        for (const [id, node] of existingNodesMap.entries()) {
            if (!receivedIds.has(id)) {
                node.remove();
                existingNodesMap.delete(id);
            }
        }

        // 2. Iterate through the new sorted list and reconcile with the DOM.
        let lastNode = null; 
        annotations.forEach(([id, annotation]) => {
            let node = existingNodesMap.get(id);

            if (node) {
                // If the node already exists, update its content if necessary.
                const textEl = node.querySelector('.text');
                const commentEl = node.querySelector('.comment');
                const colorBar = node.querySelector('.annotation-color-bar');

                if (textEl.innerHTML !== annotation.text) {
                    textEl.innerHTML = annotation.text;
                }
                const newCommentHtml = annotation.comment ? annotation.comment : `<span class="no-comment-placeholder">${chrome.i18n.getMessage('noComment')}</span>`;
                if (commentEl.innerHTML !== newCommentHtml) {
                    commentEl.innerHTML = newCommentHtml;
                }
                if (colorBar.style.backgroundColor !== annotation.color) {
                    colorBar.style.backgroundColor = annotation.color;
                }
                node.dataset.comment = annotation.comment || '';
            } else {
                // If the node doesn't exist, create it.
                node = createAnnotationCard(id, annotation);
                node.classList.add('newly-added');
                node.addEventListener('animationend', () => node.classList.remove('newly-added'), { once: true });
            }

            // 3. Ensure the node is in the correct position.
            if (!lastNode) {
                if (annotationsContainer.firstChild !== node) {
                    annotationsContainer.prepend(node);
                }
            } else {
                if (lastNode.nextSibling !== node) {
                    lastNode.after(node);
                }
            }
            lastNode = node;
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

        refreshButtons.forEach(button => {
            button.classList.add('refreshing');
            button.disabled = true;
        });

        // Ask the content script to send us a fresh, sorted list of annotations.
        // The response will be handled by the 'annotationsUpdated' message listener.
        chrome.tabs.sendMessage(myTabId, { action: 'requestRefresh' }, (response) => {
            setTimeout(() => {
                refreshButtons.forEach(button => {
                    button.classList.remove('refreshing');
                    button.disabled = false;
                });
            }, 600);

            if (chrome.runtime.lastError) {
                console.warn(`Highlighter: Could not connect to refresh. ${chrome.runtime.lastError.message}`);
                annotationsList.innerHTML = `<p>${chrome.i18n.getMessage('errorLoading')}</p>`;
                return;
            }

            if (showToastOnComplete) {
                showToast('annotationsRefreshed');
            }
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
        if (request.action === 'animateDelete') {
            const node = document.querySelector(`[data-annotation-id="${request.annotationId}"]`);
            const canAnimate = !!(node && !node.classList.contains('deleting'));
            if (canAnimate) {
                // Set dynamic height for smooth collapse via CSS variable
                node.style.setProperty('--card-height', `${node.offsetHeight}px`);
                // Trigger CSS slideOut animation
                node.classList.add('deleting');
                // When animation finishes, ask content script to finalize deletion
                node.addEventListener('animationend', () => {
                    if (myTabId) {
                        chrome.tabs.sendMessage(myTabId, {
                            action: 'finalizeDelete',
                            annotationId: request.annotationId
                        });
                    }
                }, { once: true });
            }
            // Always ACK so the sender knows whether we will animate
            try { sendResponse({ ok: canAnimate }); } catch (e) { /* no-op */ }
        }
        if (request.action === 'settingsChanged') {
            // Re-initialize to get the latest settings for the switches
            initialize();
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

    forceSolidSwitch.addEventListener('change', () => {
        settings.forceSolidHighlights = forceSolidSwitch.checked;
        saveSettings();
    });

    sidebarDarkModeSwitch.addEventListener('change', () => {
        settings.sidebarDarkMode = sidebarDarkModeSwitch.checked;
        applyDarkMode();
        saveSettings();
    });

    disablePageSwitch.addEventListener('change', (e) => {
        if (myTabId) {
            chrome.tabs.sendMessage(myTabId, { action: 'toggleDisablePage', disable: e.target.checked });
        }
    });

    disableDomainSwitch.addEventListener('change', (e) => {
        if (myTabId) {
            chrome.tabs.sendMessage(myTabId, { action: 'toggleDisableSite', disable: e.target.checked });
        }
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

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'sync') return;

        if (changes.disabledPages || changes.disabledSites) {
            updateSwitchStates();
        }
        if (changes['highlighter-settings']) {
            const newSettings = changes['highlighter-settings'].newValue;
            settings = { ...settings, ...newSettings };
            forceBlackSwitch.checked = settings.useDarkText;
            sidebarDarkModeSwitch.checked = settings.sidebarDarkMode;
            updateAnnotationTextStyles();
            applyDarkMode();
        }
    });

    // --- INITIALIZATION ---
    const initialize = () => {
        localizeUI();
        configButton.disabled = true;
        disablePageSwitch.disabled = true;
        disableDomainSwitch.disabled = true;
        forceBlackSwitch.disabled = true;
        forceSolidSwitch.disabled = true;
        sidebarDarkModeSwitch.disabled = true;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                console.error("Highlighter sidebar: Could not identify the host tab.");
                configButton.disabled = false;
                return;
            }
            const currentTab = tabs[0];
            myTabId = currentTab.id;

            loadPageInfo();
            loadAnnotations();

            chrome.storage.sync.get(['sidebarLocked', 'sidebarWidth', 'highlighter-settings'], (data) => {
                const isLocked = data.sidebarLocked === undefined ? true : data.sidebarLocked;
                setLockedState(isLocked);
                lastStoredWidth = Math.max(data.sidebarWidth || 420, 380);

                const defaultSettings = {
                    useDarkText: false,
                    sidebarDarkMode: false,
                    forceSolidHighlights: false,
                };
                settings = { ...defaultSettings, ...data['highlighter-settings'] };
                
                forceBlackSwitch.checked = settings.useDarkText;
                forceSolidSwitch.checked = settings.forceSolidHighlights;
                sidebarDarkModeSwitch.checked = settings.sidebarDarkMode;
                updateAnnotationTextStyles();
                applyDarkMode();
                
                updateSwitchStates();
                
                configButton.disabled = false;
                forceBlackSwitch.disabled = false;
                forceSolidSwitch.disabled = false;
                sidebarDarkModeSwitch.disabled = false;
            });
        });
    };

    // Tooltip for force black switch
    const infoIcon = document.querySelector('.info-icon[data-tooltip-key="forceBlackColorTooltip"]');
    if (infoIcon) {
        setupTooltip(infoIcon, 'forceBlackColorTooltip');
    }

    // Tooltip for force solid highlights switch
    const solidInfoIcon = document.querySelector('.info-icon[data-tooltip-key="forceSolidHighlightsTooltip"]');
    if (solidInfoIcon) {
        setupTooltip(solidInfoIcon, 'forceSolidHighlightsTooltip');
    }

    initialize();
});