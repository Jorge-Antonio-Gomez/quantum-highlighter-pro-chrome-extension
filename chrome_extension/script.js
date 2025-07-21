
(function () {
    'use strict';

    // --- TIPTAP EDITOR FUNCTIONS ---
    let tiptapEditor = null; // A single instance for the context menu editor

    function applyMarkWithTrim(editor, markName) {
        const { state } = editor;
        const { from, to, empty } = state.selection;
        const commandName = `toggle${markName.charAt(0).toUpperCase() + markName.slice(1)}`;

        if (empty) {
            editor.chain().focus()[commandName]().run();
            return;
        }
        const selectedText = state.doc.textBetween(from, to);
        const leadingSpaces = selectedText.match(/^\s*/)[0].length;
        const trailingSpaces = selectedText.match(/\s*$/)[0].length;
        const newFrom = from + leadingSpaces;
        const newTo = to - trailingSpaces;
        if (newFrom >= newTo) return;
        editor.chain().focus().setTextSelection({ from: newFrom, to: newTo })[commandName]().setTextSelection({ from: from, to: to }).run();
    };

    function handleToolbarClick(action, editor) {
        switch (action) {
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strike':
                applyMarkWithTrim(editor, action);
                break;
            case 'h1':
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                break;
            case 'h2':
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                break;
            case 'h3':
                editor.chain().focus().toggleHeading({ level: 3 }).run();
                break;
            case 'link':
                if (editor.isActive('link')) {
                    editor.chain().focus().unsetLink().run();
                    return;
                }
                const previousUrl = editor.getAttributes('link').href || '';
                const url = window.prompt('URL', previousUrl);
                if (url === null) return;
                if (url === '') {
                    editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    return;
                }
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                break;
        }
    }

    function updateToolbar(editor, toolbarContainer) {
        if (!toolbarContainer) return;
        const buttons = toolbarContainer.querySelectorAll('button');
        buttons.forEach(button => {
            const action = button.dataset.action;
            let isActive = false;
            switch (action) {
                case 'bold':
                case 'italic':
                case 'strike':
                case 'underline':
                case 'link':
                    isActive = editor.isActive(action);
                    break;
                case 'h1':
                    isActive = editor.isActive('heading', { level: 1 });
                    break;
                case 'h2':
                    isActive = editor.isActive('heading', { level: 2 });
                    break;
                case 'h3':
                    isActive = editor.isActive('heading', { level: 3 });
                    break;
            }
            button.classList.toggle('is-active', isActive);
        });
    }

    function buildToolbar(toolbarContainer, editor) {
        toolbarContainer.innerHTML = `
            <button data-action="bold" title="Bold">B</button>
            <button data-action="italic" title="Italic">I</button>
            <button data-action="underline" title="Underline">U</button>
            <button data-action="strike" title="Strikethrough">S</button>
            <button data-action="link" title="Link">🔗</button>
            <button data-action="h1" title="Heading 1">H1</button>
            <button data-action="h2" title="Heading 2">H2</button>
            <button data-action="h3" title="Heading 3">H3</button>
        `;

        toolbarContainer.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = e.currentTarget.dataset.action;
                handleToolbarClick(action, editor);
            });
        });
    }

    function setupTiptapEditor(element, toolbarContainer, content, onUpdate) {
        const { Editor } = Tiptap;
        const StarterKit = window.TiptapStarterKit;
        const Underline = window.TiptapUnderline;
        const Link = window.TiptapLink;

        const editor = new Editor({
            element: element,
            extensions: [
                window.Tiptap.StarterKit.configure({
                    // Configure the Link extension directly within the StarterKit
                    link: {
                        openOnClick: false,
                    },
                }),
                // Underline is already included in StarterKit, so no need to add it again.
                // window.Tiptap.Highlight.configure({ multicolor: true }), // ERROR: Highlight is not included in the custom tiptap.js bundle. You must rebuild it and include @tiptap/extension-highlight
            ],
            content: content,
            autofocus: 'end',
            editable: true,
            onUpdate: ({ editor }) => {
                updateToolbar(editor, toolbarContainer);
                if (onUpdate) {
                    onUpdate(editor.getHTML());
                }
            },
            onSelectionUpdate: ({ editor }) => {
                updateToolbar(editor, toolbarContainer);
            }
        });

        buildToolbar(toolbarContainer, editor);
        updateToolbar(editor, toolbarContainer);

        return editor;
    }


    const SIDEBAR_ID = 'highlighter-sidebar-instance';
    const RESIZE_COVER_ID = 'highlighter-resize-cover';
    const RESIZE_GUIDE_ID = 'highlighter-resize-guide';
    const MIN_WIDTH = 380;
    const MAX_WIDTH = 1000;

    function debounce(func, wait) {
        let timeout;
        const debounced = function(...args) {
            const context = this;
            const later = () => {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
        debounced.cancel = function() {
            clearTimeout(timeout);
        };
        return debounced;
    }

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
                sidebar.style.width = `${initialWidth}px`;
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
                document.body.appendChild(cover);
            }

            let guide = document.getElementById(RESIZE_GUIDE_ID);
            if (!guide) {
                guide = document.createElement('div');
                guide.id = RESIZE_GUIDE_ID;
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

            // Set base style based on annotation type
            if (annotation.type === 'highlight') {
                element.style.backgroundColor = colorWithOpacity;
                element.style.borderBottom = 'none';
            } else { // underline
                element.style.backgroundColor = 'transparent';
                element.style.borderBottom = `2px solid ${colorWithOpacity}`;
            }

            const linksInElement = element.getElementsByTagName('a');

            if (settings.useDarkText) {
                // Force all text, including links, to be dark.
                element.style.setProperty('color', '#1a1a1a', 'important');
                for (const link of linksInElement) {
                    // Force the link to inherit the color from its parent (<mark>)
                    link.style.setProperty('color', 'inherit', 'important');
                }
            } else {
                // Restore default behavior and apply user's visibility logic.
                // Remove our overrides first.
                element.style.removeProperty('color');
                for (const link of linksInElement) {
                    link.style.removeProperty('color');
                }

                // Now apply the original logic for the non-dark-text mode.
                const isLink = (nodeContext && nodeContext.nodeType === Node.TEXT_NODE ? nodeContext.parentNode.closest('a') : (nodeContext ? nodeContext.closest('a') : element.closest('a'))) || element.querySelector('a');

                if (isLink) {
                    // Let links be links. Setting color to inherit on the mark is enough.
                    element.style.color = 'inherit';
                } else if (annotation.type === 'highlight') {
                    // User's visibility feature for regular text.
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

        static trimRange(range) {
            let { startContainer, startOffset, endContainer, endOffset } = range;
            
            // Trim start
            while (startContainer.nodeType === Node.TEXT_NODE && startOffset < startContainer.length && /\s/.test(startContainer.data[startOffset])) {
                startOffset++;
            }
            if (startContainer.nodeType === Node.TEXT_NODE && startOffset === startContainer.length) {
                // This logic could be expanded to jump to the next non-empty text node
            }

            // Trim end
            while (endContainer.nodeType === Node.TEXT_NODE && endOffset > 0 && /\s/.test(endContainer.data[endOffset - 1])) {
                endOffset--;
            }
            if (endContainer.nodeType === Node.TEXT_NODE && endOffset === 0) {
                // This logic could be expanded to jump to the previous non-empty text node
            }

            const newRange = document.createRange();
            newRange.setStart(startContainer, startOffset);
            newRange.setEnd(endContainer, endOffset);
            
            return newRange;
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

            this.resizeObserver = new ResizeObserver(() => {
                if (this.isVisible()) {
                    this.updateCloseButtonPosition();
                }
            });
        }

        updateCloseButtonPosition() {
            computePosition(this.element, this.closeButton, {
                placement: 'bottom-end',
                middleware: [offset(1.5)],
            }).then(({ x, y }) => {
                Object.assign(this.closeButton.style, { left: `${x}px`, top: `${y}px` });
            });
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
            let commentBoxHTML = config.commentBox ? config.commentBox.html : '';
        
            this.element.innerHTML = `<div id="highlighter-arrow"></div>${colorsHTML}${typesHTML}${actionsHTML}${commentBoxHTML}`;
            this.arrowElement = this.element.querySelector('#highlighter-arrow');
        
            this.element.onclick = (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                 if (!button.closest('.tiptap-toolbar')) {
                    e.stopPropagation();
                }
                const { action, value } = button.dataset;
                if (action && config.callbacks[action]) {
                    config.callbacks[action](value, button);
                }
            };
        
            if (config.commentBox) {
                const commentBoxWrapper = this.element.querySelector('.highlighter-comment-box');
                if (commentBoxWrapper) {
                    commentBoxWrapper.addEventListener('click', e => e.stopPropagation());
                }

                if (config.callbacks.onCommentBoxReady) {
                    setTimeout(() => config.callbacks.onCommentBoxReady(), 0);
                }
            }
        }

        _createButtons(buttons) {
            return buttons.map(btn => `<button title="${btn.label}" data-action="${btn.action}" ${btn.value ? `data-value="${btn.value}"` : ''} class="${btn.className || ''}">${btn.content || ''}</button>`).join('');
        }

        async show(referenceEl, contextMenuCallbacks) {
            this.hideContextMenu();
            this.element.classList.remove('closing');
            this.element.style.animation = 'popup-bounce-in 150ms ease-out forwards';
            this.element.classList.add('show');
            
            this.resizeObserver.observe(this.element);

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
                    this.updateCloseButtonPosition();
                    this.closeButton.classList.add('show');
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
            return new Promise(resolve => {
                if (!this.element.classList.contains('show')) {
                    return resolve();
                }

                this.resizeObserver.disconnect();

                this.element.style.animation = 'popup-bounce-out 150ms ease-in forwards';
                this.element.classList.add('closing');
                
                this.element.addEventListener('animationend', (e) => {
                    if (e.animationName === 'popup-bounce-out') {
                        this.element.classList.remove('show');
                        this.closeButton.classList.remove('show');
                        this.hideContextMenu();
                        resolve();
                    }
                }, { once: true });
            });
        }

        showContextMenu(callbacks) {
            const sidebarOpen = document.getElementById(SIDEBAR_ID);
            const toggleSidebarText = sidebarOpen ? this.lang.closeSidebar : this.lang.openSidebar;

            this.contextMenu.innerHTML = `
                <button data-action="hide">${this.lang.hideUntilNextVisit}</button>
                <button data-action="disablePage">${this.lang.disableOnThisPage}</button>
                <button data-action="disableSite">${this.lang.disableOnThisWebsite}</button>
                <button data-action="toggleSidebar">${toggleSidebarText}</button>
            `;
            this.contextMenu.onclick = (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                e.stopPropagation();
                const { action } = button.dataset;
                if (action && callbacks[action]) {
                    callbacks[action]();
                }
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
            this.activeDebouncedUpdate = null;
            this.tiptapEditor = null;
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

        _setupEventListeners() {
            document.addEventListener('mouseup', this._onMouseUp.bind(this));
            document.addEventListener('mousedown', this._onMouseDown.bind(this), true);
            document.addEventListener('keydown', this._onKeyDown.bind(this));
            document.addEventListener('focusin', this._onFocusChange.bind(this));
            document.addEventListener('focusout', this._onFocusChange.bind(this));
        }

        _onFocusChange(event) {
            const target = event.target;
            if (target.closest('.highlighter-menu')) {
                return;
            }
            this.shortcutsEnabled = !(target.isContentEditable || target.matches('input, textarea, select'));
        }

        _onKeyDown(event) {
            if (this.isGloballyDisabled || !this.shortcutsEnabled || this.isTemporarilyHidden) return;
            if (event.key === 'Escape') {
                if (this.activeAnnotationId) {
                    this._closeOrFinalizeContextMenu();
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
                if (this.activeAnnotationId && this.activeAnnotationId !== annotationEl.dataset.annotationId) {
                    this._closeOrFinalizeContextMenu();
                }
                this._showContextMenuFor(annotationEl);
            } else {
                this._closeOrFinalizeContextMenu();
            }
        }

        _onMouseUp(event) {
            if (this.isGloballyDisabled || !this.shortcutsEnabled || this.isTemporarilyHidden || event.target.closest('.highlighter-menu, .highlighter-mark, .highlighter-close-btn, .highlighter-context-menu')) return;
            setTimeout(() => {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
                
                let range = selection.getRangeAt(0);
                let trimmedRange = DOMManager.trimRange(range);

                if (trimmedRange.collapsed) return;

                if (range.endOffset === 0 && range.endContainer.nodeType === Node.ELEMENT_NODE) {
                    const previousSibling = range.endContainer.previousSibling;
                    if (previousSibling) {
                        trimmedRange.setEnd(previousSibling, previousSibling.nodeType === Node.TEXT_NODE ? previousSibling.length : previousSibling.childNodes.length);
                    }
                }
                
                this.activeRange = trimmedRange;
                this._showCreationMenu(trimmedRange.getBoundingClientRect());
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
                }
            });
            this.menu.show({ getBoundingClientRect: () => rect }, this._getContextMenuCallbacks());
        }

        _showContextMenuFor(element) {
            this.activeAnnotationId = element.dataset.annotationId;
            const annotation = this.annotations.get(this.activeAnnotationId);

            if (!annotation) {
                console.warn(`Highlighter: Annotation with ID "${this.activeAnnotationId}" not found.`);
                return;
            }
        
            if (this.activeDebouncedUpdate) {
                this.activeDebouncedUpdate.cancel();
            }
        
            this.activeDebouncedUpdate = debounce((commentHTML) => {
                this.updateAnnotation({ comment: commentHTML }, this.activeAnnotationId, true);
            }, 500);
        
            const commentBoxId = `comment-box-${this.activeAnnotationId}`;
            const editorElementId = `tiptap-editor-${this.activeAnnotationId}`;
            const toolbarElementId = `tiptap-toolbar-${this.activeAnnotationId}`;

            const commentBoxHTML = `
                <div id="${commentBoxId}" class="highlighter-comment-box">
                    <div id="${toolbarElementId}" class="tiptap-toolbar"></div>
                    <div id="${editorElementId}" class="tiptap-editor"></div>
                </div>
            `;
        
            this.menu.configure({
                callbacks: {
                    changeColor: (color) => this.updateAnnotation({ color }),
                    changeType: (type) => this.updateAnnotation({ type }),
                    delete: () => this.deleteAnnotation(),
                    onCommentBoxReady: () => {
                        const editorElement = document.getElementById(editorElementId);
                        const toolbarElement = document.getElementById(toolbarElementId);
                        if (editorElement && toolbarElement && !this.tiptapEditor) {
                            this.tiptapEditor = setupTiptapEditor(
                                editorElement, 
                                toolbarElement, 
                                annotation.comment || '', 
                                (html) => {
                                    this.activeDebouncedUpdate(html);
                                }
                            );
                        }
                    }
                },
                buttons: {
                    colors: Object.entries(this.colors).map(([name, color]) => ({
                        action: 'changeColor', value: color, label: this.lang.colors[name] || name, className: `highlighter-color-selector ${annotation.color === color ? 'active' : ''}`, content: `<div style="width:100%; height:100%; background-color:${color}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'changeType', value: 'highlight', label: this.lang.highlight, content: 'A', className: `highlighter-type-selector ${annotation.type === 'highlight' ? 'active' : ''}` },
                        { action: 'changeType', value: 'underline', label: this.lang.underline, content: '<span class="underline">A</span>', className: `highlighter-type-selector ${annotation.type === 'underline' ? 'active' : ''}` }
                    ],
                    actions: [
                        { action: 'delete', label: this.lang.delete, content: this.lang.delete, className: 'highlighter-delete-btn' }
                    ]
                },
                commentBox: {
                    html: commentBoxHTML,
                }
            });
            this.menu.show(element, this._getContextMenuCallbacks());
        }

        _closeOrFinalizeContextMenu() {
            if (!this.activeAnnotationId) {
                this.menu.hide();
                return;
            }
        
            if (this.activeDebouncedUpdate) {
                this.activeDebouncedUpdate.cancel();
                this.activeDebouncedUpdate = null;
            }
        
            const annotation = this.annotations.get(this.activeAnnotationId);
        
            if (annotation && this.tiptapEditor) {
                const sanitizedComment = this.tiptapEditor.getHTML();
                if (annotation.comment !== sanitizedComment) {
                    this.updateAnnotation({ comment: sanitizedComment }, this.activeAnnotationId, false);
                }
            }
            
            if (this.tiptapEditor) {
                this.tiptapEditor.destroy();
                this.tiptapEditor = null;
            }
        
            this.menu.hide();
            this.activeAnnotationId = null;
        }

        _getContextMenuCallbacks() {
            return {
                hide: () => this.hideTemporarily(),
                disablePage: () => this.disableForPage(),
                disableSite: () => this.disableForSite(),
                toggleSidebar: async () => {
                    window.getSelection()?.removeAllRanges();
                    await this.menu.hide();
                    toggleSidebar();
                },
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

        updateAnnotation(updates, idToUpdate, keepMenuOpen = false) {
            const id = idToUpdate || this.activeAnnotationId;
            if (!id) return;
            const annotation = this.annotations.get(id);
            if (!annotation) return;
            Object.assign(annotation, updates);
            document.querySelectorAll(`[data-annotation-id="${id}"]`).forEach(el => {
                DOMManager.applyAnnotationStyle(el, annotation, el);
            });
            this.annotations.set(id, annotation);
            this.storage.save(this.annotations, () => {
                this._notifySidebarOfUpdate();
            });
        
            if (!keepMenuOpen) {
                this._closeOrFinalizeContextMenu();
            }
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
                this._closeOrFinalizeContextMenu();
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
        } else if (action === 'getPageInfo') {
            const title = document.title;
            const description = document.querySelector('meta[name="description"]')?.content || '';
            const image = document.querySelector('meta[property="og:image"]')?.content || '';
            let favicon = document.querySelector('link[rel="shortcut icon"]')?.href || document.querySelector('link[rel="icon"]')?.href;
            const domain = window.location.hostname;
            
            // Resolve relative favicon URL
            if (favicon && !favicon.startsWith('http')) {
                favicon = new URL(favicon, window.location.href).href;
            }

            sendResponse({ title, description, image, favicon, domain });
            return true;
        } else if (action === 'scrollToAnnotation' && annotationId) {
            window.highlighterInstance?.scrollToAnnotation(annotationId);
        } else if (action === 'deleteAnnotation' && annotationId) {
            window.highlighterInstance?.deleteAnnotation(annotationId);
        } else if (action === 'updateAnnotation' && annotationId) {
            window.highlighterInstance?.updateAnnotation(request.updates, annotationId);
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
        return ["getAnnotations", "getSidebarWidth", "getPageInfo"].includes(action);
    });
})();
