// ==UserScript==
// @name         Highlighter WEB
// @namespace    http://tampermonkey.net/
// @version      18.07.2025.10
// @description  Sistema de anotaciones web inspirado en Zotero. Resalta, subraya y gestiona anotaciones en cualquier página.
// @author       George
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

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
            opacity: 0.7;
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

        /* Caret pointing up */
        .highlighter-menu::before {
            content: '';
            position: absolute;
            top: -5px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 6px solid white;
            filter: drop-shadow(0 -2px 2px rgba(0,0,0,0.05));
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
            box-shadow: 0 0 0 2px #007acc;
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
            range.setStart(startNode, start.offset);
            range.setEnd(endNode, end.offset);
            return range;
        }

        static applyAnnotationStyle(element, annotation) {
            const colorWithOpacity = annotation.color.startsWith('#') ? `${annotation.color}80` : annotation.color;
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
            const mark = document.createElement('mark');
            mark.className = 'highlighter-mark';
            mark.dataset.annotationId = annotation.id;
            this.applyAnnotationStyle(mark, annotation);
            try {
                const fragment = range.extractContents();
                mark.appendChild(fragment);
                range.insertNode(mark);
                mark.parentNode.normalize();
                return [mark];
            } catch (e) {
                console.error("Highlighter: Error wrapping range.", e);
                return [];
            }
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
        }

        configure(config) {
            const { types, colors, actions } = config.buttons;
            let typesHTML = types ? `<div class="menu-row types">${this._createButtons(types)}</div>` : '';
            let colorsHTML = colors ? `<div class="menu-row colors">${this._createButtons(colors)}</div>` : '';
            let actionsHTML = actions ? `<div class="menu-row actions">${this._createButtons(actions)}</div>` : '';
            this.element.innerHTML = colorsHTML + typesHTML + actionsHTML;
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

        show(x, y_bottom) {
            this.element.classList.add('show');
            const rect = this.element.getBoundingClientRect();
            // Adjust for scaling
            const scaledWidth = rect.width * 0.9;
            let finalX = x - scaledWidth / 2;
            let finalY = y_bottom + 12; // Position below the selection
            if (finalX < 0) finalX = 10;
            this.element.style.left = `${finalX}px`;
            this.element.style.top = `${finalY}px`;
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
            // this.deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
            this.deleteIcon = `Borrar`;
            this._injectStyles();
            this._loadAnnotations();
            this._setupEventListeners();
        }

        _injectStyles() { try { GM_addStyle(styles); } catch (e) { const s = document.createElement("style"); s.innerText = styles; document.head.appendChild(s); } }
        
        _setupEventListeners() {
            document.addEventListener('mouseup', this._onMouseUp.bind(this));
            document.addEventListener('mousedown', this._onMouseDown.bind(this), true);
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
                const range = selection.getRangeAt(0);
                if (range.toString().trim().length === 0) return;
                this.activeRange = range;
                const rect = range.getBoundingClientRect();
                this._showCreationMenu(rect.x + rect.width / 2, window.scrollY + rect.bottom);
            }, 10);
        }

        _showCreationMenu(x, y_bottom) {
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
                        action: 'create', value: color, label: name, className: 'highlighter-color-selector', content: `<div style="width:100%; height:100%; background-color:${color}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'setType', value: 'highlight', label: 'Highlight', content: 'A', className: `highlighter-type-selector ${this.currentAnnotationType === 'highlight' ? 'active' : ''}` },
                        { action: 'setType', value: 'underline', label: 'Underline', content: '<span class="underline">A</span>', className: `highlighter-type-selector ${this.currentAnnotationType === 'underline' ? 'active' : ''}` }
                    ]
                }
            });
            this.menu.show(x, y_bottom);
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
                        action: 'changeColor', value: color, label: name, className: `highlighter-color-selector ${annotation.color === color ? 'active' : ''}`, content: `<div style="width:100%; height:100%; background-color:${color}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'changeType', value: 'highlight', label: 'Highlight', content: 'A', className: `highlighter-type-selector ${annotation.type === 'highlight' ? 'active' : ''}` },
                        { action: 'changeType', value: 'underline', label: 'Underline', content: '<span class="underline">A</span>', className: `highlighter-type-selector ${annotation.type === 'underline' ? 'active' : ''}` }
                    ],
                    actions: [{ action: 'delete', label: 'Delete', content: this.deleteIcon, className: 'highlighter-delete-btn' }]
                }
            });
            this.menu.show(rect.x + rect.width / 2, window.scrollY + rect.bottom);
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
