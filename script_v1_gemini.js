// ==UserScript==
// @name         Resaltador de Páginas Web Avanzado
// @namespace    http://tampermonkey.net/
// @version      2025.07.17
// @description  Resalta, subraya y comenta texto en cualquier página web con una UI/UX excepcional. Los datos se guardan localmente.
// @author       Gemini
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURACIÓN ---
    const COLORS = ['#fde047', '#fca5a5', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4', '#a7f3d0', '#fbcfe8'];
    const DEFAULT_COLOR = COLORS[0];

    // --- ESTILOS CSS ---
    GM_addStyle(`
        .highlight-toolbox {
            position: absolute;
            z-index: 99999999;
            background-color: #2d3748;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            padding: 6px;
            gap: 4px;
            transform: translateY(-10px);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
        }

        .highlight-toolbox.visible {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
        }

        .highlight-toolbox button {
            background: transparent;
            border: none;
            color: #e2e8f0;
            cursor: pointer;
            padding: 8px;
            border-radius: 6px;
            transition: background-color 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .highlight-toolbox button:hover {
            background-color: #4a5568;
        }

        .highlight-toolbox .color-palette {
            display: flex;
            gap: 5px;
            padding-left: 5px;
            border-left: 1px solid #4a5568;
            margin-left: 5px;
        }

        .highlight-toolbox .color-swatch {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
            transition: transform 0.1s ease, border-color 0.2s ease;
        }

        .highlight-toolbox .color-swatch:hover {
            transform: scale(1.1);
        }

        .highlight-toolbox .color-swatch.selected {
            border-color: #cbd5e0;
        }

        .highlight-annotation {
            cursor: pointer;
            padding: 2px 0;
            border-radius: 3px;
        }

        .underline-annotation {
            cursor: pointer;
            border-bottom: 2px solid;
            padding-bottom: 1px;
        }

        .highlight-comment-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 100000000;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            padding: 20px;
            width: 350px;
        }

        .highlight-comment-modal textarea {
            width: 100%;
            min-height: 80px;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
            font-family: inherit;
            font-size: 14px;
        }

        .highlight-comment-modal button {
            padding: 8px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }

        .highlight-comment-modal .save-btn {
            background-color: #2563eb;
            color: white;
        }

        .highlight-comment-modal .cancel-btn {
            background-color: #e2e8f0;
            color: #1a202c;
        }
        .highlight-comment-modal .delete-btn {
            background-color: #ef4444;
            color: white;
            margin-left: auto; /* Empuja el botón a la derecha */
        }
        .highlight-comment-modal .modal-footer {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        .highlight-comment-modal h3 {
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
            color: #1a202c;
        }
        .highlight-comment-modal .annotation-text-preview {
            background-color: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
            font-style: italic;
            max-height: 100px;
            overflow-y: auto;
        }
    `);

    // --- LÓGICA PRINCIPAL ---
    let toolbox, commentModal;
    let currentSelection;

    function getStorageKey() {
        return `web-highlighter-data-${window.location.hostname}${window.location.pathname}`;
    }

    function saveAnnotations(annotations) {
        localStorage.setItem(getStorageKey(), JSON.stringify(annotations));
    }

    function getAnnotations() {
        return JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
    }

    function deleteAnnotation(id) {
        let annotations = getAnnotations();
        annotations = annotations.filter(a => a.id !== id);
        saveAnnotations(annotations);
        document.querySelectorAll(`[data-highlight-id="${id}"]`).forEach(el => {
            el.outerHTML = el.innerHTML; // Desenvuelve el contenido
        });
    }

    function updateAnnotationComment(id, comment) {
        let annotations = getAnnotations();
        const index = annotations.findIndex(a => a.id === id);
        if (index !== -1) {
            annotations[index].comment = comment;
            saveAnnotations(annotations);
            document.querySelector(`[data-highlight-id="${id}"]`).title = comment;
        }
    }

    function createToolbox() {
        toolbox = document.createElement('div');
        toolbox.className = 'highlight-toolbox';
        document.body.appendChild(toolbox);

        const highlightBtn = createButton('H', 'Resaltar', () => applyAnnotation('highlight', DEFAULT_COLOR));
        toolbox.appendChild(highlightBtn);

        const underlineBtn = createButton('U', 'Subrayar', () => applyAnnotation('underline', COLORS[1]));
        toolbox.appendChild(underlineBtn);

        const commentBtn = createButton('C', 'Comentar', () => {
            showCommentModal({
                onSave: (comment) => {
                    if (comment) {
                        applyAnnotation('highlight', DEFAULT_COLOR, comment);
                    }
                }
            });
        });
        toolbox.appendChild(commentBtn);

        const colorPalette = document.createElement('div');
        colorPalette.className = 'color-palette';
        COLORS.forEach(color => {
            const swatch = createColorSwatch(color);
            colorPalette.appendChild(swatch);
        });
        toolbox.appendChild(colorPalette);
    }

    function createColorSwatch(color) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.title = `Resaltar con este color`;
        swatch.addEventListener('click', () => applyAnnotation('highlight', color));
        return swatch;
    }

    function createButton(icon, title, onClick) {
        const btn = document.createElement('button');
        btn.innerHTML = icon;
        btn.title = title;
        btn.addEventListener('click', onClick);
        return btn;
    }

    function showToolbox() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            hideToolbox();
            return;
        }
        currentSelection = selection;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        toolbox.classList.add('visible');
        const toolboxRect = toolbox.getBoundingClientRect();
        toolbox.style.top = `${window.scrollY + rect.top - toolboxRect.height - 10}px`;
        toolbox.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (toolboxRect.width / 2)}px`;
    }

    function hideToolbox() {
        if (toolbox) {
            toolbox.classList.remove('visible');
        }
    }

    function createCommentModal() {
        commentModal = document.createElement('div');
        commentModal.className = 'highlight-comment-modal';
        commentModal.style.display = 'none';

        const title = document.createElement('h3');
        const preview = document.createElement('div');
        preview.className = 'annotation-text-preview';

        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Escribe tu comentario...';

        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'Guardar';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = 'Cancelar';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Eliminar';

        footer.append(deleteBtn, cancelBtn, saveBtn);
        commentModal.append(title, preview, textarea, footer);
        document.body.appendChild(commentModal);
    }

    function showCommentModal({ onSave, onDelete, initialComment = '', annotationText = '' }) {
        const title = commentModal.querySelector('h3');
        const preview = commentModal.querySelector('.annotation-text-preview');
        const textarea = commentModal.querySelector('textarea');
        const footer = commentModal.querySelector('.modal-footer');
        const saveBtn = footer.querySelector('.save-btn');
        const cancelBtn = footer.querySelector('.cancel-btn');
        const deleteBtn = footer.querySelector('.delete-btn');

        // Configurar contenido
        title.textContent = onDelete ? 'Editar Anotación' : 'Añadir Comentario';
        textarea.value = initialComment;

        if (annotationText) {
            preview.textContent = annotationText;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }

        commentModal.style.display = 'block';
        textarea.focus();

        // Limpiar listeners antiguos para evitar ejecuciones múltiples
        const newFooter = footer.cloneNode(true);
        footer.parentNode.replaceChild(newFooter, footer);
        const newSaveBtn = newFooter.querySelector('.save-btn');
        const newCancelBtn = newFooter.querySelector('.cancel-btn');
        const newDeleteBtn = newFooter.querySelector('.delete-btn');

        // Asignar nuevos listeners
        newSaveBtn.addEventListener('click', () => {
            onSave(textarea.value);
            hideCommentModal();
        });

        newCancelBtn.addEventListener('click', hideCommentModal);

        if (onDelete) {
            newDeleteBtn.style.display = 'inline-block';
            newDeleteBtn.addEventListener('click', () => {
                if (confirm(`¿Estás seguro de que quieres eliminar esta anotación?\n\n"${annotationText}"`)) {
                    onDelete();
                    hideCommentModal();
                }
            });
        } else {
            newDeleteBtn.style.display = 'none';
        }
    }

    function hideCommentModal() {
        commentModal.style.display = 'none';
    }

    function applyAnnotation(type, color, comment = '') {
        if (!currentSelection || currentSelection.isCollapsed) return;

        const id = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const range = currentSelection.getRangeAt(0);
        const text = range.toString();

        const path = getRobustPath(range);
        if (!path) {
            console.error("Highlighter: No se pudo generar una ruta robusta para la selección.");
            return;
        }

        const annotationData = {
            id, type, color, comment, path, text, url: window.location.href
        };

        const annotations = getAnnotations();
        annotations.push(annotationData);
        saveAnnotations(annotations);

        highlightRange(range, annotationData);
        currentSelection.removeAllRanges();
        hideToolbox();
    }

    function highlightRange(range, data) {
        const { id, type, color, comment } = data;
        const wrapper = document.createElement('span');
        wrapper.dataset.highlightId = id;
        wrapper.title = comment || 'Haz clic para editar o eliminar';

        if (type === 'highlight') {
            wrapper.className = 'highlight-annotation';
            wrapper.style.backgroundColor = color;
        } else if (type === 'underline') {
            wrapper.className = 'underline-annotation';
            wrapper.style.borderColor = color;
        }

        try {
            wrapper.appendChild(range.extractContents());
            range.insertNode(wrapper);
        } catch (e) {
            console.error("Error al aplicar el resaltado:", e);
            return;
        }

        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showCommentModal({
                initialComment: data.comment,
                annotationText: data.text,
                onSave: (newComment) => {
                    data.comment = newComment;
                    updateAnnotationComment(id, newComment);
                },
                onDelete: () => deleteAnnotation(id)
            });
        });
    }

    function getRobustPath(range) {
        const TEXT_CONTEXT_LENGTH = 40;
        const selectedText = range.toString();
        if (selectedText.trim() === '') return null;

        const ancestor = range.commonAncestorContainer;
        if (!ancestor) return null;

        const fullText = ancestor.textContent || '';
        const startIndexInFull = fullText.indexOf(selectedText);

        if (startIndexInFull === -1) {
            console.warn("Highlighter: El texto seleccionado no se encontró en su ancestro.");
            return { text: selectedText, prefix: '', suffix: '' };
        }

        const prefixIndex = Math.max(0, startIndexInFull - TEXT_CONTEXT_LENGTH);
        const prefix = fullText.substring(prefixIndex, startIndexInFull);
        const suffixStartIndex = startIndexInFull + selectedText.length;
        const suffix = fullText.substring(suffixStartIndex, suffixStartIndex + TEXT_CONTEXT_LENGTH);

        return { text: selectedText, prefix, suffix };
    }

    function restoreHighlights() {
        const annotations = getAnnotations();
        if (annotations.length === 0) return;

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let node;
        while(node = walker.nextNode()) {
            if (node.nodeValue.trim() !== '' && !node.parentElement.closest('.highlight-toolbox, .highlight-comment-modal, script, style')) {
                textNodes.push(node);
            }
        }

        annotations.forEach(data => {
            if (document.querySelector(`[data-highlight-id="${data.id}"]`)) return;

            const { text, prefix } = data.path;
            if (!text) return;

            for (let i = 0; i < textNodes.length; i++) {
                const node = textNodes[i];
                const nodeText = node.nodeValue;
                let searchIndex = -1;

                while ((searchIndex = nodeText.indexOf(text, searchIndex + 1)) !== -1) {
                    let currentPrefix = (i > 0) ? textNodes[i - 1].nodeValue.slice(-prefix.length) : '';
                    currentPrefix += nodeText.substring(0, searchIndex);

                    if (prefix === '' || currentPrefix.endsWith(prefix)) {
                        const range = document.createRange();
                        range.setStart(node, searchIndex);
                        let remainingLength = text.length;
                        let currentNodeIndex = i;
                        let currentNode = node;
                        let startOffset = searchIndex;

                        while (remainingLength > 0 && currentNode) {
                            const textInNode = currentNode.nodeValue.substring(startOffset);
                            if (textInNode.length >= remainingLength) {
                                range.setEnd(currentNode, startOffset + remainingLength);
                                remainingLength = 0;
                            } else {
                                range.setEnd(currentNode, currentNode.nodeValue.length);
                                remainingLength -= textInNode.length;
                                currentNodeIndex++;
                                currentNode = textNodes[currentNodeIndex];
                                startOffset = 0;
                            }
                        }

                        if (range.toString() === text) {
                            highlightRange(range, data);
                            return;
                        }
                    }
                }
            }
        });
    }

    // --- INICIALIZACIÓN ---
    function init() {
        createToolbox();
        createCommentModal();

        document.addEventListener('mouseup', showToolbox);
        document.addEventListener('mousedown', (e) => {
            if (toolbox && !toolbox.contains(e.target) && !commentModal.contains(e.target)) {
                hideToolbox();
            }
        });

        restoreHighlights();
        const observer = new MutationObserver(debounce(restoreHighlights, 500));
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    init();

})();