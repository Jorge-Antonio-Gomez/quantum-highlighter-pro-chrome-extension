(function () {
    'use strict';

    // Intercept history changes for Single Page Applications (SPAs)
    (function(history){
        const pushState = history.pushState;
        const replaceState = history.replaceState;

        history.pushState = function(state) {
            if (typeof history.onpushstate == "function") {
                history.onpushstate({state: state});
            }
            // Call the original pushState with the same arguments
            const result = pushState.apply(history, arguments);
            // Dispatch a custom event
            window.dispatchEvent(new Event('urlchange'));
            return result;
        };

        history.replaceState = function(state) {
            if (typeof history.onreplacestate == "function") {
                history.onreplacestate({state: state});
            }
            // Call the original replaceState with the same arguments
            const result = replaceState.apply(history, arguments);
            // Dispatch a custom event
            window.dispatchEvent(new Event('urlchange'));
            return result;
        };

    })(window.history);

    // TIPTAP EDITOR FUNCTIONS
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
            case 'blockquote':
                editor.chain().focus().toggleBlockquote().run();
                break;
            case 'codeBlock':
                editor.chain().focus().toggleCodeBlock().run();
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
                promptForLink(editor);
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
                case 'blockquote':
                case 'codeBlock':
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
                    <button data-action="bold" title="${chrome.i18n.getMessage('toolbarBold')}"><img src="${chrome.runtime.getURL('images/toolbar-icons/bold.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="italic" title="${chrome.i18n.getMessage('toolbarItalic')}"><img src="${chrome.runtime.getURL('images/toolbar-icons/italic.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="underline" title="${chrome.i18n.getMessage('toolbarUnderline')}"><img src="${chrome.runtime.getURL('images/toolbar-icons/underline.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="strike" title="${chrome.i18n.getMessage('toolbarStrike')}"><img src="${chrome.runtime.getURL('images/toolbar-icons/strikethrough.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="blockquote" title="${chrome.i18n.getMessage('toolbarBlockquote')}"><img src="${chrome.runtime.getURL('images/toolbar-icons/chat-left.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="codeBlock" title="${chrome.i18n.getMessage('toolbarCodeBlock')}"><img src="${chrome.runtime.getURL('images/toolbar-icons/bracket.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="link" title="${chrome.i18n.getMessage('toolbarLink')}"><img src="${chrome.runtime.getURL('images/toolbar-icons/link-alt.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="h1" title="${chrome.i18n.getMessage('heading')} 1"><img src="${chrome.runtime.getURL('images/toolbar-icons/heading-1.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="h2" title="${chrome.i18n.getMessage('heading')} 2"><img src="${chrome.runtime.getURL('images/toolbar-icons/heading-2.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                    <button data-action="h3" title="${chrome.i18n.getMessage('heading')} 3"><img src="${chrome.runtime.getURL('images/toolbar-icons/heading-3.svg')}" style="max-height: 12px; max-width: 12px; height: 12px; width: 12px;"></button>
                `;

        toolbarContainer.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = e.currentTarget.dataset.action;
                handleToolbarClick(action, editor);
                updateToolbar(editor, toolbarContainer);
            });
        });
    }

    function setupTiptapEditor(element, toolbarContainer, content, onUpdate, rootNode) {
        const { Editor, Extension, InputRule, wrappingInputRule, Plugin, PluginKey } = Tiptap;

        const CustomInputRules = Extension.create({
            name: 'customInputRules',
            addInputRules() {
                return [
                    wrappingInputRule({
                        find: /^\s*\|\s$/,
                        type: this.editor.schema.nodes.blockquote,
                    }),
                ];
            },
        });

        const ExitLinkOnTwoSpaces = Extension.create({
            name: 'exitLinkOnTwoSpaces',
            addProseMirrorPlugins() {
                return [
                    new Plugin({
                        key: new PluginKey('exitLinkOnTwoSpaces'),
                        appendTransaction: (transactions, oldState, newState) => {
                            const tr = newState.tr;
                            const { selection } = tr;
                            if (!selection.empty || !selection.$cursor) return null;

                            const lastTransaction = transactions[transactions.length - 1];
                            if (!lastTransaction || !lastTransaction.docChanged) return null;
                            
                            const textBefore = newState.doc.textBetween(Math.max(0, selection.$cursor.pos - 2), selection.$cursor.pos, null, ' ');
                            if (textBefore !== '  ') return null;

                            const { $from } = selection;
                            const linkMark = this.editor.schema.marks.link.isInSet($from.marks());
                            if (!linkMark) return null;

                            let markEndPos = $from.pos;
                            $from.parent.nodesBetween($from.parentOffset, $from.parent.content.size, (node, pos) => {
                                if (($from.start() + pos) < $from.pos - node.nodeSize) return;

                                if (linkMark.isInSet(node.marks)) {
                                    markEndPos = $from.start() + pos + node.nodeSize;
                                } else {
                                    return false;
                                }
                            });

                            const deleteStart = $from.pos - 2;
                            const deleteEnd = $from.pos;
                            const insertPos = markEndPos - 2;

                            const finalTr = tr.delete(deleteStart, deleteEnd);
                            const spaceNode = this.editor.schema.text(' ', []);
                            
                            finalTr.replaceWith(insertPos, insertPos, spaceNode);

                            return finalTr;
                        }
                    })
                ];
            }
        });

        const RemoveEmptyLink = Extension.create({
            name: 'removeEmptyLink',
            addKeyboardShortcuts() {
                return {
                    'Backspace': () => {
                        const { state } = this.editor;
                        const { selection } = state;

                        if (!selection.empty || !selection.$cursor) { return false; }

                        const { $cursor } = selection;
                        const nodeBefore = $cursor.nodeBefore;
                        const linkMarkType = this.editor.schema.marks.link;

                        if (nodeBefore && linkMarkType.isInSet(nodeBefore.marks) && nodeBefore.nodeSize === 1) {
                            return this.editor.chain().focus()
                                .deleteRange({ from: $cursor.pos - 1, to: $cursor.pos })
                                .run();
                        }

                        return false;
                    },
                    'Delete': () => {
                        const { state } = this.editor;
                        const { selection } = state;

                        if (!selection.empty || !selection.$cursor) { return false; }

                        const { $cursor } = selection;
                        const nodeAfter = $cursor.nodeAfter;
                        const linkMarkType = this.editor.schema.marks.link;

                        if (nodeAfter && linkMarkType.isInSet(nodeAfter.marks) && nodeAfter.nodeSize === 1) {
                            return this.editor.chain().focus()
                                .deleteRange({ from: $cursor.pos, to: $cursor.pos + 1 })
                                .run();
                        }

                        return false;
                    }
                }
            }
        });

        const LinkTooltip = Extension.create({
            name: 'linkTooltip',

            addProseMirrorPlugins() {
                return [
                    new Plugin({
                        key: new PluginKey('linkTooltip'),
                        props: {
                            handleDOMEvents: {
                                mouseover: (view, event) => {
                                    const link = event.target.closest('a');
                                    if (!link || !view.dom.contains(link)) {
                                        const tooltip = this.editor.options.linkTooltipElement;
                                        if (tooltip && tooltip.classList.contains('is-visible')) {
                                            tooltip.classList.remove('is-visible', 'popup-bounce-in');
                                            tooltip.classList.add('popup-bounce-out');
                                        }
                                        return false;
                                    }

                                    if (!this.editor.options.linkTooltipElement) {
                                        this.editor.options.linkTooltipElement = document.createElement('div');
                                        this.editor.options.linkTooltipElement.className = 'tiptap-link-tooltip';
                                        (this.editor.rootNode || document.body).appendChild(this.editor.options.linkTooltipElement);
                                        this.editor.options.linkTooltipElement.addEventListener('animationend', (e) => {
                                            if (tooltip && tooltip.classList.contains('popup-bounce-out')) {
                                            e.target.classList.remove('popup-bounce-in', 'popup-bounce-out');
                                            e.target.style.display = 'none';
                                        }
                                        });
                                    }

                                    const tooltip = this.editor.options.linkTooltipElement;
                                    tooltip.textContent = link.getAttribute('href');
                                    tooltip.style.display = '';

                                    const virtualEl = {
                                        getBoundingClientRect() {
                                            return {
                                                width: 0,
                                                height: 0,
                                                x: event.clientX,
                                                y: event.clientY,
                                                left: event.clientX,
                                                right: event.clientX,
                                                top: event.clientY,
                                                bottom: event.clientY
                                            };
                                        }
                                    };

                                    computePosition(virtualEl, tooltip, {
                                        placement: 'bottom',
                                        middleware: [offset(12), flip(), shift({ padding: 5 })],
                                    }).then(({ x, y }) => {
                                        Object.assign(tooltip.style, {
                                            left: `${x}px`,
                                            top: `${y}px`
                                        });
                                        tooltip.classList.remove('popup-bounce-out');
                                        tooltip.classList.add('popup-bounce-in');
                                    });

                                    return true;
                                },
                                mouseout: (view, event) => {
                                    const link = event.target.closest('a');
                                    if (!link || !view.dom.contains(link)) return false;

                                    const tooltip = this.editor.options.linkTooltipElement;
                                    if (tooltip) {
                                        tooltip.classList.remove('popup-bounce-in');
                                        tooltip.classList.add('popup-bounce-out');
                                    }

                                    return true;
                                },
                                mousemove: (view, event) => {
                                    const link = event.target.closest('a');
                                    if (!link || !view.dom.contains(link)) return false;

                                    const tooltip = this.editor.options.linkTooltipElement;
                                    if (tooltip && tooltip.classList.contains('popup-bounce-in')) {
                                        const virtualEl = {
                                            getBoundingClientRect() {
                                                return {
                                                    width: 0,
                                                    height: 0,
                                                    x: event.clientX,
                                                    y: event.clientY,
                                                    left: event.clientX,
                                                    right: event.clientX,
                                                    top: event.clientY,
                                                    bottom: event.clientY
                                                };
                                            }
                                        };

                                        computePosition(virtualEl, tooltip, {
                                            placement: 'bottom',
                                            middleware: [offset(12), flip(), shift({ padding: 5 })],
                                        }).then(({ x, y }) => {
                                            Object.assign(tooltip.style, {
                                                left: `${x}px`,
                                                top: `${y}px`,
                                            });
                                        });
                                    }
                                    return true;
                                }
                            }
                        }
                    })
                ];
            },

            onDestroy() {
                const tooltip = this.editor.options.linkTooltipElement;
                if (tooltip) {
                    tooltip.remove();
                    this.editor.options.linkTooltipElement = null;
                }
            },
        });

        const editor = new Editor({
            element: element,
            extensions: [
                window.Tiptap.StarterKit.configure({
                    link: {
                        openOnClick: false,
                        HTMLAttributes: {
                            target: '_blank',
                            rel: 'noopener noreferrer',
                        },
                    },
                    heading: {
                        levels: [1, 2, 3, 4, 5, 6],
                    },
                }),
                window.Tiptap.Placeholder.configure({
                    includeChildren: true,
                    placeholder: ({ editor, node }) => {
                        const nodeType = node.type.name;
                        const parent = node.parent;
                        const parentType = parent ? parent.type.name : null;

                        if (nodeType === 'paragraph' && parentType === 'blockquote' && parent.firstChild === node && node.content.size === 0) {
                            return chrome.i18n.getMessage('quotePlaceholder');
                        }

                        if (editor.isEmpty && nodeType === 'paragraph') {
                            return chrome.i18n.getMessage('commentPlaceholder');
                        }

                        if (nodeType === 'paragraph' && parentType === 'listItem' && parent.childCount === 1) {
                            return null;
                        }

                        if (node.content.size === 0) {
                            if (nodeType === 'paragraph') {
                                return chrome.i18n.getMessage('paragraphPlaceholder');
                            }
                            if (nodeType === 'heading') {
                                return `${chrome.i18n.getMessage('heading')} ${node.attrs.level}`;
                            }
                            if (nodeType === 'codeBlock') {
                                return chrome.i18n.getMessage('codePlaceholder');
                            }
                        }

                        const isNodeWithOneEmptyChild = node.childCount === 1 && node.firstChild.content.size === 0;
                        if (isNodeWithOneEmptyChild) {
                            if (nodeType === 'listItem') {
                                return chrome.i18n.getMessage('listPlaceholder');
                            }
                        }

                        return null;
                    },
                }),
                CustomInputRules,
                ExitLinkOnTwoSpaces,
                RemoveEmptyLink,
                LinkTooltip,
            ],
            content: content,
            editable: true,
            onCreated: ({ editor }) => {
                const proseMirror = editor.view.dom;
                proseMirror.classList.toggle('is-empty', editor.isEmpty);
            },
            onUpdate: ({ editor }) => {
                editor.view.dom.classList.toggle('is-empty', editor.isEmpty);
                if (onUpdate) {
                    onUpdate(editor.getHTML());
                }
                updateToolbar(editor, toolbarContainer);
            },
            onFocus: () => {
                toolbarContainer.classList.add('is-visible');
            },
            onBlur: ({ event }) => {
                if (event.relatedTarget && 
                    (toolbarContainer.contains(event.relatedTarget) || 
                     event.relatedTarget.closest('.highlighter-link-modal'))) {
                    return;
                }
                toolbarContainer.classList.remove('is-visible');
            },
            onSelectionUpdate: ({ editor }) => {
                updateToolbar(editor, toolbarContainer);
            },
            editorProps: {
                handleClick: (view, pos, event) => {
                    const link = event.target.closest('a');

                    if (link && view.dom.contains(link)) {
                        if (event.ctrlKey) {
                            event.preventDefault();
                            event.stopPropagation();
                            chrome.runtime.sendMessage({ action: 'openTab', url: link.href });
                            return true;
                        }
                    }
                    return false;
                },
                handleKeyDown: (view, event) => {
                    if (!toolbarContainer.classList.contains('is-visible')) {
                        return false;
                    }

                    if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === 'b') {
                        event.preventDefault();
                        editor.chain().focus().toggleBold().run();
                        return true;
                    }
                    if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === 'i') {
                        event.preventDefault();
                        editor.chain().focus().toggleItalic().run();
                        return true;
                    }
                    if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === 'u') {
                        event.preventDefault();
                        editor.chain().focus().toggleUnderline().run();
                        return true;
                    }
                    if (event.ctrlKey && event.shiftKey && !event.altKey && event.key === 'X') {
                        event.preventDefault();
                        editor.chain().focus().toggleStrike().run();
                        return true;
                    }
                    if (event.ctrlKey && event.shiftKey && !event.altKey && event.key === '7') {
                        event.preventDefault();
                        editor.chain().focus().toggleBlockquote().run();
                        return true;
                    }
                    if (event.ctrlKey && event.shiftKey && !event.altKey && event.key === '8') {
                        event.preventDefault();
                        editor.chain().focus().toggleCodeBlock().run();
                        return true;
                    }
                    if (event.ctrlKey && event.altKey && !event.shiftKey && event.key === '1') {
                        event.preventDefault();
                        editor.chain().focus().toggleHeading({ level: 1 }).run();
                        return true;
                    }
                    if (event.ctrlKey && event.altKey && !event.shiftKey && event.key === '2') {
                        event.preventDefault();
                        editor.chain().focus().toggleHeading({ level: 2 }).run();
                        return true;
                    }
                    if (event.ctrlKey && event.altKey && !event.shiftKey && event.key === '3') {
                        event.preventDefault();
                        editor.chain().focus().toggleHeading({ level: 3 }).run();
                        return true;
                    }
                    if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === 'k') {
                        event.preventDefault();
                        promptForLink(editor);
                        return true;
                    }

                    return false;
                }
            }
        });

        editor.rootNode = rootNode;
        buildToolbar(toolbarContainer, editor);
        updateToolbar(editor, toolbarContainer);

        return editor;
    }


    function showLinkEditor(previousUrl = '', previousText = '', rootNode) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'highlighter-modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'highlighter-link-modal';
            modal.innerHTML = `
                <h3>${chrome.i18n.getMessage('editLinkTitle')}</h3>
                <div class="form-group">
                    <label for="link-text">${chrome.i18n.getMessage('textLabel')}</label>
                    <input type="text" id="link-text" placeholder="${chrome.i18n.getMessage('linkTextPlaceholder')}" value="${previousText}">
                </div>
                <div class="form-group">
                    <label for="link-url">${chrome.i18n.getMessage('urlLabel')}</label>
                    <input type="text" id="link-url" placeholder="${chrome.i18n.getMessage('urlPlaceholder')}" value="${previousUrl}">
                </div>
                <div class="modal-actions">
                    <div class="left-actions">
                        <button class="unlink-btn">${chrome.i18n.getMessage('unlinkButton')}</button>
                    </div>
                    <div class="right-actions">
                        <button class="cancel-btn">${chrome.i18n.getMessage('cancel')}</button>
                        <button class="save-btn">${chrome.i18n.getMessage('save')}</button>
                    </div>
                </div>
            `;

            overlay.appendChild(modal);
            (rootNode || document.body).appendChild(overlay);

            const urlInput = modal.querySelector('#link-url');
            const textInput = modal.querySelector('#link-text');
            const saveBtn = modal.querySelector('.save-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');
            const unlinkBtn = modal.querySelector('.unlink-btn');

            urlInput.focus();
            urlInput.select();

            const cleanup = () => {
                document.removeEventListener('keydown', handleEsc, true);
                overlay.remove();
            };

            const handleSave = () => {
                cleanup();
                resolve({ url: urlInput.value, text: textInput.value });
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            const handleUnlink = () => {
                cleanup();
                resolve('');
            };
            
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancel();
                }
            };

            saveBtn.addEventListener('click', handleSave);
            cancelBtn.addEventListener('click', handleCancel);
            unlinkBtn.addEventListener('click', handleUnlink);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    handleCancel();
                }
            });
            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                }
            });
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                }
            });
            
            document.addEventListener('keydown', handleEsc, true);
        });
    }

    async function promptForLink(editor) {
        editor.chain().focus().extendMarkRange('link').run();

        const { state } = editor;
        const { from, to } = state.selection;
        
        const selectedText = state.doc.textBetween(from, to, ' ');
        const previousUrl = editor.getAttributes('link').href || '';
        
        const result = await showLinkEditor(previousUrl, selectedText, editor.rootNode);

        if (result === null) {
            editor.chain().focus().setTextSelection({ from: to, to: to }).run();
            return;
        }

        if (result === '') {
            editor.chain().focus().unsetLink().run();
            return;
        }

        let { url, text } = result;

        const linkText = text.trim() || url;
        if (!linkText) {
            return;
        }

        if (url && !/^(https?:\/\/|mailto:|ftp:)/i.test(url)) {
            url = 'https://' + url;
        }

        editor.chain().focus()
            .insertContent(linkText)
            .setTextSelection({ from: from, to: from + linkText.length })
            .setLink({ href: url })
            .run();
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

            sidebar.addEventListener('transitionend', () => {
                sidebar.remove();
                document.body.classList.remove('highlighter-sidebar-open');
            }, { once: true });
        } else {
            chrome.storage.sync.get({ sidebarWidth: 420 }, (data) => {
                const initialWidth = Math.max(data.sidebarWidth, MIN_WIDTH);
                sidebar = document.createElement('iframe');
                sidebar.id = SIDEBAR_ID;
                sidebar.src = chrome.runtime.getURL('sidebar.html');
                sidebar.style.width = `${initialWidth}px`;
                document.body.appendChild(sidebar);
                
                document.body.classList.add('highlighter-sidebar-open');
                
                void sidebar.offsetWidth; 

                sidebar.style.transform = 'translateX(0)';
                document.body.style.marginRight = `${initialWidth}px`;
            });
        }
    }

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
            const settings = window.highlighterInstance ? window.highlighterInstance.settings : { useDarkText: false };

            if (annotation.type === 'highlight') {
                const colorWithOpacity = annotation.color.startsWith('#') ? `${annotation.color}80` : annotation.color;
                element.style.backgroundColor = colorWithOpacity;
                element.style.borderBottom = 'none';
            } else { // underline
                const solidColor = annotation.color.replace(')', '-solid)');
                element.style.backgroundColor = 'transparent';
                element.style.borderBottom = `2px solid ${solidColor}`;
            }

            element.style.textShadow = 'none';

            // During initial wrapping, `element` is not in the DOM, so we check the `nodeContext`.
            // `nodeContext` is the text node being wrapped.
            const parentLink = nodeContext && (nodeContext.nodeType === Node.TEXT_NODE ? nodeContext.parentNode.closest('a') : nodeContext.closest('a'));
            const linksInElement = element.getElementsByTagName('a');

            if (settings.useDarkText && annotation.type === 'highlight') {
                const colorNameMatch = annotation.color.match(/--highlighter-color-([a-z]+)/);
                const textColorVar = (colorNameMatch && colorNameMatch[1])
                    ? `var(--highlighter-color-text-${colorNameMatch[1]})`
                    : '#1a1a1a'; // Fallback

                if (parentLink) {
                    // If the highlight is inside a link, it should have the link color.
                    element.style.setProperty('color', 'var(--highlighter-color-text-link)', 'important');
                } else {
                    // Otherwise, it gets the standard text color for the highlight.
                    element.style.setProperty('color', textColorVar, 'important');
                }

                // And any links nested inside the highlight also get the link color.
                for (const link of linksInElement) {
                    link.style.setProperty('color', 'var(--highlighter-color-text-link)', 'important');
                }
            } else {
                element.style.removeProperty('color');
                for (const link of linksInElement) {
                    link.style.removeProperty('color');
                }

                const isLink = parentLink || element.querySelector('a');

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
                
                if (!nodeRange.collapsed && nodeRange.toString().trim() !== '') {
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
            
            for (let i = allElements.length - 1; i >= 0; i--) {
                const el = allElements[i];
                if (allowedTags.includes(el.tagName)) {
                    while (el.attributes.length > 0) {
                        el.removeAttribute(el.attributes[0].name);
                    }
                } else {
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
            
            while (startContainer.nodeType === Node.TEXT_NODE && startOffset < startContainer.length && /\s/.test(startContainer.data[startOffset])) {
                startOffset++;
            }

            while (endContainer.nodeType === Node.TEXT_NODE && endOffset > 0 && /\s/.test(endContainer.data[endOffset - 1])) {
                endOffset--;
            }

            const newRange = document.createRange();
            newRange.setStart(startContainer, startOffset);
            newRange.setEnd(endContainer, endOffset);
            
            if (!newRange.collapsed && newRange.toString().trim() === '') {
                newRange.collapse(true);
            }
            
            return newRange;
        }
    }

    class HighlightStorage {
        constructor() {
            this.annotationKeyPrefix = 'highlighter-annotation-';
            this.paramWhitelist = {};
            this._loadWhitelist();
        }

        _loadWhitelist() {
            const url = chrome.runtime.getURL('param-whitelist.json');
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    this.paramWhitelist = data;
                })
                .catch(error => {
                    console.error('Highlighter: Could not load or parse param-whitelist.json. Using empty whitelist.', error);
                    this.paramWhitelist = {};
                });
        }
        
        getPageUrl() { // Renamed from getKey for clarity
            const url = new URL(window.location.href);
            const hostname = url.hostname;
            // Normaliza el pathname para eliminar la barra final si no es la raíz
            const pathname = url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
            
            let pageUrl = `${hostname}${pathname}`;

            if (this.paramWhitelist[hostname]) {
                const paramsToKeep = this.paramWhitelist[hostname];
                const searchParams = new URLSearchParams(url.search);
                const keptParams = [];

                searchParams.forEach((value, key) => {
                    if (paramsToKeep.includes(key)) {
                        keptParams.push(`${key}=${value}`);
                    }
                });

                // Ordena los parámetros para asegurar una clave consistente sin importar el orden
                if (keptParams.length > 0) {
                    pageUrl += `?${keptParams.sort().join('&')}`;
                }
            }

            return pageUrl;
        }

        generateId() { return `h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
        
        saveAnnotation(annotation, callback) {
            const key = `${this.annotationKeyPrefix}${annotation.id}`;
            const dataToSave = { [key]: annotation }; // No JSON.stringify needed, storage API handles objects
            
            chrome.storage.sync.set(dataToSave, () => {
                if (chrome.runtime.lastError) {
                    // Use a case-insensitive check for "quota" to make it more robust
                    if (chrome.runtime.lastError.message.toLowerCase().includes('quota')) {
                         console.warn(`Highlighter: Annotation ${annotation.id} is too large to sync. Storing locally instead.`, chrome.runtime.lastError.message);
                         
                         // Dispatch event for the UI to handle the toast notification
                         document.body.dispatchEvent(new CustomEvent('annotation-saved-locally', {
                            detail: { annotationId: annotation.id }
                         }));

                         // Fallback to local storage for this single item
                         chrome.storage.local.set(dataToSave, callback);
                    } else {
                        console.error("Error saving annotation:", chrome.runtime.lastError);
                    }
                } else {
                     if (callback) callback();
                }
            });
        }

        removeAnnotation(annotationId, callback) {
            const key = `${this.annotationKeyPrefix}${annotationId}`;
            // Try removing from both sync and local, in case it was a large annotation
            chrome.storage.sync.remove(key, () => {
                 chrome.storage.local.remove(key, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error removing annotation:", chrome.runtime.lastError);
                    }
                    if (callback) callback();
                 });
            });
        }

        load(callback) {
            const pageUrl = this.getPageUrl();
            const annotations = new Map();

            const processResults = (items) => {
                for (const key in items) {
                    if (key.startsWith(this.annotationKeyPrefix)) {
                        const annotation = items[key];
                        if (annotation && annotation.pageUrl === pageUrl) {
                            annotations.set(annotation.id, annotation);
                        }
                    }
                }
            };

            // Chain the storage gets to avoid race conditions.
            chrome.storage.sync.get(null, (syncItems) => {
                if (chrome.runtime.lastError) {
                    console.error("Error loading sync annotations:", chrome.runtime.lastError);
                } else {
                    processResults(syncItems);
                }

                chrome.storage.local.get(null, (localItems) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error loading local annotations:", chrome.runtime.lastError);
                    } else {
                        processResults(localItems);
                    }
                    
                    callback(annotations);
                });
            });
        }
    }

    class HighlightMenu {
        constructor() {
            this.host = document.createElement('div');
            this.host.id = 'highlighter-host';
            document.body.appendChild(this.host);

            this.shadowRoot = this.host.attachShadow({ mode: 'open' });

            fetch(chrome.runtime.getURL('style.css'))
                .then(response => response.text())
                .then(css => {
                    const style = document.createElement('style');
                    style.textContent = css;
                    this.shadowRoot.appendChild(style);
                }).catch(err => console.error("Highlighter: Failed to load styles.", err));

            this.element = document.createElement('div');
            this.element.className = 'highlighter-menu';
            this.shadowRoot.appendChild(this.element);

            this.arrowElement = null;
            this.referenceEl = null;
            this.currentPlacement = null;
            this.lastHeight = 0;

            this.closeButton = document.createElement('button');
            this.closeButton.className = 'highlighter-close-btn';
            this.closeButton.innerHTML = '&#x2715;';
            this.shadowRoot.appendChild(this.closeButton);

            this.contextMenu = document.createElement('div');
            this.contextMenu.className = 'highlighter-context-menu';
            this.contextMenu.style.display = 'none';
            this.shadowRoot.appendChild(this.contextMenu);

            this.resizeObserver = new ResizeObserver((entries) => {
                if (!this.isVisible() || !entries.length) return;

                const newHeight = this.element.offsetHeight;

                if (this.currentPlacement && this.currentPlacement.startsWith('top') && this.lastHeight > 0) {
                    const heightDifference = newHeight - this.lastHeight;
                    this.element.style.top = `${parseFloat(this.element.style.top) - heightDifference}px`;
                }

                this.lastHeight = newHeight;
                this.updateCloseButtonPosition();
            });
        }

        updateCloseButtonPosition() {
            const placement = this.currentPlacement?.startsWith('top') ? 'right-end' : 'bottom-end';

            computePosition(this.element, this.closeButton, {
                placement: placement,
                middleware: [offset(1.5)],
            }).then(({ x, y }) => {
                Object.assign(this.closeButton.style, { left: `${x}px`, top: `${y}px` });
            });
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
        
            this.element.innerHTML = `<div id="highlighter-arrow"></div>${colorsHTML}${typesHTML}${commentBoxHTML}${actionsHTML}`;
            this.arrowElement = this.element.querySelector('#highlighter-arrow');
        
            this.element.onmousedown = (e) => {
                const button = e.target.closest('button');
                if (!button) return;

                const editorProseMirror = this.element.querySelector('.ProseMirror');
                if (editorProseMirror && editorProseMirror.matches(':focus-within')) {
                    e.preventDefault();
                }

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
                    
                    commentBoxWrapper.addEventListener('keydown', (e) => {
                        if (e.ctrlKey || e.altKey || e.metaKey || 
                            ['Escape', 'Tab', 'Backspace', 'Delete'].includes(e.key)) {
                            return;
                        }
                        e.stopPropagation();
                    });

                    if (config.callbacks.onCommentMousedown) {
                         commentBoxWrapper.addEventListener('mousedown', config.callbacks.onCommentMousedown);
                     }
                }

                if (config.callbacks.onCommentBoxReady) {
                    setTimeout(() => config.callbacks.onCommentBoxReady(), 0);
                }
            }
        }

        _createButtons(buttons) {
            return buttons.map(btn => `<button title="${btn.label}" data-action="${btn.action}" ${btn.value ? `data-value="${btn.value}"` : ''} class="${btn.className || ''}">${btn.content || ''}</button>`).join('');
        }

        async updatePosition(referenceEl) {
            if (!this.isVisible() || !referenceEl) return;
            this.referenceEl = referenceEl;

            const { x, y, placement, middlewareData } = await computePosition(referenceEl, this.element, {
                placement: 'bottom',
                middleware: [offset(12), flip(), shift({ padding: 10 }), arrow({ element: this.arrowElement })],
            });

            this.currentPlacement = placement;
            Object.assign(this.element.style, { left: `${x}px`, top: `${y}px` });

            this.lastHeight = this.element.offsetHeight;

            const commentBoxWrapper = this.element.querySelector('.highlighter-comment-box-wrapper');
            if (commentBoxWrapper) {
                commentBoxWrapper.classList.toggle('toolbar-on-top', this.currentPlacement?.startsWith('top'));
            }

            const { x: arrowX, y: arrowY } = middlewareData.arrow;
            const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[placement.split('-')[0]];
            Object.assign(this.arrowElement.style, {
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                [staticSide]: '-4px',
            });
        }

        async show(referenceEl, contextMenuCallbacks) {
            this.hideContextMenu();
            this.element.classList.remove('closing');
            this.element.style.animation = 'popup-bounce-in 150ms ease-out forwards';
            this.element.classList.add('show');
            
            this.resizeObserver.observe(this.element);

            await this.updatePosition(referenceEl);

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
                this.lastHeight = 0;
                this.currentPlacement = null;
                this.referenceEl = null;

                this.element.style.animation = 'popup-bounce-out 150ms ease-in forwards';
                this.element.classList.add('closing');
                this.closeButton.classList.remove('show');
                this.closeButton.classList.add('closing');
                
                this.element.addEventListener('animationend', (e) => {
                    if (e.animationName === 'popup-bounce-out') {
                        this.element.classList.remove('show');
                        this.element.classList.remove('closing');
                        this.closeButton.classList.remove('closing');
                        this.hideContextMenu();
                        resolve();
                    }
                }, { once: true });
            });
        }

        showContextMenu(callbacks) {
            const sidebarOpen = document.getElementById(SIDEBAR_ID);
            const toggleSidebarText = sidebarOpen ? chrome.i18n.getMessage('closeSidebar') : chrome.i18n.getMessage('openSidebar');

            this.contextMenu.innerHTML = `
                <button data-action="hide">${chrome.i18n.getMessage('hideUntilNextVisit')}</button>
                <button data-action="disablePage">${chrome.i18n.getMessage('disableOnThisPage')}</button>
                <button data-action="disableSite">${chrome.i18n.getMessage('disableOnThisWebsite')}</button>
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

    class DonationManager {
        constructor(shadowRoot) {
            this.shadowRoot = shadowRoot;
            this.storageKeys = {
                count: 'highlighter-annotation-count',
                neverShow: 'highlighter-donation-never-show',
                remindAt: 'highlighter-donation-remind-at',
                disabledUntil: 'highlighter-donation-disabled-until'
            };
        }
    
        processNewAnnotation() {
            const storageKeysToGet = [
                this.storageKeys.count,
                this.storageKeys.neverShow,
                this.storageKeys.remindAt,
                this.storageKeys.disabledUntil
            ];

            chrome.storage.sync.get(storageKeysToGet, (data) => {
                if (chrome.runtime.lastError) {
                    console.error("Highlighter: Error getting data for annotation count.", chrome.runtime.lastError);
                    return;
                }

                const neverShow = data[this.storageKeys.neverShow] || false;
                if (neverShow) return;
    
                const disabledUntil = data[this.storageKeys.disabledUntil] || 0;
                const currentCount = data[this.storageKeys.count] || 0;
                const newCount = currentCount + 1;
    
                chrome.storage.sync.set({ [this.storageKeys.count]: newCount }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Highlighter: Error saving new annotation count.", chrome.runtime.lastError);
                        return;
                    }
                    
                    let remindAt = data[this.storageKeys.remindAt] || 10;

                    if (Date.now() >= disabledUntil && currentCount >= remindAt) {
                        const newRemindAt = newCount + 1;
                        chrome.storage.sync.set({ [this.storageKeys.remindAt]: newRemindAt });
                        remindAt = newRemindAt;
                    }

                    if (newCount >= remindAt && Date.now() >= disabledUntil) {
                        this.showModal(newCount);
                    }
                });
            });
        }

        showModal(currentCount) {
            const overlay = document.createElement('div');
            overlay.className = 'highlighter-modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'highlighter-donation-modal';
            modal.innerHTML = `
                <div class="heading-wrapper">
                    <img src="${chrome.runtime.getURL('images/icon128.png')}" alt="Highlighter Icon">
                    <h3>${chrome.i18n.getMessage('donationsTitle')}</h3>
                    <button class="close-modal-btn" title="${chrome.i18n.getMessage('close')}">&times;</button>
                </div>
                <p>${chrome.i18n.getMessage('donationsText')}</p>
                <div class="donations-grid">
                    <div class="donation-card donation-card-onetime">
                        <div class="donation-card-content">
                            <h4>${chrome.i18n.getMessage('oneTimeDonationTitle')}</h4>
                            <p>${chrome.i18n.getMessage('oneTimeDonationDescription')}</p>
                        </div>
                        <a href="https://www.paypal.com/ncp/payment/P8GZGDP6GQBB2" target="_blank" class="donation-button">
                            <img src="${chrome.runtime.getURL('images/paypal-logo.svg')}" alt="PayPal" class="paypal-logo">
                            <span>${chrome.i18n.getMessage('oneTimeDonationButton')}</span>
                        </a>
                    </div>
                    <div class="donation-card donation-card-subscription">
                        <div class="donation-card-content">
                            <h4>${chrome.i18n.getMessage('monthlySubscriptionTitle')}</h4>
                            <p>${chrome.i18n.getMessage('monthlySubscriptionDescription')}</p>
                        </div>
                        <a href="https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-2CW39197CN079424VNCCCAAQ" target="_blank" class="donation-button">
                            <img src="${chrome.runtime.getURL('images/paypal-logo.svg')}" alt="PayPal" class="paypal-logo">
                            <span>${chrome.i18n.getMessage('subscribeButton')}</span>
                        </a>
                    </div>
                </div>
                <div class="modal-actions">
                    <div class="left-actions">
                         <button class="never-remind-btn">${chrome.i18n.getMessage('dontRemindAgain')}</button>
                    </div>
                    <div class="right-actions">
                        <button class="remind-later-btn">${chrome.i18n.getMessage('remindMeLater')}</button>
                    </div>
                </div>
            `;

            overlay.appendChild(modal);
            this.shadowRoot.appendChild(overlay);

            let tooltip = null;

            const cleanup = () => {
                if (tooltip) tooltip.remove();
                document.removeEventListener('keydown', handleEsc, true);
                overlay.remove();
            };

            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    const nextReminder = currentCount + 80;
                    chrome.storage.sync.set({ [this.storageKeys.remindAt]: nextReminder });
                    cleanup();
                }
            };

            modal.querySelectorAll('.donation-button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const disabledUntil = Date.now() + (180 * 24 * 60 * 60 * 1000);
                    chrome.storage.sync.set({ [this.storageKeys.disabledUntil]: disabledUntil });
            
                    setTimeout(() => {
                        modal.innerHTML = `
                            <div class="highlighter-thank-you-content">
                                <div class="thank-you-animation">
                                    <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                        <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                                        <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                                    </svg>
                                </div>
                                <h3>${chrome.i18n.getMessage('donationThanksTitle')}</h3>
                                <p>${chrome.i18n.getMessage('donationThanksText')}</p>
                                <button class="close-thank-you-btn">${chrome.i18n.getMessage('close')}</button>
                            </div>
                        `;
                        modal.querySelector('.close-thank-you-btn').addEventListener('click', cleanup);
                    }, 100);
                });
            });

            const remindLaterBtn = modal.querySelector('.remind-later-btn');
            const closeModalBtn = modal.querySelector('.close-modal-btn');

            remindLaterBtn.addEventListener('click', () => {
                const nextReminder = currentCount + 80;
                chrome.storage.sync.set({ [this.storageKeys.remindAt]: nextReminder });
                cleanup();
            });

            closeModalBtn.addEventListener('click', () => {
                const nextReminder = currentCount + 80;
                chrome.storage.sync.set({ [this.storageKeys.remindAt]: nextReminder });
                cleanup();
            });

            const setupTooltip = () => {
                const createTooltip = () => {
                    if (tooltip) return;
                    tooltip = document.createElement('div');
                    tooltip.className = 'highlighter-dynamic-tooltip';
                    tooltip.textContent = chrome.i18n.getMessage('remindMeLaterTooltip');
                    this.shadowRoot.appendChild(tooltip);
                    tooltip.addEventListener('animationend', (e) => {
                        if (tooltip && tooltip.classList.contains('popup-bounce-out')) {
                            e.target.classList.remove('popup-bounce-in', 'popup-bounce-out');
                            e.target.style.display = 'none';
                        }
                    });
                };

                const updateTooltipPosition = (event) => {
                    if (!tooltip) return;
                    const virtualEl = {
                        getBoundingClientRect: () => ({
                            width: 0, height: 0,
                            x: event.clientX, y: event.clientY,
                            left: event.clientX, right: event.clientX,
                            top: event.clientY, bottom: event.clientY,
                        }),
                    };
                    computePosition(virtualEl, tooltip, {
                        placement: 'top',
                        middleware: [offset(15), flip(), shift({ padding: 5 })],
                    }).then(({ x, y }) => {
                        Object.assign(tooltip.style, { left: `${x}px`, top: `${y}px` });
                    });
                };

                remindLaterBtn.addEventListener('mouseover', (event) => {
                    createTooltip();
                    tooltip.style.display = 'block';
                    updateTooltipPosition(event);
                    tooltip.classList.remove('popup-bounce-out');
                    tooltip.classList.add('popup-bounce-in');
                });

                remindLaterBtn.addEventListener('mouseout', () => {
                    if (tooltip) {
                        tooltip.classList.remove('popup-bounce-in');
                        tooltip.classList.add('popup-bounce-out');
                    }
                });

                remindLaterBtn.addEventListener('mousemove', updateTooltipPosition);
            };

            setupTooltip();

            modal.querySelector('.never-remind-btn').addEventListener('click', () => {
                chrome.storage.sync.set({ [this.storageKeys.neverShow]: true });
                cleanup();
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                }
            });

            document.addEventListener('keydown', handleEsc, true);
        }
    }

    class Highlighter {
        constructor(initialSettings) {
            this.settings = initialSettings || { useDarkText: false };
            this.storage = new HighlightStorage();
            this.menu = new HighlightMenu();
            this.donationManager = new DonationManager(this.menu.shadowRoot);
            this.annotations = new Map();
            this.colors = {
                yellow: 'var(--highlighter-color-yellow)', red: 'var(--highlighter-color-red)',
                green: 'var(--highlighter-color-green)', blue: 'var(--highlighter-color-blue)',
                purple: 'var(--highlighter-color-purple)', pink: 'var(--highlighter-color-pink)',
                orange: 'var(--highlighter-color-orange)', grey: 'var(--highlighter-color-grey)',
            };
            this.solidColors = {
                yellow: 'var(--highlighter-color-yellow-solid)', red: 'var(--highlighter-color-red-solid)',
                green: 'var(--highlighter-color-green-solid)', blue: 'var(--highlighter-color-blue-solid)',
                purple: 'var(--highlighter-color-purple-solid)', pink: 'var(--highlighter-color-pink-solid)',
                orange: 'var(--highlighter-color-orange-solid)', grey: 'var(--highlighter-color-grey-solid)',
            };
            this.currentAnnotationType = 'highlight';
            this.isTemporarilyHidden = false;
            this.isGloballyDisabled = false;
            this.activeDebouncedUpdate = null;
            this.tiptapEditor = null;
            this.tiptapToolbarPopup = null;
            this.bodyObserver = null;
            this.titleObserver = null;
            this.debouncedReapply = null;
            this.isCreatingAnnotation = false;
            this.currentUrl = this.storage.getPageUrl();

            this.storage.load((loadedAnnotations) => {
                this.annotations = loadedAnnotations;
                this._loadAnnotations();
            });
            this._setupEventListeners();
            this._setupMutationObserver();
        }

        disableGlobally() {
            this.isGloballyDisabled = true;
            this.menu.hide();
            document.querySelectorAll('.highlighter-mark').forEach(el => DOMManager.unwrap(el));
        }

        enableGlobally() {
            this.isGloballyDisabled = false;
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

        _setupEventListeners() {
            document.addEventListener('mouseup', this._onMouseUp.bind(this));
            document.addEventListener('mousedown', this._onMouseDown.bind(this), true);
            document.addEventListener('keydown', this._onKeyDown.bind(this));

            // Listen for URL changes in SPAs
            window.addEventListener('popstate', this._handleURLChange.bind(this));
            window.addEventListener('urlchange', this._handleURLChange.bind(this));

            // Listen for custom event to show local storage toast
            document.body.addEventListener('annotation-saved-locally', () => this._showLocalStorageToast());

            document.addEventListener('keydown', (event) => {
                if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'h') {
                    setTimeout(() => {
                        if (event.defaultPrevented) {
                            return;
                        }
                        toggleSidebar();
                    }, 0);
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Control') {
                    document.body.classList.add('ctrl-is-pressed');
                }
            });
            document.addEventListener('keyup', (e) => {
                if (e.key === 'Control') {
                    document.body.classList.remove('ctrl-is-pressed');
                }
            });
            window.addEventListener('blur', () => {
                document.body.classList.remove('ctrl-is-pressed');
            });
        }

        _handleURLChange() {
            // Use a short timeout to allow the SPA to update its content
            setTimeout(async () => {
                const newUrl = this.storage.getPageUrl();
                if (newUrl === this.currentUrl) {
                    return; // URL hasn't actually changed
                }
                this.currentUrl = newUrl;

                if (this.bodyObserver) this.bodyObserver.disconnect();
                
                await this._closeOrFinalizeContextMenu();
                
                // Clear old highlights from the DOM
                document.querySelectorAll('.highlighter-mark').forEach(el => DOMManager.unwrap(el));
                
                // Reset internal state
                this.annotations = new Map();
                this._notifySidebarOfUpdate(); // Notify sidebar with empty list

                // Load annotations for the new URL
                this.storage.load((loadedAnnotations) => {
                    this.annotations = loadedAnnotations;
                    this._loadAnnotations();
                    this._notifySidebarOfUpdate(); // Send new data to sidebar
                });

                if (this.bodyObserver) {
                    this.bodyObserver.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }
            }, 100); // 100ms delay as a safeguard
        }

        async _onKeyDown(event) {
            if (this.isGloballyDisabled || this.isTemporarilyHidden) return;
            
            const activeEl = this.menu.shadowRoot.activeElement || document.activeElement;
            const isEditable = activeEl.isContentEditable || activeEl.matches('input, textarea, select');

            if (event.key === 'Escape') {
                if (this.activeAnnotationId) {
                    if (isEditable) {
                        activeEl.blur();
                    } else {
                        await this._closeOrFinalizeContextMenu();
                    }
                } else {
                    window.getSelection()?.removeAllRanges();
                    this.menu.hide();
                    this.activeRange = null;
                }
            }
            if (event.key === 'Delete' && this.activeAnnotationId && !isEditable) {
                await this.deleteAnnotation();
            }

            if (event.ctrlKey && (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'x')) {
                if (!this.menu.isVisible()) return;

                if (event.composedPath().includes(this.menu.host)) {
                    return;
                }

                setTimeout(() => {
                    if (window.getSelection().toString()) {
                        window.getSelection()?.removeAllRanges();
                    }
                    this.menu.hide();
                    this.activeRange = null;
                }, 10);
            }
        }

        async _onMouseDown(event) {
            if (this.isGloballyDisabled || this.isTemporarilyHidden) return;
            
            const target = event.composedPath()[0] || event.target;
            if (target === this.menu.host || this.menu.host.contains(target)) {
                return;
            }

            const annotationEl = target.closest('.highlighter-mark');
            if (annotationEl) {
                event.preventDefault();
                event.stopPropagation();
                if (this.activeAnnotationId && this.activeAnnotationId !== annotationEl.dataset.annotationId) {
                    await this._closeOrFinalizeContextMenu();
                }
                this._showContextMenuFor(annotationEl);
            }
        }

        async _onMouseUp(event) {
            if (this.isCreatingAnnotation) return;
            
            if (this.isDraggingInCommentBox) {
                this.isDraggingInCommentBox = false;
                return;
            }

            const target = event.composedPath()[0] || event.target;
            if (this.isGloballyDisabled || this.isTemporarilyHidden || event.composedPath().includes(this.menu.host) || target.closest('.highlighter-mark')) {
                return;
            }
            
            setTimeout(async () => {
                if (this.activeAnnotationId) {
                    await this._closeOrFinalizeContextMenu();
                }

                const selection = window.getSelection();
                if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                    if (this.activeRange) {
                        this.menu.hide();
                        this.activeRange = null;
                    }
                    return;
                }

                // Do not show menu in editable areas
                const container = selection.getRangeAt(0).commonAncestorContainer;
                const elementContainer = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
                if (elementContainer && elementContainer.closest('textarea, input, [contenteditable="true"]')) {
                    return;
                }
                
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
                        action: 'create', value: color, label: chrome.i18n.getMessage(`colors_${name}`), className: 'highlighter-color-selector', content: `<div style="width:100%; height:100%; background-color:${this.solidColors[name]}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'setType', value: 'highlight', label: chrome.i18n.getMessage('highlight'), content: 'A', className: `highlighter-type-selector ${this.currentAnnotationType === 'highlight' ? 'active' : ''}` },
                        { action: 'setType', value: 'underline', label: chrome.i18n.getMessage('underline'), content: '<span class="underline">A</span>', className: `highlighter-type-selector ${this.currentAnnotationType === 'underline' ? 'active' : ''}` }
                    ]
                }
            });
            this.menu.show({ getBoundingClientRect: () => rect }, this._getContextMenuCallbacks());
        }

        _showContextMenuFor(element, forceOpen = false) {
            const annotationId = element.dataset.annotationId;
            if (!forceOpen && this.activeAnnotationId === annotationId) {
                this._closeOrFinalizeContextMenu();
                return;
            }
            if (this.activeAnnotationId) {
                this._closeOrFinalizeContextMenu();
            }
            this.activeAnnotationId = annotationId;
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
                    <div class="highlighter-comment-box-wrapper">
                        <div id="${editorElementId}" class="tiptap-editor"></div>
                        <div id="${toolbarElementId}" class="tiptap-toolbar"></div>
                    </div>
                </div>
            `;
        
            this.menu.configure({
                callbacks: {
                    changeColor: (color) => this.updateAnnotation({ color }),
                    changeType: (type) => this.updateAnnotation({ type }),
                    delete: () => this.deleteAnnotation(),
                    onCommentMousedown: () => {
                        this.isDraggingInCommentBox = true;
                    },
                    onCommentBoxReady: () => {
                        const editorElement = this.menu.shadowRoot.getElementById(editorElementId);
                        const toolbarElement = this.menu.shadowRoot.getElementById(toolbarElementId);
                        if (editorElement && toolbarElement && !this.tiptapEditor) {
                            this.tiptapEditor = setupTiptapEditor(
                                editorElement,
                                toolbarElement,
                                annotation.comment || '',
                                (html) => {
                                    if (this.activeDebouncedUpdate) {
                                        this.activeDebouncedUpdate(html);
                                    }
                                },
                                this.menu.shadowRoot
                            );
                            this.menu.updatePosition(element);
                        }
                    }
                },
                buttons: {
                    colors: Object.entries(this.colors).map(([name, color]) => ({
                        action: 'changeColor', value: color, label: chrome.i18n.getMessage(`colors_${name}`), className: `highlighter-color-selector ${annotation.color === color ? 'active' : ''}`, content: `<div style="width:100%; height:100%; background-color:${this.solidColors[name]}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'changeType', value: 'highlight', label: chrome.i18n.getMessage('highlight'), content: 'A', className: `highlighter-type-selector ${annotation.type === 'highlight' ? 'active' : ''}` },
                        { action: 'changeType', value: 'underline', label: chrome.i18n.getMessage('underline'), content: '<span class="underline">A</span>', className: `highlighter-type-selector ${annotation.type === 'underline' ? 'active' : ''}` }
                    ],
                    actions: [
                        { action: 'delete', label: chrome.i18n.getMessage('delete'), content: `<svg class="delete-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V6H17H19C19.5523 6 20 6.44772 20 7C20 7.55228 19.5523 8 19 8H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V8H5C4.44772 8 4 7.55228 4 7C4 6.44772 4.44772 6 5 6H7H9V5ZM10 8H8V18C8 18.5523 8.44772 19 9 19H15C15.5523 19 16 18.5523 16 18V8H14H10ZM13 6H11V5H13V6Z"/></svg><span>${chrome.i18n.getMessage('delete')}</span>`, className: 'highlighter-delete-btn' }
                    ]
                },
                commentBox: {
                    html: commentBoxHTML,
                }
            });
            this.menu.show(element, this._getContextMenuCallbacks());
        }

        async _closeOrFinalizeContextMenu() {
            if (!this.activeAnnotationId) {
                await this.menu.hide();
                return;
            }
        
            if (this.activeDebouncedUpdate) {
                this.activeDebouncedUpdate.cancel();
                this.activeDebouncedUpdate = null;
            }
        
            const annotation = this.annotations.get(this.activeAnnotationId);
        
            if (annotation && this.tiptapEditor) {
                const rawHtml = this.tiptapEditor.getHTML();
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = rawHtml;
        
                while (tempDiv.lastChild && tempDiv.lastChild.nodeType === 1 && tempDiv.lastChild.textContent.trim() === '' && tempDiv.lastChild.tagName !== 'BR') {
                    tempDiv.removeChild(tempDiv.lastChild);
                }
        
                while (tempDiv.firstChild && tempDiv.firstChild.nodeType === 1 && tempDiv.firstChild.textContent.trim() === '' && tempDiv.firstChild.tagName !== 'BR') {
                    tempDiv.removeChild(tempDiv.firstChild);
                }
                
                const sanitizedComment = tempDiv.innerHTML.trim();
        
                if (annotation.comment !== sanitizedComment) {
                    annotation.comment = sanitizedComment;
                    this.annotations.set(this.activeAnnotationId, annotation);
                    this.storage.saveAnnotation(annotation, () => {
                        this._notifySidebarOfUpdate();
                    });
                }
            }
            
            await this.menu.hide();

            if (this.tiptapToolbarPopup) {
                this.tiptapToolbarPopup.remove();
                this.tiptapToolbarPopup = null;
            }
            if (this.tiptapEditor) {
                this.tiptapEditor.destroy();
                this.tiptapEditor = null;
            }
        
            this.activeAnnotationId = null;
        }

        async toggleDisablePage(disable) {
            const url = window.location.href;
            const { disabledPages = [] } = await chrome.storage.sync.get('disabledPages');
            
            const wasDisabled = disabledPages.includes(url);

            if (disable && !wasDisabled) {
                disabledPages.push(url);
                await chrome.storage.sync.set({ disabledPages });
                this.disableGlobally();
            } else if (!disable && wasDisabled) {
                const index = disabledPages.indexOf(url);
                disabledPages.splice(index, 1);
                await chrome.storage.sync.set({ disabledPages });
                this.enableGlobally();
            }
        }

        async toggleDisableSite(disable) {
            const hostname = window.location.hostname;
            const { disabledSites = [] } = await chrome.storage.sync.get('disabledSites');

            const wasDisabled = disabledSites.includes(hostname);

            if (disable && !wasDisabled) {
                disabledSites.push(hostname);
                await chrome.storage.sync.set({ disabledSites });
                this.disableGlobally();
            } else if (!disable && wasDisabled) {
                const index = disabledSites.indexOf(hostname);
                disabledSites.splice(index, 1);
                await chrome.storage.sync.set({ disabledSites });
                this.enableGlobally();
            }
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

        _reapplyAnnotations() {
            if (this.isGloballyDisabled) return;
            if (this.bodyObserver) this.bodyObserver.disconnect();
        
            this.annotations.forEach(annotation => {
                if (document.querySelector(`[data-annotation-id="${annotation.id}"]`)) {
                    return;
                }
        
                const range = DOMManager.getRangeFromPointers(annotation.pointers);
                if (range) {
                    DOMManager.wrapRange(range, annotation);
                }
            });
        
            if (this.bodyObserver) {
                this.bodyObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        }

        _setupMutationObserver() {
            // For reapplying highlights on dynamic content changes (within the same URL)
            this.debouncedReapply = debounce(() => this._reapplyAnnotations(), 500);
            this.bodyObserver = new MutationObserver((mutations) => {
                let shouldReapply = false;
                for (const mutation of mutations) {
                    const targetId = mutation.target.id;
                    if (targetId === 'highlighter-host' || targetId === 'highlighter-sidebar-instance' || targetId === RESIZE_COVER_ID || targetId === RESIZE_GUIDE_ID) {
                        continue;
                    }
                    if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                        shouldReapply = true;
                        break;
                    }
                }
                if (shouldReapply) {
                    this.debouncedReapply();
                }
            });
            this.bodyObserver.observe(document.body, { childList: true, subtree: true });

            // For detecting SPA navigation by observing title changes
            const titleElement = document.querySelector('head > title');
            if (titleElement) {
                this.titleObserver = new MutationObserver(() => {
                    this._handleURLChange();
                });
                this.titleObserver.observe(titleElement, { childList: true });
            }
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
                        this.disableGlobally();
                        // Also notify the sidebar to update its switch state
                        chrome.runtime.sendMessage({ action: 'settingsChanged' });
                    });
                }
            });
        }

        disableForSite() {
            const href = window.location.href;
            try {
                const hostname = new URL(href).hostname;
                chrome.storage.sync.get({ disabledSites: [] }, (data) => {
                    const disabledSites = data.disabledSites;
                    if (!disabledSites.includes(hostname)) {
                        disabledSites.push(hostname);
                        chrome.storage.sync.set({ disabledSites }, () => {
                            this.disableGlobally();
                            chrome.runtime.sendMessage({ action: 'settingsChanged' });
                        });
                    }
                });
            } catch (e) {
                console.error("Highlighter: Could not parse URL to disable site.", e);
            }
        }

        enableForPage() {
            const href = window.location.href;
            chrome.storage.sync.get({ disabledPages: [] }, (data) => {
                let disabledPages = data.disabledPages.filter(page => page !== href);
                chrome.storage.sync.set({ disabledPages }, () => {
                    this.enableGlobally();
                    chrome.runtime.sendMessage({ action: 'settingsChanged' });
                });
            });
        }

        enableForSite() {
            const href = window.location.href;
            try {
                const hostname = new URL(href).hostname;
                chrome.storage.sync.get({ disabledSites: [] }, (data) => {
                    let disabledSites = data.disabledSites.filter(site => site !== hostname);
                    chrome.storage.sync.set({ disabledSites }, () => {
                        this.enableGlobally();
                        chrome.runtime.sendMessage({ action: 'settingsChanged' });
                    });
                });
            } catch (e) {
                console.error("Highlighter: Could not parse URL to enable site.", e);
            }
        }

        _loadAnnotations() {
            if (this.isTemporarilyHidden || this.isGloballyDisabled) return;
            this.annotations.forEach(annotation => {
                const range = DOMManager.getRangeFromPointers(annotation.pointers);
                if (range) DOMManager.wrapRange(range, annotation);
            });
        }

        _notifySidebarOfUpdate() {
            chrome.runtime.sendMessage({
                action: 'annotationsUpdated',
                url: this.currentUrl,
                data: Array.from(this.annotations.entries())
            });
        }

        async createAnnotation(color, type) {
            if (!this.activeRange) return;
            this.isCreatingAnnotation = true;
            const range = this.activeRange;
            this.activeRange = null;
            await this.menu.hide();

            const annotation = {
                id: this.storage.generateId(),
                pageUrl: this.storage.getPageUrl(),
                text: DOMManager.getSanitizedHtmlFromRange(range),
                pointers: DOMManager.getRangePointers(range),
                color: color,
                type: type,
                comment: '',
                createdAt: new Date().toISOString()
            };

            this.annotations.set(annotation.id, annotation);
            DOMManager.wrapRange(range, annotation);
            window.getSelection()?.removeAllRanges();

            this.storage.saveAnnotation(annotation, () => {
                this._notifySidebarOfUpdate();
                this.donationManager.processNewAnnotation();
                this.isCreatingAnnotation = false;
            });
        }

        updateAnnotation(updates, id = this.activeAnnotationId, isCommentUpdate = false) {
            if (!id) return;
            const annotation = this.annotations.get(id);
            if (!annotation) return;
        
            const hasChanged = Object.keys(updates).some(key => annotation[key] !== updates[key]);
            if (!hasChanged && !isCommentUpdate) return;
        
            Object.assign(annotation, updates);
            this.annotations.set(id, annotation);
        
            // Save the entire annotation whenever it's updated.
            this.storage.saveAnnotation(annotation, () => {
                if (!isCommentUpdate) { // Avoid spamming sidebar on every keystroke in comment
                    this._notifySidebarOfUpdate();
                }
            });
        
            document.querySelectorAll(`[data-annotation-id="${id}"]`).forEach(el => {
                DOMManager.applyAnnotationStyle(el, annotation, el);
            });
        
            // Update active class for color selectors
            if (updates.color) {
                const colorButtons = this.menu.element.querySelectorAll('.highlighter-color-selector');
                colorButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === updates.color);
                });
            }

            if (updates.type) {
                const typeButtons = this.menu.element.querySelectorAll('.highlighter-type-selector');
                typeButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === updates.type);
                });
            }
        }

        async deleteAnnotation(id = this.activeAnnotationId) {
            if (!id) return;
            const annotationIdToDelete = id;

            await this._closeOrFinalizeContextMenu();

            this.annotations.delete(annotationIdToDelete);
            document.querySelectorAll(`[data-annotation-id="${annotationIdToDelete}"]`).forEach(el => DOMManager.unwrap(el));

            this.storage.removeAnnotation(annotationIdToDelete, () => {
                this._notifySidebarOfUpdate();
            });
        }

        scrollToAnnotation(annotationId) {
            const elements = document.querySelectorAll(`.highlighter-mark[data-annotation-id="${annotationId}"]`);
            if (elements.length > 0) {
                elements[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

                elements.forEach(el => {
                    const originalTransition = el.style.transition;
                    el.style.transition = 'box-shadow 300ms ease-in-out';
                    el.style.boxShadow = '0 0 0 3px rgba(50, 150, 255, 0.7)';

                    setTimeout(() => {
                        el.style.boxShadow = 'none';
                        setTimeout(() => {
                            el.style.transition = originalTransition;
                        }, 300);
                    }, 1000);
                });
            }
        }

        _showLocalStorageToast() {
            const toastId = 'highlighter-local-save-toast';
            if (document.getElementById(toastId)) return; // Avoid multiple toasts

            const toast = document.createElement('div');
            toast.id = toastId;

            const message = document.createElement('span');
            message.textContent = chrome.i18n.getMessage('highlightSavedLocally') || 'Highlight saved locally (exceeds 8KB sync limit)';
            toast.appendChild(message);

            const closeButton = document.createElement('button');
            closeButton.innerHTML = '&times;';
            closeButton.className = 'highlighter-toast-close-btn';
            closeButton.onclick = () => {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove());
            };
            toast.appendChild(closeButton);
            
            document.body.appendChild(toast);

            // Fade in by adding the 'show' class
            setTimeout(() => toast.classList.add('show'), 100);

            // Fade out and remove
            const timeoutId = setTimeout(() => {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove());
            }, 10000); // 10 seconds

            // Ensure timeout is cleared if button is clicked
            closeButton.addEventListener('click', () => clearTimeout(timeoutId));
        }
    }

    function initializeHighlighter() {
    if (window.highlighterInstance) return;

    // Create instance immediately with default settings, but disabled.
    // This ensures the instance is available for the message listener.
    window.highlighterInstance = new Highlighter({});
    window.highlighterInstance.disableGlobally();

    // Asynchronously load settings and check if the highlighter should be enabled.
    chrome.storage.sync.get(['disabledSites', 'disabledPages', 'highlighter-settings'], (data) => {
        const settings = data['highlighter-settings'] || {};
        window.highlighterInstance.updateSettings(settings);

        const disabledSites = data.disabledSites || [];
        const disabledPages = data.disabledPages || [];
        const hostname = window.location.hostname;
        const isDisabled = disabledSites.includes(hostname) || disabledPages.includes(window.location.href);

        if (isDisabled) {
            console.log(`Highlighter is disabled on ${hostname}`);
        } else {
            window.highlighterInstance.enableGlobally();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHighlighter);
} else {
    initializeHighlighter();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Helper to handle enable/disable actions
    const handleToggle = async (type, disable) => {
        const key = type === 'page' ? 'disabledPages' : 'disabledSites';
        const value = type === 'page' ? window.location.href : window.location.hostname;
        
        const data = await chrome.storage.sync.get(key);
        const list = data[key] || [];
        const wasDisabled = list.includes(value);

        if (disable && !wasDisabled) {
            list.push(value);
            await chrome.storage.sync.set({ [key]: list });
            if (window.highlighterInstance) {
                window.highlighterInstance.disableGlobally();
            }
        } else if (!disable && wasDisabled) {
            const index = list.indexOf(value);
            list.splice(index, 1);
            await chrome.storage.sync.set({ [key]: list });
            // Re-enable the highlighter instantly without reloading
            if (window.highlighterInstance) {
                window.highlighterInstance.enableGlobally();
            }
        }
        sendResponse({ status: 'ok' });
    };

    // For actions that require the highlighter instance
    if (window.highlighterInstance) {
        switch (request.action) {
            case 'getAnnotations':
                sendResponse({ data: Array.from(window.highlighterInstance.annotations.entries()) });
                return;
            case 'scrollToAnnotation':
                window.highlighterInstance.scrollToAnnotation(request.annotationId);
                sendResponse({ status: 'scrolling' });
                return;
            case 'deleteAnnotation':
                window.highlighterInstance.deleteAnnotation(request.annotationId, true)
                    .then(() => sendResponse({ status: 'deleted' }));
                return true; // Keep channel open for async response
            case 'settingChanged':
                window.highlighterInstance.updateSettings(request.settings);
                sendResponse({ status: 'settings updated' });
                return;
        }
    }

    // For actions that can run regardless of the highlighter instance
    switch (request.action) {
        case 'toggleSidebar':
            toggleSidebar();
            sendResponse({ status: 'sidebar toggled' });
            break;
        case 'startSidebarResize':
            startSidebarResize();
            sendResponse({ status: 'resize started' });
            break;
        case 'getSidebarWidth':
            const sidebar = document.getElementById(SIDEBAR_ID);
            sendResponse({ width: sidebar ? sidebar.offsetWidth : null });
            break;
        case 'setSidebarWidth':
            const sidebarEl = document.getElementById(SIDEBAR_ID);
            if (sidebarEl) {
                sidebarEl.style.width = `${request.width}px`;
                document.body.style.marginRight = `${request.width}px`;
            }
            sendResponse({ status: 'width set' });
            break;
        case 'getPageInfo':
            const title = document.querySelector('meta[property="og:title"]')?.content || document.title;
            const description = document.querySelector('meta[property="og:description"]')?.content || document.querySelector('meta[name="description"]')?.content;
            const image = document.querySelector('meta[property="og:image"]')?.content;
            let favicon = document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href;
            if (favicon && !favicon.startsWith('http')) {
                favicon = new URL(favicon, window.location.href).href;
            }
            sendResponse({
                title,
                description,
                image,
                favicon,
                url: window.location.href,
                domain: window.location.hostname
            });
            break;
        case 'toggleDisablePage':
            handleToggle('page', request.disable);
            return true; // Keep channel open for async response
        case 'toggleDisableSite':
            handleToggle('site', request.disable);
            return true; // Keep channel open for async response
        default:
            // This handles cases where the highlighterInstance might not be loaded,
            // preventing errors for actions that require it.
            if (window.highlighterInstance) {
                 sendResponse({ status: 'no action taken' });
            } else {
                 sendResponse({ error: 'Highlighter instance not available.' });
            }
            break;
    }
    return true; // Default to keeping channel open for async cases
});

})();