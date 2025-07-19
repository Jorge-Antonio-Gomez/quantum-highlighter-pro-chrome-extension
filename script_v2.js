// ==UserScript==
// @name         Quantum Highlighter WEB
// @namespace    http://tampermonkey.net/
// @version      18.07.2025.13
// @description  Web annotation system inspired by Zotero. Highlight, underline, and manage annotations on any page.
// @description:es Sistema de anotaciones web inspirado en Zotero. Resalta, subraya y gestiona anotaciones en cualquier página.
// @description:fr Système d'annotation web inspiré de Zotero. Surlignez, soulignez et gérez les annotations sur n'importe quelle page.
// @description:pt Sistema de anotações web inspirado no Zotero. Destaque, sublinhe e gerencie anotações em qualquer página.
// @description:ru Система веб-аннотаций, вдохновленная Zotero. Выделяйте, подчеркивайте и управляйте аннотациями на любой странице.
// @description:zh 受 Zotero 启发的网页注释系统。在任何页面上突出显示、加下划线和管理注释。
// @author       George
// @match        *://*/*
// @grant        GM_addStyle
// @require      https://unpkg.com/@floating-ui/core@1.6.2
// @require      https://unpkg.com/@floating-ui/dom@1.6.5
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- LANGUAGE SELECTION ---
    // Supported languages: 'en', 'es', 'fr', 'pt', 'ru', 'zh'
    const preferredLanguage = 'es';

    // --- i18n STRINGS ---
    const i18n = {
        en: {
            shortcutsDisabled: "Shortcuts disabled in text field",
            delete: "Delete",
            highlight: "Highlight",
            underline: "Underline",
            colors: { yellow: "Yellow", red: "Red", green: "Green", blue: "Blue", purple: "Purple", pink: "Pink", orange: "Orange", grey: "Grey" }
        },
        es: {
            shortcutsDisabled: "Atajos de teclado desactivados en este campo",
            delete: "Borrar",
            highlight: "Resaltar",
            underline: "Subrayar",
            colors: { yellow: "Amarillo", red: "Rojo", green: "Verde", blue: "Azul", purple: "Morado", pink: "Rosa", orange: "Naranja", grey: "Gris" }
        },
        fr: {
            shortcutsDisabled: "Les raccourcis sont désactivés dans ce champ de texte",
            delete: "Supprimer",
            highlight: "Surligner",
            underline: "Souligner",
            colors: { yellow: "Jaune", red: "Rouge", green: "Vert", blue: "Bleu", purple: "Violet", pink: "Rose", orange: "Orange", grey: "Gris" }
        },
        pt: {
            shortcutsDisabled: "Os atalhos estão desativados neste campo de texto",
            delete: "Excluir",
            highlight: "Destacar",
            underline: "Sublinhar",
            colors: { yellow: "Amarelo", red: "Vermelho", green: "Verde", blue: "Azul", purple: "Roxo", pink: "Rosa", orange: "Laranja", grey: "Cinza" }
        },
        ru: {
            shortcutsDisabled: "Горячие клавиши отключены в этом текстовом поле",
            delete: "Удалить",
            highlight: "Выделить цветом",
            underline: "Подчеркнуть",
            colors: { yellow: "Желтый", red: "Красный", green: "Зеленый", blue: "Синий", purple: "Фиолетовый", pink: "Розовый", orange: "Оранжевый", grey: "Серый" }
        },
        zh: {
            shortcutsDisabled: "文本框内快捷键已禁用",
            delete: "删除",
            highlight: "高亮",
            underline: "下划线",
            colors: { yellow: "黄色", red: "红色", green: "绿色", blue: "蓝色", purple: "紫色", pink: "粉色", orange: "橙色", grey: "灰色" }
        }
    };

    const lang = i18n[preferredLanguage] || i18n.en;


    const {computePosition, offset, flip, shift, arrow} = FloatingUIDOM;

    // --- STYLES ---
    const styles = `
        :root {
            --highlighter-z-index: 10001;
            --highlighter-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            --highlighter-radius: 8px;
            --highlighter-transition: all 0.15s ease-in-out;
            /* Colors from diseño.jpg */
            --highlighter-color-yellow: #FDEE87;
            --highlighter-color-red: #FF9A9A;
            --highlighter-color-green: #A8E6A8;
            --highlighter-color-blue: #A8D1E6;
            --highlighter-color-purple: #D1A8E6;
            --highlighter-color-pink: #E6A8D1;
            --highlighter-color-orange: #F9C9A1;
            --highlighter-color-grey: #D8D8D8;
        }

        .highlighter-mark {
            cursor: pointer;
            transition: var(--highlighter-transition);
            background-color: transparent;
        }

        .highlighter-mark:hover {
            opacity: 1;
        }

        .highlighter-menu {
            position: absolute;
            display: none;
            flex-direction: column;
            gap: 4px;
            background: white;
            border-radius: var(--highlighter-radius);
            box-shadow: var(--highlighter-shadow);
            z-index: var(--highlighter-z-index);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 6px;
            transition: opacity 0.1s ease-in-out;
            width: auto; /* Let content define the width */
            transform: scale(0.9);
            transform-origin: top center;
        }
        
        .highlighter-menu.show { display: flex; }

        #highlighter-arrow {
            position: absolute;
            background: white;
            width: 8px;
            height: 8px;
            transform: rotate(45deg);
        }

        .highlighter-menu .menu-row {
            display: flex;
            gap: 5px;
            justify-content: center;
            align-items: center;
        }
        
        .highlighter-menu .menu-row.types {
            background-color: #f0f0f0;
            padding: 3px;
            border-radius: 6px;
        }

        .highlighter-menu button {
            background: none;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: var(--highlighter-transition);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .highlighter-color-selector {
            width: 22px;
            height: 22px;
            border: 1px solid rgba(0,0,0,0.1);
            padding: 0;
            flex-shrink: 0;
        }
        
        .highlighter-color-selector.active {
            box-shadow: 0 0 0 3px #57b4dfff;
        }
        
        .highlighter-type-selector {
            flex: 1; /* Fill available space in the .types row */
            height: 25px; /* 90% of 28px */
            font-size: 16px;
            font-weight: bold;
            color: #555;
            background-color: transparent;
        }
        
        .highlighter-type-selector.active {
            background-color: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .highlighter-type-selector .underline {
            text-decoration: underline;
            text-decoration-thickness: 2px;
        }
        
        .highlighter-delete-btn {
            flex: 1; /* Fill the entire row */
            height: 25px; /* 90% of 28px */
            background-color: #f0f0f0;
            color: #333;
        }
        .highlighter-delete-btn:hover {
            background-color: #FFE0E0;
            color: #D8000C;
        }

        .highlighter-shortcut-warning {
            font-size: 11px;
            color: #888;
            text-align: center;
            padding: 4px 0 0 0;
            border-top: 1px solid #f0f0f0;
            margin-top: 4px;
        }
    `;

    // --- DOM UTILITIES ---
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
            const getPointers = (c, o) => ({ xpath: this.getXPathForNode(c.nodeType === 3 ? c.parentNode : c), childIndex: Array.from(c.parentNode.childNodes).indexOf(c), offset: o });
            return { start: getPointers(startContainer, startOffset), end: getPointers(endContainer, endOffset) };
        }

        static getRangeFromPointers({ start, end }) {
            const startNode = this.getNodeFromXPath(start.xpath)?.childNodes[start.childIndex];
            const endNode = this.getNodeFromXPath(end.xpath)?.childNodes[end.childIndex];
            if (!startNode || !endNode) return null;
            const range = document.createRange();

            // Determine the valid maximum offset. For text nodes, it's character length.
            // For element nodes, it's the number of child nodes.
            const startNodeLength = startNode.nodeType === Node.TEXT_NODE ? startNode.length : startNode.childNodes.length;
            const endNodeLength = endNode.nodeType === Node.TEXT_NODE ? endNode.length : endNode.childNodes.length;

            // Clamp the offsets to ensure they are not out of bounds.
            const safeStartOffset = Math.min(start.offset, startNodeLength);
            const safeEndOffset = Math.min(end.offset, endNodeLength);

            try {
                range.setStart(startNode, safeStartOffset);
                range.setEnd(endNode, safeEndOffset);
                return range;
            } catch (e) {
                console.error("Highlighter: Error creating range from pointers even after clamping.", {start, end}, e);
                return null;
            }
        }

        static applyAnnotationStyle(element, annotation) {
            const colorWithOpacity = annotation.color.startsWith('#') ? `${annotation.color}80` : annotation.color;
            element.style.color = 'inherit';
            if (annotation.type === 'highlight') {
                element.style.backgroundColor = colorWithOpacity;
                element.style.borderBottom = 'none';
            } else {
                element.style.backgroundColor = 'transparent';
                element.style.borderBottom = `2px solid ${colorWithOpacity}`;
            }
        }

        static wrapRange(range, annotation) {
            if (range.collapsed) return [];

            // This function is complex because it needs to handle selections that can
            // span across multiple block-level elements (like <p>, <div>, <h1>).
            // The strategy is to iterate through all affected elements and wrap their contents individually.

            const affectedNodes = this.getNodesInRange(range);
            const marks = [];

            affectedNodes.forEach(node => {
                // We only care about text nodes that are not inside a script/style tag.
                if (node.nodeType !== Node.TEXT_NODE || node.parentNode.closest('script, style')) {
                    return;
                }

                const nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);

                // Adjust the range to only cover the intersection with the user's selection.
                if (node === range.startContainer) nodeRange.setStart(node, range.startOffset);
                if (node === range.endContainer) nodeRange.setEnd(node, range.endOffset);

                if (!nodeRange.collapsed) {
                    const mark = document.createElement('mark');
                    mark.className = 'highlighter-mark';
                    mark.dataset.annotationId = annotation.id;
                    this.applyAnnotationStyle(mark, annotation);
                    
                    try {
                        // The safest method that doesn't break the parent element's structure.
                        nodeRange.surroundContents(mark);
                        marks.push(mark);
                    } catch (e) {
                        // This can happen with very complex selections, but the impact is minimal.
                        console.warn("Highlighter: Could not wrap a specific node within the selection.", e);
                    }
                }
            });

            // Clean up the DOM by merging adjacent text nodes.
            if (marks.length > 0) {
                const parent = marks[0].parentNode;
                if(parent) parent.normalize();
            }

            return marks;
        }

        static getNodesInRange(range) {
            const start = range.startContainer;
            const end = range.endContainer;
            const commonAncestor = range.commonAncestorContainer;
            const nodes = [];
            let node;

            // Walk the DOM tree from the start of the range.
            for (node = start; node; node = this.getNextNode(node)) {
                if (commonAncestor.contains(node)) {
                    nodes.push(node);
                }
                if (node === end) break;
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

        static findBlockContainer(node) {
            let current = node;
            while (current) {
                if (current.nodeType === Node.ELEMENT_NODE) {
                    const style = window.getComputedStyle(current).display;
                    if (style !== 'inline' && style !== 'inline-block') {
                        return current; // Found the block-level container
                    }
                }
                current = current.parentNode;
            }
            return document.body; // Fallback
        }

        static unwrap(element) {
            const parent = element.parentNode;
            while (element.firstChild) parent.insertBefore(element.firstChild, element);
            parent.removeChild(element);
            parent.normalize();
        }
    }

    // --- STORAGE ---
    class HighlightStorage {
        constructor() { this.key = `highlighter-annotations-${window.location.hostname}${window.location.pathname}`; }
        generateId() { return `h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
        save(annotations) { try { localStorage.setItem(this.key, JSON.stringify(Array.from(annotations.entries()))); } catch (e) { console.error("Error saving annotations:", e); } }
        load() { try { const d = localStorage.getItem(this.key); return d ? new Map(JSON.parse(d)) : new Map(); } catch (e) { return new Map(); } }
    }

    // --- UI ---
    class HighlightMenu {
        constructor() {
            this.element = document.createElement('div');
            this.element.className = 'highlighter-menu';
            document.body.appendChild(this.element);
            // this.arrowElement will be created and assigned in configure()
            this.arrowElement = null;
        }

        configure(config) {
            const { types, colors, actions } = config.buttons;
            let typesHTML = types ? `<div class="menu-row types">${this._createButtons(types)}</div>` : '';
            let colorsHTML = colors ? `<div class="menu-row colors">${this._createButtons(colors)}</div>` : '';
            let actionsHTML = actions ? `<div class="menu-row actions">${this._createButtons(actions)}</div>` : '';
            let warningHTML = config.showWarning ? `<div class="highlighter-shortcut-warning">${lang.shortcutsDisabled}</div>` : '';

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

        async show(referenceEl) {
            this.element.classList.add('show');

            const {x, y, placement, middlewareData} = await computePosition(referenceEl, this.element, {
                placement: 'bottom',
                middleware: [offset(12), flip(), shift({padding: 10}), arrow({element: this.arrowElement})],
            });

            Object.assign(this.element.style, {
                left: `${x}px`,
                top: `${y}px`,
            });

            const {x: arrowX, y: arrowY} = middlewareData.arrow;

            const staticSide = {
                top: 'bottom',
                right: 'left',
                bottom: 'top',
                left: 'right',
            }[placement.split('-')[0]];

            Object.assign(this.arrowElement.style, {
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                right: '',
                bottom: '',
                [staticSide]: '-4px',
            });
        }

        hide() { this.element.classList.remove('show'); }
    }

    // --- MAIN SYSTEM ---
    class Highlighter {
        constructor() {
            this.storage = new HighlightStorage();
            this.annotations = this.storage.load();
            this.colors = {
                yellow: 'var(--highlighter-color-yellow)', red: 'var(--highlighter-color-red)',
                green: 'var(--highlighter-color-green)', blue: 'var(--highlighter-color-blue)',
                purple: 'var(--highlighter-color-purple)', pink: 'var(--highlighter-color-pink)',
                orange: 'var(--highlighter-color-orange)', grey: 'var(--highlighter-color-grey)',
            };
            this.currentAnnotationType = 'highlight';
            this.menu = new HighlightMenu();
            this.deleteIcon = lang.delete;
            this.shortcutsEnabled = true; // By default, shortcuts are on
            this._injectStyles();
            this._loadAnnotations();
            this._setupEventListeners();
        }

        _injectStyles() { try { GM_addStyle(styles); } catch (e) { const s = document.createElement("style"); s.innerText = styles; document.head.appendChild(s); } }
        
        _setupEventListeners() {
            document.addEventListener('mouseup', this._onMouseUp.bind(this));
            document.addEventListener('mousedown', this._onMouseDown.bind(this), true);
            document.addEventListener('keydown', this._onKeyDown.bind(this));
            // Add focus listeners to track when the user enters/leaves an input field.
            document.addEventListener('focusin', this._onFocusChange.bind(this));
            document.addEventListener('focusout', this._onFocusChange.bind(this));
        }

        _onFocusChange(event) {
            const target = event.target;
            const isInput = target.isContentEditable || target.matches('input, textarea, select');
            this.shortcutsEnabled = !isInput;
        }

        _onKeyDown(event) {
            // If shortcuts are disabled for the current context, do nothing.
            if (!this.shortcutsEnabled) return;

            if (event.key === 'Escape') {
                // Case 1: An annotation's context menu is open. Close it.
                if (this.activeAnnotationId) {
                    this.menu.hide();
                    this.activeAnnotationId = null;
                }
                // Case 2: A new text selection is active. Deselect and hide menu.
                else {
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed) {
                        selection.removeAllRanges();
                        this.menu.hide();
                        this.activeRange = null;
                    }
                }
            }

            // On Delete, if an annotation's context menu is open, delete the annotation.
            if (event.key === 'Delete') {
                if (this.activeAnnotationId) {
                    this.deleteAnnotation();
                }
            }
        }

        _onMouseDown(event) {
            const target = event.target;
            if (target.closest('.highlighter-menu')) return;
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
            if (event.target.closest('.highlighter-menu') || event.target.closest('.highlighter-mark')) return;
            setTimeout(() => {
                const selection = window.getSelection();
                if (selection.isCollapsed || selection.rangeCount === 0) return;

                let range = selection.getRangeAt(0);

                // --- SELECTION SANITIZATION ---
                // Problem: If a selection ends at the very beginning of a new block element (offset 0),
                // it can cause the block element itself to be included in the highlight, breaking layout.
                // Solution: Detect this case and adjust the range to end at the end of the previous sibling.
                if (range.endOffset === 0 && range.endContainer.nodeType === Node.ELEMENT_NODE) {
                    const previousSibling = range.endContainer.previousSibling;
                    if (previousSibling) {
                        // If the previous sibling is a text node, set the end there.
                        if (previousSibling.nodeType === Node.TEXT_NODE) {
                            range.setEnd(previousSibling, previousSibling.length);
                        }
                        // If it's an element, set the end after its last child.
                        else if (previousSibling.nodeType === Node.ELEMENT_NODE) {
                            range.setEnd(previousSibling, previousSibling.childNodes.length);
                        }
                    }
                }
                // --- END SANITIZATION ---
                
                // --- Trim selection logic ---
                const originalString = range.toString();
                if (originalString.length === 0) return;
                
                const leadingSpaces = originalString.match(/^\s*/)[0].length;
                const trailingSpaces = originalString.match(/\s*$/)[0].length;

                if (leadingSpaces > 0) {
                    range.setStart(range.startContainer, range.startOffset + leadingSpaces);
                }
                if (trailingSpaces > 0) {
                    const newEndOffset = Math.max(0, range.endOffset - trailingSpaces);
                    range.setEnd(range.endContainer, newEndOffset);
                }
                
                if (leadingSpaces > 0 || trailingSpaces > 0) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                // --- End trim logic ---

                if (range.toString().length === 0) return;

                this.activeRange = range;
                const rect = range.getBoundingClientRect();
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
                        action: 'create', value: color, label: lang.colors[name] || name, className: 'highlighter-color-selector', content: `<div style="width:100%; height:100%; background-color:${color}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'setType', value: 'highlight', label: lang.highlight, content: 'A', className: `highlighter-type-selector ${this.currentAnnotationType === 'highlight' ? 'active' : ''}` },
                        { action: 'setType', value: 'underline', label: lang.underline, content: '<span class="underline">A</span>', className: `highlighter-type-selector ${this.currentAnnotationType === 'underline' ? 'active' : ''}` }
                    ]
                },
                showWarning: !this.shortcutsEnabled
            });
            this.menu.show({ getBoundingClientRect: () => rect });
        }

        _showContextMenuFor(element) {
            this.activeAnnotationId = element.dataset.annotationId;
            const annotation = this.annotations.get(this.activeAnnotationId);
            const rect = element.getBoundingClientRect();
            this.menu.configure({
                callbacks: {
                    changeColor: (color) => this.updateAnnotation({ color }),
                    changeType: (type) => this.updateAnnotation({ type }),
                    delete: () => this.deleteAnnotation(),
                },
                buttons: {
                    colors: Object.entries(this.colors).map(([name, color]) => ({
                        action: 'changeColor', value: color, label: lang.colors[name] || name, className: `highlighter-color-selector ${annotation.color === color ? 'active' : ''}`, content: `<div style="width:100%; height:100%; background-color:${color}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'changeType', value: 'highlight', label: lang.highlight, content: 'A', className: `highlighter-type-selector ${annotation.type === 'highlight' ? 'active' : ''}` },
                        { action: 'changeType', value: 'underline', label: lang.underline, content: '<span class="underline">A</span>', className: `highlighter-type-selector ${annotation.type === 'underline' ? 'active' : ''}` }
                    ],
                    actions: [{ action: 'delete', label: lang.delete, content: this.deleteIcon, className: 'highlighter-delete-btn' }]
                },
                showWarning: !this.shortcutsEnabled
            });
            this.menu.show(element);
        }

        _loadAnnotations() {
            this.annotations.forEach(annotation => {
                const range = DOMManager.getRangeFromPointers(annotation.pointers);
                if (range) DOMManager.wrapRange(range, annotation);
            });
        }

        createAnnotation(color, type) {
            if (!this.activeRange) return;
            const id = this.storage.generateId();
            const pointers = DOMManager.getRangePointers(this.activeRange);
            const text = this.activeRange.toString();
            const annotation = { id, color, type, pointers, text };
            const marks = DOMManager.wrapRange(this.activeRange, annotation);
            if (marks.length > 0) {
                this.annotations.set(id, annotation);
                this.storage.save(this.annotations);
            }
            window.getSelection().removeAllRanges();
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
                DOMManager.applyAnnotationStyle(el, annotation);
            });
            this.annotations.set(id, annotation);
            this.storage.save(this.annotations);
            this.menu.hide();
            this.activeAnnotationId = null;
        }

        deleteAnnotation() {
            const id = this.activeAnnotationId;
            if (!id) return;
            document.querySelectorAll(`[data-annotation-id="${id}"]`).forEach(el => DOMManager.unwrap(el));
            this.annotations.delete(id);
            this.storage.save(this.annotations);
            this.menu.hide();
            this.activeAnnotationId = null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new Highlighter());
    } else {
        new Highlighter();
    }
})();