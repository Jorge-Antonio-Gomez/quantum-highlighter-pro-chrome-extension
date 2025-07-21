(function () {
    'use strict';

    const SIDEBAR_ID = 'highlighter-sidebar-instance';
    const RESIZE_COVER_ID = 'highlighter-resize-cover';
    const RESIZE_GUIDE_ID = 'highlighter-resize-guide';
    const MIN_WIDTH = 380;
    const MAX_WIDTH = 1000;

    function toggleSidebar() {
        let sidebar = document.getElementById(SIDEBAR_ID);

        if (sidebar) {
            sidebar.style.transform = 'translateX(100%)';
            document.body.style.marginRight = '0';
            document.body.classList.remove('highlighter-sidebar-open');
            sidebar.addEventListener('transitionend', () => sidebar.remove(), { once: true });
        } else {
            chrome.storage.sync.get({ sidebarWidth: 420 }, (data) => {
                const initialWidth = Math.max(data.sidebarWidth, MIN_WIDTH);
                sidebar = document.createElement('iframe');
                sidebar.id = SIDEBAR_ID;
                sidebar.src = chrome.runtime.getURL('sidebar.html');
                sidebar.style.cssText = `
                    position: fixed;
                    top: 0;
                    right: 0;
                    width: ${initialWidth}px;
                    height: 100%;
                    border: none;
                    z-index: 9999999;
                    transition: transform 0.3s ease-in-out, width 0.3s ease-in-out;
                    transform: translateX(100%);
                `;
                document.body.appendChild(sidebar);
                void sidebar.offsetWidth; 
                sidebar.style.transform = 'translateX(0)';
                document.body.style.marginRight = `${initialWidth}px`;
                document.body.classList.add('highlighter-sidebar-open');
            });
        }
    }

    // --- Resizing Logic ---

    const handleDrag = (e) => {
        const guide = document.getElementById(RESIZE_GUIDE_ID);
        if (!guide) return;
        
        e.preventDefault();
        e.stopPropagation();

        const clientWidth = document.documentElement.clientWidth;
        const newLeft = Math.max(clientWidth - MAX_WIDTH, Math.min(e.clientX, clientWidth - MIN_WIDTH));
        guide.style.left = `${newLeft}px`;
    };

    const stopDrag = (e) => {
        const sidebar = document.getElementById(SIDEBAR_ID);
        const cover = document.getElementById(RESIZE_COVER_ID);
        const guide = document.getElementById(RESIZE_GUIDE_ID);

        document.removeEventListener('mousemove', handleDrag, true);
        document.removeEventListener('mouseup', stopDrag, true);

        if (cover) cover.remove();
        
        if (sidebar && guide) {
            const guideRect = guide.getBoundingClientRect();
            const newWidth = document.documentElement.clientWidth - guideRect.left;
            
            sidebar.style.width = `${newWidth}px`;
            document.body.style.marginRight = `${newWidth}px`;
            
            chrome.runtime.sendMessage({ action: 'sidebarResizeEnded' });
        }

        if (guide) guide.remove();
    };

    function startSidebarResize() {
        chrome.storage.sync.get({ sidebarLocked: false }, (data) => {
            if (data.sidebarLocked) return;

            const sidebar = document.getElementById(SIDEBAR_ID);
            if (!sidebar) return;

            let cover = document.getElementById(RESIZE_COVER_ID);
            if (!cover) {
                cover = document.createElement('div');
                cover.id = RESIZE_COVER_ID;
                cover.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: transparent; cursor: col-resize; z-index: 10000000;
                `;
                document.body.appendChild(cover);
            }

            let guide = document.getElementById(RESIZE_GUIDE_ID);
            if (!guide) {
                guide = document.createElement('div');
                guide.id = RESIZE_GUIDE_ID;
                guide.style.cssText = `
                    position: fixed; top: 0; height: 100vh; width: 2px;
                    background-image: linear-gradient(to bottom, #444 4px, transparent 4px);
                    background-size: 100% 8px;
                    z-index: 10000001;
                    pointer-events: none;
                `;
                const sidebarRect = sidebar.getBoundingClientRect();
                guide.style.left = `${sidebarRect.left}px`;
                document.body.appendChild(guide);
            }

            document.addEventListener('mousemove', handleDrag, true);
            document.addEventListener('mouseup', stopDrag, true);
        });
    }

    // --- End Resizing Logic ---


    const { computePosition, offset, flip, shift, arrow } = FloatingUIDOM;

    const styles = `
        :root {
            --highlighter-z-index: 10001;
            --highlighter-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            --highlighter-radius: 8px;
            --highlighter-transition: all 0.15s ease-in-out;
            --highlighter-color-yellow: #FDEE87;
            --highlighter-color-red: #FF9A9A;
            --highlighter-color-green: #A8E6A8;
            --highlighter-color-blue: #A8D1E6;
            --highlighter-color-purple: #D1A8E6;
            --highlighter-color-pink: #E6A8D1;
            --highlighter-color-orange: #F9C9A1;
            --highlighter-color-grey: #D8D8D8;
        }
        .highlighter-mark { cursor: pointer; transition: var(--highlighter-transition); background-color: transparent; }
        .highlighter-mark:hover { opacity: 1; }
        .highlighter-menu { position: absolute; display: none; flex-direction: column; gap: 4px; background: white; border-radius: var(--highlighter-radius); box-shadow: var(--highlighter-shadow); z-index: var(--highlighter-z-index); font-family: 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 6px; transition: opacity 0.1s ease-in-out; width: auto; transform-origin: top center; }
        .highlighter-menu.show { display: flex; }
        #highlighter-arrow { position: absolute; background: white; width: 8px; height: 8px; transform: rotate(45deg); }
        .highlighter-menu .menu-row { display: flex; gap: 5px; justify-content: center; align-items: center; }
        .highlighter-menu .menu-row.types { background-color: #f0f0f0; padding: 3px; border-radius: 6px; }
        .highlighter-menu button { background: none; border: none; border-radius: 5px; cursor: pointer; transition: var(--highlighter-transition); display: flex; align-items: center; justify-content: center; }
        .highlighter-color-selector { width: 22px; height: 22px; border: 1px solid rgba(0,0,0,0.1); padding: 0; flex-shrink: 0; }
        .highlighter-color-selector.active { box-shadow: 0 0 0 3px #57b4dfff; }
        .highlighter-type-selector { flex: 1; height: 25px; font-size: 16px; font-weight: bold; color: #555; background-color: transparent; }
        .highlighter-type-selector.active { background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .highlighter-type-selector .underline { text-decoration: underline; text-decoration-thickness: 2px; }
        .highlighter-delete-btn { flex: 1; height: 25px; background-color: #f0f0f0; color: #333; }
        .highlighter-delete-btn:hover { background-color: #FFE0E0; color: #D8000C; }
        .highlighter-shortcut-warning { font-size: 11px; color: #888; text-align: center; padding: 4px 0 0 0; border-top: 1px solid #f0f0f0; margin-top: 4px; }
    `;

    class DOMManager {
        static getXPathForNode(node) {
            if (node.id) return `id("${node.id}")`;
            const parts = [];
            while (node && node.nodeType === Node.ELEMENT_NODE) {
                let index = 0;
                for (let s = node.previousSibling; s; s = s.previousSibling) if (s.nodeName === node.nodeName) index++;
                parts.unshift(`${node.nodeName.toLowerCase()}[${index + 1}]`);
                node = node.parentNode;
            }
            return parts.length ? '/' + parts.join('/') : null;
        }
        static getNodeFromXPath(path) {
            try {
                if (path.startsWith("id(")) return document.getElementById(path.match(/id\("([^"]+)"\)/)[1]);
                return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            } catch (e) { return null; }
        }
        static getRangePointers(range) {
            const { startContainer, endContainer, startOffset, endOffset } = range;
            const getPointers = (c, o) => ({ xpath: DOMManager.getXPathForNode(c.nodeType === 3 ? c.parentNode : c), childIndex: Array.from(c.parentNode.childNodes).indexOf(c), offset: o });
            return { start: getPointers(startContainer, startOffset), end: getPointers(endContainer, endOffset) };
        }
        static getRangeFromPointers({ start, end }) {
            const startNode = DOMManager.getNodeFromXPath(start.xpath)?.childNodes[start.childIndex];
            const endNode = DOMManager.getNodeFromXPath(end.xpath)?.childNodes[end.childIndex];
            if (!startNode || !endNode) return null;
            const range = document.createRange();
            const startNodeLength = startNode.nodeType === Node.TEXT_NODE ? startNode.length : startNode.childNodes.length;
            const endNodeLength = endNode.nodeType === Node.TEXT_NODE ? endNode.length : endNode.childNodes.length;
            const safeStartOffset = Math.min(start.offset, startNodeLength);
            const safeEndOffset = Math.min(end.offset, endNodeLength);
            try {
                range.setStart(startNode, safeStartOffset);
                range.setEnd(endNode, safeEndOffset);
                return range;
            } catch (e) {
                console.error("Highlighter: Error creating range from pointers.", e);
                return null;
            }
        }
        static applyAnnotationStyle(element, annotation, nodeContext) {
            const colorWithOpacity = annotation.color.startsWith('#') ? `${annotation.color}80` : annotation.color;
            const settings = window.highlighterInstance ? window.highlighterInstance.settings : { useDarkText: false };
            const isLink = (nodeContext && nodeContext.nodeType === Node.TEXT_NODE ? nodeContext.parentNode.closest('a') : (nodeContext ? nodeContext.closest('a') : element.closest('a')));

            // Set base style based on annotation type
            if (annotation.type === 'highlight') {
                element.style.backgroundColor = colorWithOpacity;
                element.style.borderBottom = 'none';
            } else { // underline
                element.style.backgroundColor = 'transparent';
                element.style.borderBottom = `2px solid ${colorWithOpacity}`;
            }

            // Determine text color, giving !important priority to the useDarkText setting
            if (settings.useDarkText) {
                element.style.setProperty('color', '#1a1a1a', 'important');
            } else {
                // When the setting is off, remove the !important property by setting a new, regular style
                if (isLink) {
                    element.style.color = 'inherit';
                } else if (annotation.type === 'highlight') {
                    const bodyColor = window.getComputedStyle(document.body).color;
                    element.style.color = DOMManager.isColorLight(bodyColor) ? '#1a1a1a' : 'inherit';
                } else {
                    element.style.color = 'inherit';
                }
            }
        }
        static wrapRange(range, annotation) {
            if (range.collapsed) return [];
            const affectedNodes = DOMManager.getNodesInRange(range);
            const marks = [];
            affectedNodes.forEach(node => {
                if (node.nodeType !== Node.TEXT_NODE || node.parentNode.closest('script, style')) return;
                const nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);
                if (node === range.startContainer) nodeRange.setStart(node, range.startOffset);
                if (node === range.endContainer) nodeRange.setEnd(node, range.endOffset);
                if (!nodeRange.collapsed) {
                    const mark = document.createElement('mark');
                    mark.className = 'highlighter-mark';
                    mark.dataset.annotationId = annotation.id;
                    DOMManager.applyAnnotationStyle(mark, annotation, node);
                    try {
                        nodeRange.surroundContents(mark);
                        marks.push(mark);
                    } catch (e) {
                        console.warn("Highlighter: Could not wrap a node.", e);
                    }
                }
            });
            if (marks.length > 0) marks[0].parentNode?.normalize();
            return marks;
        }
        static getNodesInRange(range) {
            const nodes = [];
            let node = range.startContainer;
            while (node && range.comparePoint(node, 0) !== 1) {
                if (range.intersectsNode(node)) nodes.push(node);
                node = DOMManager.getNextNode(node);
            }
            return nodes;
        }
        static getNextNode(node) {
            if (node.firstChild) return node.firstChild;
            while (node) {
                if (node.nextSibling) return node.nextSibling;
                node = node.parentNode;
            }
            return null;
        }
        static unwrap(element) {
            const parent = element.parentNode;
            while (element.firstChild) parent.insertBefore(element.firstChild, element);
            parent.removeChild(element);
            parent.normalize();
        }
        static isColorLight(colorString) {
            try {
                const match = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (!match) return false;
                const [, r, g, b] = match.map(Number);
                return ((r * 299) + (g * 587) + (b * 114)) / 1000 > 155;
            } catch (e) { return false; }
        }

        static getSanitizedHtmlFromRange(range) {
            const allowedTags = ['B', 'STRONG', 'I', 'EM'];
            const content = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(content);

            const allElements = tempDiv.querySelectorAll('*');
            
            // Iterate backwards to safely remove or modify nodes
            for (let i = allElements.length - 1; i >= 0; i--) {
                const el = allElements[i];
                if (allowedTags.includes(el.tagName)) {
                    // It's an allowed tag, just remove its attributes for security
                    while (el.attributes.length > 0) {
                        el.removeAttribute(el.attributes[0].name);
                    }
                } else {
                    // It's not an allowed tag, so "unwrap" it.
                    // Move all its children out, then remove the empty tag.
                    const parent = el.parentNode;
                    while (el.firstChild) {
                        parent.insertBefore(el.firstChild, el);
                    }
                    parent.removeChild(el);
                }
            }
            return tempDiv.innerHTML;
        }
    }

    class HighlightStorage {
        constructor() { this.keyPrefix = `highlighter-annotations-`; }
        
        getKey() {
            return `${this.keyPrefix}${window.location.hostname}${window.location.pathname}`;
        }

        generateId() { return `h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
        
        save(annotations, callback) {
            const key = this.getKey();
            const dataToSave = { [key]: JSON.stringify(Array.from(annotations.entries())) };
            chrome.storage.local.set(dataToSave, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving annotations:", chrome.runtime.lastError);
                }
                if (callback) callback();
            });
        }

        load(callback) {
            const newKey = this.getKey();
            const oldKey = `highlighter-annotations-${window.location.hostname}${window.location.pathname}`; // The literal old key

            // 1. Try loading from the new storage
            chrome.storage.local.get(newKey, (data) => {
                if (chrome.runtime.lastError) {
                    console.error("Error loading annotations:", chrome.runtime.lastError);
                    callback(new Map());
                    return;
                }

                const d = data[newKey];
                if (d) {
                    // Found in new storage, normal path
                    const annotations = new Map(JSON.parse(d));
                    callback(annotations);
                } else {
                    // 2. Not found in new storage, try migrating from old localStorage
                    try {
                        const oldData = localStorage.getItem(oldKey);
                        if (oldData) {
                            console.log("Highlighter: Found old annotations in localStorage. Migrating now.");
                            const annotations = new Map(JSON.parse(oldData));
                            
                            // 3. Save to new location and delete from old
                            this.save(annotations, () => {
                                console.log("Highlighter: Migration successful. Deleting old data from localStorage.");
                                localStorage.removeItem(oldKey);
                                callback(annotations); // Return the migrated annotations
                            });
                        } else {
                            // No data in old storage either, just return empty
                            callback(new Map());
                        }
                    } catch (e) {
                        console.error("Highlighter: Error during migration from localStorage.", e);
                        callback(new Map());
                    }
                }
            });
        }
    }

    class HighlightMenu {
        constructor(initialLang) {
            this.lang = initialLang;
            this.element = document.createElement('div');
            this.element.className = 'highlighter-menu';
            document.body.appendChild(this.element);
            this.arrowElement = null;

            this.closeButton = document.createElement('button');
            this.closeButton.className = 'highlighter-close-btn';
            this.closeButton.innerHTML = '&#x2715;';
            document.body.appendChild(this.closeButton);

            this.contextMenu = document.createElement('div');
            this.contextMenu.className = 'highlighter-context-menu';
            this.contextMenu.style.display = 'none';
            document.body.appendChild(this.contextMenu);
        }

        updateLanguage(newLang) {
            this.lang = newLang;
        }

        isVisible() {
            return this.element.classList.contains('show');
        }

        configure(config) {
            const { types, colors, actions } = config.buttons;
            let typesHTML = types ? `<div class="menu-row types">${this._createButtons(types)}</div>` : '';
            let colorsHTML = colors ? `<div class="menu-row colors">${this._createButtons(colors)}</div>` : '';
            let actionsHTML = actions ? `<div class="menu-row actions">${this._createButtons(actions)}</div>` : '';
            let warningHTML = config.showWarning ? `<div class="highlighter-shortcut-warning">${this.lang.shortcutsDisabled}</div>` : '';

            this.element.innerHTML = `<div id="highlighter-arrow"></div>${colorsHTML}${typesHTML}${actionsHTML}${warningHTML}`;
            this.arrowElement = this.element.querySelector('#highlighter-arrow');

            this.element.onclick = (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                e.stopPropagation();
                const { action, value } = button.dataset;
                if (action && config.callbacks[action]) {
                    config.callbacks[action](value, button);
                }
            };
        }

        _createButtons(buttons) {
            return buttons.map(btn => `<button title="${btn.label}" data-action="${btn.action}" ${btn.value ? `data-value="${btn.value}"` : ''} class="${btn.className || ''}">${btn.content || ''}</button>`).join('');
        }

        async show(referenceEl, contextMenuCallbacks) {
            this.hideContextMenu();
            this.element.classList.remove('closing');
            this.element.style.animation = 'popup-bounce-in 150ms ease-out forwards';
            this.element.classList.add('show');
            
            const { x, y, placement, middlewareData } = await computePosition(referenceEl, this.element, {
                placement: 'bottom',
                middleware: [offset(12), flip(), shift({ padding: 10 }), arrow({ element: this.arrowElement })],
            });
            Object.assign(this.element.style, { left: `${x}px`, top: `${y}px` });

            const { x: arrowX, y: arrowY } = middlewareData.arrow;
            const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[placement.split('-')[0]];
            Object.assign(this.arrowElement.style, {
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                [staticSide]: '-4px',
            });

            this.element.addEventListener('animationend', (e) => {
                if (e.animationName === 'popup-bounce-in') {
                    computePosition(this.element, this.closeButton, {
                        placement: 'bottom-end',
                        middleware: [offset(1.5)],
                    }).then(({ x, y }) => {
                        Object.assign(this.closeButton.style, { left: `${x}px`, top: `${y}px` });
                        this.closeButton.classList.add('show');
                    });
                }
            }, { once: true });

            this.closeButton.onclick = (e) => {
                e.stopPropagation();
                if (this.contextMenu.style.display === 'block') {
                    this.hideContextMenu();
                } else {
                    this.showContextMenu(contextMenuCallbacks);
                }
            };
        }

        hide() {
            this.element.style.animation = 'popup-bounce-out 150ms ease-in forwards';
            this.element.classList.add('closing');
            
            this.element.addEventListener('animationend', (e) => {
                if (e.animationName === 'popup-bounce-out') {
                    this.element.classList.remove('show');
                    this.closeButton.classList.remove('show');
                    this.hideContextMenu();
                }
            }, { once: true });
        }

        showContextMenu(callbacks) {
            this.contextMenu.innerHTML = `
                <button data-action="hide">${this.lang.hideUntilNextVisit}</button>
                <button data-action="disablePage">${this.lang.disableOnThisPage}</button>
                <button data-action="disableSite">${this.lang.disableOnThisWebsite}</button>
            `;
            this.contextMenu.onclick = (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                e.stopPropagation();
                const { action } = button.dataset;
                if (action && callbacks[action]) callbacks[action]();
                this.hide();
            };
            this.contextMenu.style.display = 'block';
            this.contextMenu.style.animation = 'popup-bounce-in 150ms ease-out forwards';
            computePosition(this.element, this.contextMenu, {
                placement: 'bottom',
                middleware: [offset(20), flip(), shift({ padding: 5 })],
            }).then(({ x, y }) => {
                Object.assign(this.contextMenu.style, { left: `${x}px`, top: `${y}px` });
            });
        }

        hideContextMenu() {
            this.contextMenu.style.animation = 'popup-bounce-out 150ms ease-in forwards';
            this.contextMenu.addEventListener('animationend', (e) => {
                if (e.animationName === 'popup-bounce-out') {
                    this.contextMenu.style.display = 'none';
                }
            }, { once: true });
        }
    }

    class Highlighter {
        constructor(initialLang, initialSettings) {
            this.lang = initialLang;
            this.settings = initialSettings || { useDarkText: false };
            this.storage = new HighlightStorage();
            this.annotations = new Map(); // Initialize as empty, will be loaded async
            this.colors = {
                yellow: 'var(--highlighter-color-yellow)', red: 'var(--highlighter-color-red)',
                green: 'var(--highlighter-color-green)', blue: 'var(--highlighter-color-blue)',
                purple: 'var(--highlighter-color-purple)', pink: 'var(--highlighter-color-pink)',
                orange: 'var(--highlighter-color-orange)', grey: 'var(--highlighter-color-grey)',
            };
            this.currentAnnotationType = 'highlight';
            this.menu = new HighlightMenu(this.lang);
            this.shortcutsEnabled = true;
            this.isTemporarilyHidden = false;
            this.isGloballyDisabled = false; // New flag for instant disabling
            this._injectStyles();
            // Load annotations asynchronously
            this.storage.load((loadedAnnotations) => {
                this.annotations = loadedAnnotations;
                this._loadAnnotations();
            });
            this._setupEventListeners();
        }

        disableGlobally() {
            this.isGloballyDisabled = true;
            this.menu.hide();
            // Unwrap all existing marks to make them disappear
            document.querySelectorAll('.highlighter-mark').forEach(el => DOMManager.unwrap(el));
        }

        enableGlobally() {
            this.isGloballyDisabled = false;
            // Reload annotations to make them reappear
            this._loadAnnotations();
        }

        updateSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            this._reapplyAllAnnotationStyles();
        }
    
        _reapplyAllAnnotationStyles() {
            this.annotations.forEach(annotation => {
                document.querySelectorAll(`[data-annotation-id="${annotation.id}"]`).forEach(el => {
                    DOMManager.applyAnnotationStyle(el, annotation, el);
                });
            });
        }

        updateLanguage(newLangCode) {
            if (translations[newLangCode]) {
                this.lang = translations[newLangCode];
                this.menu.updateLanguage(this.lang);
                
                if (this.menu.isVisible()) {
                    if (this.activeAnnotationId) {
                        const element = document.querySelector(`[data-annotation-id="${this.activeAnnotationId}"]`);
                        if(element) this._showContextMenuFor(element);
                    } else if (this.activeRange) {
                        this._showCreationMenu(this.activeRange.getBoundingClientRect());
                    }
                }
            }
        }

        _injectStyles() {
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);
        }

        _setupEventListeners() {
            document.addEventListener('mouseup', this._onMouseUp.bind(this));
            document.addEventListener('mousedown', this._onMouseDown.bind(this), true);
            document.addEventListener('keydown', this._onKeyDown.bind(this));
            document.addEventListener('focusin', this._onFocusChange.bind(this));
            document.addEventListener('focusout', this._onFocusChange.bind(this));
        }

        _onFocusChange(event) {
            const target = event.target;
            this.shortcutsEnabled = !(target.isContentEditable || target.matches('input, textarea, select'));
        }

        _onKeyDown(event) {
            if (this.isGloballyDisabled || !this.shortcutsEnabled || this.isTemporarilyHidden) return;
            if (event.key === 'Escape') {
                if (this.activeAnnotationId) {
                    this.menu.hide();
                    this.activeAnnotationId = null;
                } else {
                    window.getSelection()?.removeAllRanges();
                    this.menu.hide();
                    this.activeRange = null;
                }
            }
            if (event.key === 'Delete' && this.activeAnnotationId) {
                this.deleteAnnotation();
            }
        }

        _onMouseDown(event) {
            if (this.isGloballyDisabled || this.isTemporarilyHidden) return;
            const target = event.target;
            if (target.closest('.highlighter-menu, .highlighter-close-btn, .highlighter-context-menu')) return;
            const annotationEl = target.closest('.highlighter-mark');
            if (annotationEl) {
                event.preventDefault();
                event.stopPropagation();
                this._showContextMenuFor(annotationEl);
            } else {
                this.menu.hide();
            }
        }

        _onMouseUp(event) {
            if (this.isGloballyDisabled || this.isTemporarilyHidden || event.target.closest('.highlighter-menu, .highlighter-mark, .highlighter-close-btn, .highlighter-context-menu')) return;
            setTimeout(() => {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
                let range = selection.getRangeAt(0);
                if (range.toString().trim().length === 0) return;

                if (range.endOffset === 0 && range.endContainer.nodeType === Node.ELEMENT_NODE) {
                    const previousSibling = range.endContainer.previousSibling;
                    if (previousSibling) {
                        range.setEnd(previousSibling, previousSibling.nodeType === Node.TEXT_NODE ? previousSibling.length : previousSibling.childNodes.length);
                    }
                }
                
                this.activeRange = range;
                this._showCreationMenu(range.getBoundingClientRect());
            }, 10);
        }

        _showCreationMenu(rect) {
            this.menu.configure({
                callbacks: {
                    create: (color) => this.createAnnotation(color, this.currentAnnotationType),
                    setType: (type, button) => {
                        this.currentAnnotationType = type;
                        button.parentElement.querySelectorAll('.highlighter-type-selector').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                    },
                },
                buttons: {
                    colors: Object.entries(this.colors).map(([name, color]) => ({
                        action: 'create', value: color, label: this.lang.colors[name] || name, className: 'highlighter-color-selector', content: `<div style="width:100%; height:100%; background-color:${color}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'setType', value: 'highlight', label: this.lang.highlight, content: 'A', className: `highlighter-type-selector ${this.currentAnnotationType === 'highlight' ? 'active' : ''}` },
                        { action: 'setType', value: 'underline', label: this.lang.underline, content: '<span class="underline">A</span>', className: `highlighter-type-selector ${this.currentAnnotationType === 'underline' ? 'active' : ''}` }
                    ]
                },
                showWarning: !this.shortcutsEnabled
            });
            this.menu.show({ getBoundingClientRect: () => rect }, this._getContextMenuCallbacks());
        }

        _showContextMenuFor(element) {
            this.activeAnnotationId = element.dataset.annotationId;
            const annotation = this.annotations.get(this.activeAnnotationId);
            this.menu.configure({
                callbacks: {
                    changeColor: (color) => this.updateAnnotation({ color }),
                    changeType: (type) => this.updateAnnotation({ type }),
                    delete: () => this.deleteAnnotation(),
                },
                buttons: {
                    colors: Object.entries(this.colors).map(([name, color]) => ({
                        action: 'changeColor', value: color, label: this.lang.colors[name] || name, className: `highlighter-color-selector ${annotation.color === color ? 'active' : ''}`, content: `<div style="width:100%; height:100%; background-color:${color}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'changeType', value: 'highlight', label: this.lang.highlight, content: 'A', className: `highlighter-type-selector ${annotation.type === 'highlight' ? 'active' : ''}` },
                        { action: 'changeType', value: 'underline', label: this.lang.underline, content: '<span class="underline">A</span>', className: `highlighter-type-selector ${annotation.type === 'underline' ? 'active' : ''}` }
                    ],
                    actions: [{ action: 'delete', label: this.lang.delete, content: this.lang.delete, className: 'highlighter-delete-btn' }]
                },
                showWarning: !this.shortcutsEnabled
            });
            this.menu.show(element, this._getContextMenuCallbacks());
        }

        _getContextMenuCallbacks() {
            return {
                hide: () => this.hideTemporarily(),
                disablePage: () => this.disableForPage(),
                disableSite: () => this.disableForSite(),
            };
        }

        hideTemporarily() {
            this.isTemporarilyHidden = true;
            this.menu.hide();
        }

        disableForPage() {
            const href = window.location.href;
            chrome.storage.sync.get({ disabledPages: [] }, (data) => {
                const disabledPages = data.disabledPages;
                if (!disabledPages.includes(href)) {
                    disabledPages.push(href);
                    chrome.storage.sync.set({ disabledPages }, () => {
                        window.location.reload();
                    });
                }
            });
        }

        disableForSite() {
            const hostname = window.location.hostname;
            chrome.storage.sync.get({ disabledSites: [] }, (data) => {
                const disabledSites = data.disabledSites;
                if (!disabledSites.includes(hostname)) {
                    disabledSites.push(hostname);
                    chrome.storage.sync.set({ disabledSites }, () => {
                        window.location.reload();
                    });
                }
            });
        }

        _loadAnnotations() {
            this.annotations.forEach(annotation => {
                const range = DOMManager.getRangeFromPointers(annotation.pointers);
                if (range) DOMManager.wrapRange(range, annotation);
            });
            this._notifySidebarOfUpdate(); // Notify sidebar on initial load
        }

        _notifySidebarOfUpdate() {
            this.storage.load((annotations) => {
                const sortedAnnotations = Array.from(annotations.entries()).sort(([, a], [, b]) => {
                    const elementA = document.querySelector(`[data-annotation-id="${a.id}"]`);
                    const elementB = document.querySelector(`[data-annotation-id="${b.id}"]`);
                    if (!elementA || !elementB) return 0;
                    const position = elementA.compareDocumentPosition(elementB);
                    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                    return 0;
                });
                chrome.runtime.sendMessage({ action: 'annotationsUpdated', data: sortedAnnotations });
            });
        }

        createAnnotation(color, type) {
            if (!this.activeRange) return;
            const id = this.storage.generateId();
            const pointers = DOMManager.getRangePointers(this.activeRange);
            const text = DOMManager.getSanitizedHtmlFromRange(this.activeRange);
            const annotation = { id, color, type, pointers, text, comment: '' };
            const marks = DOMManager.wrapRange(this.activeRange, annotation);
            
            if (marks.length > 0) {
                this.annotations.set(id, annotation);
                this.storage.save(this.annotations, () => {
                    this._notifySidebarOfUpdate();
                });
            }

            window.getSelection()?.removeAllRanges();
            this.menu.hide();
            this.activeRange = null;
        }

        updateAnnotation(updates) {
            const id = this.activeAnnotationId;
            if (!id) return;
            const annotation = this.annotations.get(id);
            if (!annotation) return;
            Object.assign(annotation, updates);
            document.querySelectorAll(`[data-annotation-id="${id}"]`).forEach(el => {
                DOMManager.applyAnnotationStyle(el, annotation, null);
                if (annotation.type === 'highlight' && el.getElementsByTagName('a').length > 0) {
                    el.style.color = 'inherit';
                }
            });
            this.annotations.set(id, annotation);
            this.storage.save(this.annotations, () => {
                this._notifySidebarOfUpdate();
            });
            this.menu.hide();
            this.activeAnnotationId = null;
        }

        deleteAnnotation(idToDelete) {
            const id = idToDelete || this.activeAnnotationId;
            if (!id) return;

            document.querySelectorAll(`[data-annotation-id="${id}"]`).forEach(el => DOMManager.unwrap(el));
            
            const deleted = this.annotations.delete(id);

            if (deleted) {
                this.storage.save(this.annotations, () => {
                    this._notifySidebarOfUpdate();
                });
            }

            if (id === this.activeAnnotationId) {
                this.menu.hide();
                this.activeAnnotationId = null;
            }
        }

        scrollToAnnotation(id) {
            const elements = document.querySelectorAll(`.highlighter-mark[data-annotation-id="${id}"]`);
            const element = elements.length > 0 ? elements[0] : null;

            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                elements.forEach(el => {
                    el.style.transition = 'background-color 150ms ease-in-out, color 150ms ease-in-out';
                    el.style.backgroundColor = '#90caf9';
                    el.style.color = '#1a1a1a';
                });

                setTimeout(() => {
                    const annotation = this.annotations.get(id);
                    if (annotation) {
                        elements.forEach(el => {
                            el.style.transition = ''; // Reset transition
                            DOMManager.applyAnnotationStyle(el, annotation, null);
                        });
                    }
                }, 1200);
            }
        }
    }

    

    function initializeHighlighter() {
        chrome.storage.sync.get(['highlighter-settings'], (data) => {
            const defaultSettings = {
                language: navigator.language.split('-')[0] || 'en',
                useDarkText: false
            };
            const settings = { ...defaultSettings, ...data['highlighter-settings'] };

            // The 'translations' object is now available globally from i18n.js
            let userLang = settings.language;
            if (!translations[userLang]) userLang = 'en';
            const lang = translations[userLang];

            const start = () => {
                if (window.highlighterInstance) return; // Already initialized
                window.highlighterInstance = new Highlighter(lang, settings);
                // Re-apply styles after initialization to ensure settings are respected
                window.highlighterInstance._reapplyAllAnnotationStyles();
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', start);
            } else {
                start();
            }
        });
    }

    // Check if the site or page is disabled before initializing.
    chrome.storage.sync.get(['disabledSites', 'disabledPages'], (data) => {
        const disabledSites = data.disabledSites || [];
        const disabledPages = data.disabledPages || [];
        if (disabledSites.includes(window.location.hostname) || disabledPages.includes(window.location.href)) {
            console.log('Quantum Highlighter: Disabled on this site or page.');
            return;
        }
        initializeHighlighter();
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const { action, annotationId, language, width, settings } = request;

        if (action === 'toggleSidebar') {
            toggleSidebar();
        } else if (action === 'getAnnotations') {
            if (window.highlighterInstance) {
                window.highlighterInstance.storage.load((annotations) => {
                    const sortedAnnotations = Array.from(annotations.entries()).sort(([, a], [, b]) => {
                        const elementA = document.querySelector(`[data-annotation-id="${a.id}"]`);
                        const elementB = document.querySelector(`[data-annotation-id="${b.id}"]`);
                        if (!elementA || !elementB) return 0;
                        const position = elementA.compareDocumentPosition(elementB);
                        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                        return 0;
                    });
                    sendResponse({ data: sortedAnnotations });
                });
            } else {
                sendResponse({ data: [] });
            }
            return true; // Async response
        } else if (action === 'scrollToAnnotation' && annotationId) {
            window.highlighterInstance?.scrollToAnnotation(annotationId);
        } else if (action === 'deleteAnnotation' && annotationId) {
            window.highlighterInstance?.deleteAnnotation(annotationId);
        } else if (action === 'languageChanged' && language) {
            window.highlighterInstance?.updateLanguage(language);
        } else if (action === 'settingChanged' && settings) {
            window.highlighterInstance?.updateSettings(settings);
        } else if (action === 'toggleActivation') {
            if (request.disabled) {
                window.highlighterInstance?.disableGlobally();
            } else {
                window.highlighterInstance?.enableGlobally();
            }
        } else if (action === 'startSidebarResize') {
            startSidebarResize();
        } else if (action === 'getSidebarWidth') {
            const sidebar = document.getElementById(SIDEBAR_ID);
            sendResponse({ width: sidebar ? sidebar.offsetWidth : 420 });
            return true; // Async response
        } else if (action === 'setSidebarWidth' && width) {
            const sidebar = document.getElementById(SIDEBAR_ID);
            if (sidebar) {
                const newWidth = Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH));
                sidebar.style.width = `${newWidth}px`;
                document.body.style.marginRight = `${newWidth}px`;
            }
        }
        // Return true for async responses, otherwise the channel might close.
        return ["getAnnotations", "getSidebarWidth"].includes(action);
    });
})();