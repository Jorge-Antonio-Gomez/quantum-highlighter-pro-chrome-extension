document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTS ---
    const resizeHandle = document.getElementById('resize-handle');
    const lockButton = document.getElementById('lock-button');
    const configButton = document.getElementById('config-button');
    const configPopup = document.getElementById('config-popup');
    const closeButton = document.getElementById('close-button');
    const annotationsList = document.getElementById('annotations-list');
    const languageSelectWrapper = document.getElementById('language-select-wrapper');
    const languageSelectTrigger = document.getElementById('language-select-trigger');
    const languageOptions = document.getElementById('language-options');
    const forceBlackSwitch = document.getElementById('force-black-switch');
    const disablePageSwitch = document.getElementById('disable-page-switch');
    const disableDomainSwitch = document.getElementById('disable-domain-switch');
    const websiteInfoCard = document.getElementById('website-info-card');
    const websiteFavicon = document.getElementById('website-favicon');
    const websiteTitle = document.getElementById('website-title');
    const websiteDescription = document.getElementById('website-description');
    const websiteDomain = document.getElementById('website-domain');

    // --- STATE ---
    let isLocked = false;
    let lastStoredWidth = 420; // Default width
    let settings = {
        language: 'en',
        useDarkText: false,
    };

    // --- FLOATING UI ---
    const { computePosition, offset, flip, shift } = FloatingUIDOM;

    // --- CORE FUNCTIONS ---

    function saveSettings() {
        chrome.storage.sync.set({ 'highlighter-settings': settings });
        // Notify content script of the change
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'settingChanged',
                    settings: settings
                });
            }
        });
    }

    const applyTranslations = () => {
        const lang = settings.language;
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            if (translations[lang] && translations[lang][key]) {
                const value = translations[lang][key];
                if (el.tagName === 'H2' || el.tagName === 'LABEL' || el.tagName === 'SPAN' || el.tagName === 'P') {
                    el.textContent = value;
                } else {
                    el.setAttribute('aria-label', value);
                }
            }
        });
        const lockLabelKey = isLocked ? 'unlockSidebarWidth' : 'lockSidebarWidth';
        const fallbackLockLabel = isLocked ? 'Unlock sidebar width' : 'Lock sidebar width';
        const lockLabel = translations[lang]?.[lockLabelKey] || fallbackLockLabel;
        lockButton.setAttribute('aria-label', lockLabel);
    };

    const setLanguage = (lang) => {
        if (!translations[lang]) lang = 'en'; // Fallback to English
        settings.language = lang;

        const triggerSpan = languageSelectTrigger.querySelector('span');
        const selectedOption = document.querySelector(`.custom-select-option[data-lang="${lang}"]`);
        if (triggerSpan && selectedOption) {
            triggerSpan.textContent = selectedOption.textContent;
        }

        applyTranslations();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'languageChanged', language: lang });
            }
        });

        document.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.lang === lang);
        });

        loadAnnotations();
    };

    function updateAnnotationTextStyles() {
        annotationsList.classList.toggle('dark-text', settings.useDarkText);
    }

    // --- RESIZE AND LOCK LOGIC ---

    const setLockedState = (locked) => {
        isLocked = locked;
        document.body.classList.toggle('locked', locked);
        applyTranslations(); // Re-apply translations to update lock button label
        chrome.storage.sync.set({ sidebarLocked: locked });

        if (locked) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'getSidebarWidth' }, (response) => {
                        if (response && response.width) {
                            lastStoredWidth = response.width;
                            chrome.storage.sync.set({ sidebarWidth: response.width });
                        }
                    });
                }
            });
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'setSidebarWidth', width: lastStoredWidth });
                }
            });
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

    const toggleLanguageDropdown = () => {
        languageOptions.classList.toggle('show');
    };

    // --- ANNOTATION RENDERING ---

    function renderAnnotations(annotations) {
        const langStrings = translations[settings.language] || translations.en;
        const annotationsContainer = annotationsList;
        const hadAnnotations = annotationsContainer.querySelectorAll('.annotation-card').length > 0;
        const hasAnnotations = annotations && annotations.length > 0;

        // Handle transition from annotations to empty state
        if (hadAnnotations && !hasAnnotations) {
            const emptyView = createEmptyStateView(langStrings);
            emptyView.style.opacity = '0'; // Start transparent
            annotationsContainer.appendChild(emptyView);
            annotationsContainer.classList.add('empty-state');
            requestAnimationFrame(() => {
                emptyView.style.transition = 'opacity 0.5s ease-out';
                emptyView.style.opacity = '1';
            });
        }
        // Handle transition from empty state to annotations
        else if (!hadAnnotations && hasAnnotations) {
            const emptyView = annotationsContainer.querySelector('.empty-state-content');
            if (emptyView) {
                emptyView.classList.add('hiding');
                emptyView.addEventListener('animationend', () => {
                    annotationsContainer.classList.remove('empty-state');
                    emptyView.remove();
                }, { once: true });
            }
        }
        // Handle initial empty state
        else if (!hasAnnotations && !annotationsContainer.querySelector('.empty-state-content')) {
            annotationsContainer.innerHTML = ''; // Clear previous content
            const emptyView = createEmptyStateView(langStrings);
            annotationsContainer.appendChild(emptyView);
            annotationsContainer.classList.add('empty-state');
        }

        if (!hasAnnotations) {
            // Clear out any remaining card elements if we are in the empty state
            annotationsContainer.querySelectorAll('.annotation-card').forEach(card => card.remove());
            return;
        }

        // If we have annotations, ensure the empty-state class is removed
        if (hasAnnotations) {
            annotationsContainer.classList.remove('empty-state');
        }

        const existingIds = new Set(Array.from(annotationsContainer.querySelectorAll('.annotation-card')).map(el => el.dataset.annotationId));
        const receivedAnnotationsMap = new Map(annotations);

        // 1. Remove annotations that are no longer present
        for (const id of existingIds) {
            if (!receivedAnnotationsMap.has(id)) {
                const cardToRemove = annotationsContainer.querySelector(`[data-annotation-id="${id}"]`);
                if (cardToRemove && !cardToRemove.classList.contains('deleting')) {
                    cardToRemove.classList.add('deleting');
                    cardToRemove.addEventListener('animationend', () => {
                        cardToRemove.remove();
                    }, { once: true });
                }
            }
        }

        // 2. Update existing and add new annotations
        let lastElement = null;
        annotations.forEach(([id, annotation]) => {
            let card = annotationsContainer.querySelector(`[data-annotation-id="${id}"]`);

            if (card) {
                // Element exists, check for updates
                const textEl = card.querySelector('.text');
                const commentEl = card.querySelector('.comment');
                const colorBar = card.querySelector('.annotation-color-bar');

                if (textEl.innerHTML !== annotation.text) textEl.innerHTML = annotation.text;
                const newCommentHtml = annotation.comment || `<span class="no-comment-placeholder">${langStrings.noComment}</span>`;
                if (commentEl.innerHTML !== newCommentHtml) commentEl.innerHTML = newCommentHtml;
                if (colorBar.style.backgroundColor !== annotation.color) colorBar.style.backgroundColor = annotation.color;
                card.dataset.comment = annotation.comment || '';
            } else {
                // Element is new, create and insert it
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

    function createEmptyStateView(langStrings) {
        const emptyView = document.createElement('div');
        emptyView.className = 'empty-state-content';
        emptyView.innerHTML = `
            <div class="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M5 7C5 6.44772 5.44772 6 6 6H18C18.5523 6 19 6.44772 19 7C19 7.55228 18.5523 8 18 8H6C5.44772 8 5 7.55228 5 7ZM5 12C5 11.4477 5.44772 11 6 11H18C18.5523 11 19 11.4477 19 12C19 12.5523 18.5523 13 18 13H6C5.44772 13 5 12.5523 5 12ZM5 17C5 16.4477 5.44772 16 6 16H11C11.5523 16 12 16.4477 12 17C12 17.5523 11.5523 18 11 18H6C5.44772 18 5 17.5523 5 17Z" fill="currentColor"/>
                </svg>
            </div>
            <h3 class="empty-state-title">${langStrings.noAnnotationsTitle || 'No Annotations Yet'}</h3>
            <p class="empty-state-text">${langStrings.noAnnotations || 'Highlight text on the page to get started!'}</p>
        `;
        return emptyView;
    }


    function createAnnotationCard(id, annotation) {
        const langStrings = translations[settings.language] || translations.en;
        const card = document.createElement('div');
        card.className = 'annotation-card';
        card.dataset.annotationId = id;
        card.dataset.comment = annotation.comment || ''; // Store initial comment

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
        if (annotation.comment) {
            commentDisplay.innerHTML = annotation.comment;
        } else {
            commentDisplay.innerHTML = `<span class="no-comment-placeholder">${langStrings.noComment}</span>`;
        }
        
        mainContent.appendChild(text);
        mainContent.appendChild(commentDisplay);

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'actions-container';

        const commentBtn = document.createElement('button');
        commentBtn.className = 'comment-btn';
        commentBtn.setAttribute('aria-label', langStrings.addComment || 'Add comment');
        commentBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 9.5H16.5M7.5 13.5H12.5M21 12C21 16.9706 16.9706 21 12 21C10.517 21 9.11249 20.6318 7.88573 19.9679L3 21L4.0321 16.1143C3.36821 14.8875 3 13.483 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        const divider = document.createElement('div');
        divider.className = 'divider';
        
        // actionsContainer.appendChild(commentBtn);
        actionsContainer.appendChild(divider);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', langStrings.deleteAnnotation || 'Delete annotation');
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V6H17H19C19.5523 6 20 6.44772 20 7C20 7.55228 19.5523 8 19 8H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V8H5C4.44772 8 4 7.55228 4 7C4 6.44772 4.44772 6 5 6H7H9V5ZM10 8H8V18C8 18.5523 8.44772 19 9 19H15C15.5523 19 16 18.5523 16 18V8H14H10ZM13 6H11V5H13V6ZM10 9C10.5523 9 11 9.44772 11 10V17C11 17.5523 10.5523 18 10 18C9.44772 18 9 17.5523 9 17V10C9 9.44772 9.44772 9 10 9ZM14 9C14.5523 9 15 9.44772 15 10V17C15 17.5523 14.5523 18 14 18C13.4477 18 13 17.5523 13 17V10C13 9.44772 13.4477 9 14 9Z" fill="currentColor"/>
            </svg>
        `;
        actionsContainer.appendChild(deleteBtn);

        card.appendChild(mainContent);
        card.appendChild(actionsContainer);

        mainContent.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'scrollToAnnotation', annotationId: id });
                }
            });
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'deleteAnnotation', annotationId: id });
                }
            });
        });

        return card;
    }

    function loadAnnotations() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0 || !tabs[0].id) {
                renderAnnotations([]);
                return;
            }
            const currentTab = tabs[0];
            const langStrings = translations[settings.language] || translations.en;
            if (currentTab.url && currentTab.url.startsWith('chrome-extension://')) {
                annotationsList.innerHTML = `<p data-i18n-key="noAnnotations">${langStrings.noAnnotations}</p>`;
                return;
            }
            chrome.tabs.sendMessage(currentTab.id, { action: 'getAnnotations' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn(`Highlighter: Could not connect. ${chrome.runtime.lastError.message}`);
                    annotationsList.innerHTML = `<p data-i18n-key="errorLoading">${langStrings.errorLoading}</p>`;
                    return;
                }
                renderAnnotations(response?.data || []);
            });
        });
    }

    function loadPageInfo() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0 || !tabs[0].id) return;
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { action: 'getPageInfo' }, (response) => {
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
        });
    }

    // --- EVENT LISTENERS ---

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'annotationsUpdated') {
            renderAnnotations(request.data);
        }
    });

    lockButton.addEventListener('mousedown', (e) => {
        // Prevent this event from bubbling up to the resize handle
        e.stopPropagation();
    });
    lockButton.addEventListener('click', () => setLockedState(!isLocked));
    resizeHandle.addEventListener('mousedown', (e) => {
        if (isLocked) return;
        e.preventDefault();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startSidebarResize' });
            }
        });
    });

    configButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = configPopup.style.display === 'none' || !configPopup.style.display;
        isHidden ? showPopup() : hidePopup();
    });

    closeButton.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSidebar' });
            }
        });
    });

    languageSelectTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLanguageDropdown();
    });

    document.querySelectorAll('.custom-select-option').forEach(option => {
        option.addEventListener('click', (e) => {
            setLanguage(e.target.dataset.lang);
            saveSettings(); // Save after changing the language
            languageOptions.classList.remove('show');
        });
    });

    forceBlackSwitch.addEventListener('change', () => {
        settings.useDarkText = forceBlackSwitch.checked;
        updateAnnotationTextStyles();
        saveSettings(); // Save after changing the switch
    });

    disablePageSwitch.addEventListener('change', (e) => {
        const checked = e.target.checked;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].url) {
                const href = tabs[0].url;
                chrome.storage.sync.get({ disabledPages: [] }, (data) => {
                    let disabledPages = data.disabledPages;
                    if (checked) {
                        if (!disabledPages.includes(href)) disabledPages.push(href);
                    } else {
                        disabledPages = disabledPages.filter(page => page !== href);
                    }
                    chrome.storage.sync.set({ disabledPages }, () => {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleActivation', disabled: checked });
                    });
                });
            }
        });
    });

    disableDomainSwitch.addEventListener('change', (e) => {
        const checked = e.target.checked;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].url) {
                const hostname = new URL(tabs[0].url).hostname;
                chrome.storage.sync.get({ disabledSites: [] }, (data) => {
                    let disabledSites = data.disabledSites;
                    if (checked) {
                        if (!disabledSites.includes(hostname)) disabledSites.push(hostname);
                    } else {
                        disabledSites = disabledSites.filter(site => site !== hostname);
                    }
                    chrome.storage.sync.set({ disabledSites }, () => {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleActivation', disabled: checked });
                    });
                });
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (configPopup.style.display === 'block') hidePopup();
            if (languageOptions.classList.contains('show')) languageOptions.classList.remove('show');
        }
    });

    document.addEventListener('click', (e) => {
        if (configPopup.style.display === 'block' && !configPopup.contains(e.target) && !configButton.contains(e.target)) {
            hidePopup();
        }
        if (languageOptions.classList.contains('show') && !languageSelectWrapper.contains(e.target)) {
            languageOptions.classList.remove('show');
        }
    });

    // --- INITIALIZATION ---
    const initialize = () => {
        loadPageInfo(); // Load page info on startup
        chrome.storage.sync.get(['sidebarLocked', 'sidebarWidth', 'highlighter-settings', 'disabledSites', 'disabledPages'], (data) => {
            // Set up sidebar lock and width
            const isLocked = data.sidebarLocked === undefined ? true : data.sidebarLocked;
            setLockedState(isLocked);
            lastStoredWidth = Math.max(data.sidebarWidth || 420, 380);

            // Safely load and merge settings
            const defaultSettings = {
                language: navigator.language.split('-')[0] || 'en',
                useDarkText: false
            };
            settings = { ...defaultSettings, ...data['highlighter-settings'] };
            
            // Apply loaded settings to the UI
            setLanguage(settings.language);
            forceBlackSwitch.checked = settings.useDarkText;
            updateAnnotationTextStyles();

            // Save the potentially merged/cleaned settings back to storage
            saveSettings();

            // Set initial state for disable switches
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].url) {
                    const url = new URL(tabs[0].url);
                    const disabledSites = data.disabledSites || [];
                    const disabledPages = data.disabledPages || [];
                    disableDomainSwitch.checked = disabledSites.includes(url.hostname);
                    disablePageSwitch.checked = disabledPages.includes(url.href);
                }
            });
        });

        // Tooltip logic
        const tooltip = document.getElementById('tooltip');
        document.querySelectorAll('[data-tooltip-key]').forEach(el => {
            el.addEventListener('mouseenter', (e) => {
                const tooltipKey = e.target.dataset.tooltipKey;
                const langStrings = translations[settings.language] || translations.en;
                if (langStrings[tooltipKey]) {
                    tooltip.textContent = langStrings[tooltipKey];
                    tooltip.style.display = 'block';
                    computePosition(e.target, tooltip, {
                        placement: 'top',
                        middleware: [offset(8), flip(), shift({padding: 5})],
                    }).then(({x, y}) => {
                        tooltip.style.left = `${x}px`;
                        tooltip.style.top = `${y}px`;
                    });
                }
            });
            el.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    };

    initialize();
});
