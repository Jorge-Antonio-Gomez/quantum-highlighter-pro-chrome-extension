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

    // --- STATE ---
    let isLocked = false;
    let currentLanguage = 'en'; // Default language
    let lastStoredWidth = 420; // Default width

    // --- FLOATING UI ---
    const { computePosition, offset, flip, shift } = FloatingUIDOM;

    // --- RESIZE AND LOCK LOGIC ---

    const setLockedState = (locked) => {
        isLocked = locked;
        document.body.classList.toggle('locked', locked);
        
        const labelKey = locked ? 'unlockSidebarWidth' : 'lockSidebarWidth';
        const fallbackLabel = locked ? 'Unlock sidebar width' : 'Lock sidebar width';
        const label = translations[currentLanguage]?.[labelKey] || fallbackLabel;
        lockButton.setAttribute('aria-label', label);
        chrome.storage.sync.set({ sidebarLocked: locked });

        if (locked) {
            // When locking, save the current width
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
            // When unlocking, revert to the last stored width
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'setSidebarWidth', width: lastStoredWidth });
                }
            });
        }
    };

    lockButton.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    lockButton.addEventListener('click', () => {
        setLockedState(!isLocked);
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        if (isLocked) return;
        e.preventDefault();
        // Ask the content script to start handling the resize process
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startSidebarResize' });
            }
        });
    });

    // --- TRANSLATION & UI FUNCTIONS ---

    const applyTranslations = (lang) => {
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
        // Update lock button label
        const lockLabelKey = isLocked ? 'unlockSidebarWidth' : 'lockSidebarWidth';
        const fallbackLockLabel = isLocked ? 'Unlock sidebar width' : 'Lock sidebar width';
        const lockLabel = translations[lang]?.[lockLabelKey] || fallbackLockLabel;
        lockButton.setAttribute('aria-label', lockLabel);
    };

    const setLanguage = (lang) => {
        if (translations[lang]) {
            currentLanguage = lang;
            
            const triggerSpan = languageSelectTrigger.querySelector('span');
            const selectedOption = document.querySelector(`.custom-select-option[data-lang="${lang}"]`);
            if (triggerSpan && selectedOption) {
                triggerSpan.textContent = selectedOption.textContent;
            }
            
            chrome.storage.sync.set({ language: lang });
            
            applyTranslations(lang);
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'languageChanged', language: lang });
                }
            });

            document.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.lang === lang);
            });

            loadAnnotations();
        }
    };

    const loadLanguage = () => {
        chrome.storage.sync.get('language', (data) => {
            let lang = data.language || navigator.language.split('-')[0];
            if (!translations[lang]) lang = 'en';
            setLanguage(lang);
        });
    };

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

    function renderAnnotations(annotations) {
        const langStrings = translations[currentLanguage];
        const existingIds = new Set(Array.from(annotationsList.querySelectorAll('.annotation-card')).map(el => el.dataset.annotationId));
        const receivedIds = new Set(annotations.map(([id]) => id));

        // 1. Animate and remove cards that are no longer in the annotations list
        for (const id of existingIds) {
            if (!receivedIds.has(id)) {
                const cardToRemove = annotationsList.querySelector(`[data-annotation-id="${id}"]`);
                // Check if the card exists and is not already being deleted
                if (cardToRemove && !cardToRemove.classList.contains('deleting')) {
                    cardToRemove.classList.add('deleting');
                    cardToRemove.addEventListener('animationend', () => {
                        cardToRemove.remove();
                    }, { once: true });
                }
            }
        }

        // 2. Add or update cards
        if (!annotations || annotations.length === 0) {
            if (!annotationsList.querySelector('p')) {
                annotationsList.innerHTML = `<p data-i18n-key="noAnnotations">${langStrings.noAnnotations}</p>`;
            }
            return;
        } else {
            const p = annotationsList.querySelector('p');
            if (p) p.remove();
        }
        
        annotations.forEach(([id, annotation], index) => {
            let card = annotationsList.querySelector(`[data-annotation-id="${id}"]`);
            if (card) {
                // Card exists, update its content if necessary
                const textEl = card.querySelector('.text');
                const commentEl = card.querySelector('.comment');
                if (textEl.textContent !== annotation.text) textEl.textContent = annotation.text;
                if (commentEl.textContent !== (annotation.comment || langStrings.noComment)) {
                    commentEl.textContent = annotation.comment || langStrings.noComment;
                }
            } else {
                // Card doesn't exist, create and insert it
                card = createAnnotationCard(id, annotation);
                
                const nextAnnotation = annotations[index + 1];
                if (nextAnnotation) {
                    const nextCard = annotationsList.querySelector(`[data-annotation-id="${nextAnnotation[0]}"]`);
                    annotationsList.insertBefore(card, nextCard);
                } else {
                    annotationsList.appendChild(card);
                }

                card.classList.add('newly-added');
                card.addEventListener('animationend', () => {
                    card.classList.remove('newly-added');
                }, { once: true });
            }
        });
    }

    function createAnnotationCard(id, annotation) {
        const langStrings = translations[currentLanguage];
        const card = document.createElement('div');
        card.className = 'annotation-card';
        card.dataset.annotationId = id;

        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = annotation.text;

        const comment = document.createElement('div');
        comment.className = 'comment';
        comment.textContent = annotation.comment || langStrings.noComment;

        mainContent.appendChild(text);
        mainContent.appendChild(comment);

        const divider = document.createElement('div');
        divider.className = 'divider';

        const deleteArea = document.createElement('div');
        deleteArea.className = 'delete-area';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        const deleteLabel = langStrings.deleteAnnotation || 'Delete annotation';
        deleteBtn.setAttribute('aria-label', deleteLabel);
        
        const deleteIcon = document.createElement('img');
        deleteIcon.src = 'images/trash-svgrepo-com.svg';
        deleteIcon.alt = deleteLabel;
        deleteBtn.appendChild(deleteIcon);
        deleteArea.appendChild(deleteBtn);

        card.appendChild(mainContent);
        card.appendChild(divider);
        card.appendChild(deleteArea);

        mainContent.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'scrollToAnnotation', annotationId: id });
                }
            });
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // The 'renderAnnotations' function will now handle the animation
            // when it receives the 'annotationsUpdated' message.
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
            const langStrings = translations[currentLanguage];

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

    // --- EVENT LISTENERS ---

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'annotationsUpdated') {
            renderAnnotations(request.data);
        }
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
            languageOptions.classList.remove('show');
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
        chrome.storage.sync.get(['sidebarLocked', 'language', 'sidebarWidth'], (data) => {
            // If sidebarLocked is undefined (first run), default to true (locked).
            const isLocked = data.sidebarLocked === undefined ? true : data.sidebarLocked;
            setLockedState(isLocked);
            
            lastStoredWidth = Math.max(data.sidebarWidth || 420, 380);
            let lang = data.language || navigator.language.split('-')[0];
            if (!translations[lang]) lang = 'en';
            setLanguage(lang);
        });
    };

    initialize();
});


