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
            const settings = window.highlighterInstance ? window.highlighterInstance.settings : { useDarkText: false, forceSolidHighlights: false };
            const solidColor = annotation.color.startsWith('#') ? annotation.color : annotation.color.replace(')', '-solid)');

            if (annotation.type === 'highlight') {
                const bodyBackgroundColor = window.getComputedStyle(document.body).backgroundColor;
                const isBodyLight = DOMManager.isColorLight(bodyBackgroundColor);

                let highlightColor;

                if (settings.forceSolidHighlights) {
                    highlightColor = solidColor;
                } else {
                    if (isBodyLight) {
                        // Light background, use normal semi-transparent color
                        highlightColor = annotation.color.startsWith('#') ? `${annotation.color}80` : annotation.color;
                    } else {
                        // Dark background, use solid color
                        highlightColor = solidColor;
                    }
                }
                element.style.backgroundColor = highlightColor;
                // Ancho 0 pero con el color de la anotación: al pasar a
                // subrayado, `transition: all` solo anima el ancho del borde.
                // Con 'none' el color computado era currentColor (el negro de
                // la tipografía) y el subrayado nacía oscuro y transicionaba
                // hacia su color.
                element.style.borderBottom = `0px solid ${solidColor}`;
            } else { // underline
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
                    // element.style.color = DOMManager.isColorLight(bodyColor) ? '#1a1a1a' : 'inherit';
                    element.style.color = DOMManager.isColorLight(bodyColor) ? 'inherit' : 'inherit';
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
                // Assume light background for transparent or invalid colors
                if (!colorString || colorString === 'transparent') return true;

                const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (!match) return true;

                // If alpha is 0, it's transparent, so treat as light.
                if (match[4] && parseFloat(match[4]) === 0) {
                    return true;
                }

                const [, r, g, b] = match.map(Number);
                return ((r * 299) + (g * 587) + (b * 114)) / 1000 > 155;
            } catch (e) { return true; } // Default to light on any error
        }

        static getSanitizedHtmlFromRange(range) {
            const allowedTags = ['B', 'STRONG', 'I', 'EM', 'P', 'BR'];
            const content = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(content);

            const allElements = tempDiv.querySelectorAll('*');
            
            for (let i = allElements.length - 1; i >= 0; i--) {
                const el = allElements[i];
                if (allowedTags.includes(el.tagName.toUpperCase())) {
                    while (el.attributes.length > 0) {
                        el.removeAttribute(el.attributes[0].name);
                    }
                } else {
                    const parent = el.parentNode;
                    while (el.firstChild) {
                        parent.insertBefore(el.firstChild, el);
                    }
                    if (parent) parent.removeChild(el);
                }
            }
            
            let html = tempDiv.innerHTML;
            // Replace P tags with double line breaks and clean up
            html = html.replace(/<p>/gi, '').replace(/<\/p>/gi, '<br><br>');
            html = html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
            html = html.replace(/^(\s*<br\s*\/?>\s*)+|(\s*<br\s*\/?>\s*)+$/g, '');
            
            return html;
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

    // HighlightStorage ahora vive en storage-backend.js como
    // `QHP.SyncAnnotationsBackend`. La fachada `QHP.createAnnotationsBackend()`
    // devuelve el backend activo (sync hoy, Drive en Fase 2).

    // Icono de portapapeles (images/toolbar-icons/clipboard.svg) inline para
    // que el trazo herede `currentColor` del botón.
    const CLIPBOARD_ICON_SVG = `<svg class="copy-icon" viewBox="0 0 517 650" xmlns="http://www.w3.org/2000/svg"><path d="M509.333 191.667L325 7.33333C320.317 2.64367 313.96 0.006 307.333 0H225C200.69 0 177.373 9.65766 160.182 26.8487C142.991 44.0393 133.333 67.355 133.333 91.6667V133.333H91.6667C67.355 133.333 44.0393 142.991 26.8487 160.182C9.65766 177.373 0 200.688 0 225V558.333C0 582.643 9.65766 605.96 26.8487 623.15C44.0393 640.343 67.355 650 91.6667 650H325C349.31 650 372.627 640.343 389.817 623.15C407.01 605.96 416.667 582.643 416.667 558.333V516.667H425C449.31 516.667 472.627 507.01 489.817 489.817C507.01 472.627 516.667 449.31 516.667 425V208.333C516.403 202.053 513.787 196.103 509.333 191.667ZM333.333 85.3333L431.333 183.333H333.333V85.3333ZM366.667 558.333C366.667 569.383 362.277 579.983 354.463 587.797C346.65 595.61 336.05 600 325 600H91.6667C80.616 600 70.018 595.61 62.204 587.797C54.39 579.983 50 569.383 50 558.333V225C50 213.949 54.39 203.351 62.204 195.537C70.018 187.723 80.616 183.333 91.6667 183.333H133.333V425C133.333 449.31 142.991 472.627 160.182 489.817C177.373 507.01 200.69 516.667 225 516.667H366.667V558.333ZM425 466.667H225C213.95 466.667 203.35 462.277 195.537 454.463C187.723 446.65 183.333 436.05 183.333 425V91.6667C183.333 80.616 187.723 70.018 195.537 62.204C203.35 54.39 213.95 50 225 50H283.333V208.333C283.42 214.937 286.08 221.246 290.75 225.916C295.42 230.585 301.73 233.247 308.333 233.333H466.667V425C466.667 436.05 462.277 446.65 454.463 454.463C446.65 462.277 436.05 466.667 425 466.667Z"/></svg>`;

    class HighlightMenu {
        constructor() {
            this.host = document.createElement('div');
            this.host.id = 'highlighter-host';
            document.body.appendChild(this.host);

            this.shadowRoot = this.host.attachShadow({ mode: 'open' });

            // Cargar los estilos con un <link> dentro del shadow root en vez
            // de fetch(): cuando la extensión se recarga o actualiza con la
            // página abierta, el content script huérfano hacía fallar el
            // fetch con "TypeError: Failed to fetch" en el panel de errores.
            try {
                const styleLink = document.createElement('link');
                styleLink.rel = 'stylesheet';
                styleLink.href = chrome.runtime.getURL('style.css');
                this.shadowRoot.appendChild(styleLink);
            } catch (e) {
                // Contexto de extensión invalidado (recarga/actualización):
                // no hay estilos que cargar ni nada que reportar.
            }

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
            const { types, colors, actions, copy } = config.buttons;
            // El grupo de tipos y el botón de copiar comparten línea, pero
            // cada uno tiene su propio contenedor con fondo gris.
            const copyHTML = copy ? `<div class="menu-copy-group">${this._createButtons(copy)}</div>` : '';
            let typesHTML = types ? `<div class="menu-row types-line"><div class="menu-row types">${this._createButtons(types)}</div>${copyHTML}</div>` : '';
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

        /**
         * Aviso breve y discreto en la parte inferior de la página. Vive en
         * el shadow root como hermano del menú, así que sobrevive a hide().
         */
        showToast(message) {
            if (!this.toastElement) {
                this.toastElement = document.createElement('div');
                this.toastElement.className = 'highlighter-toast';
                this.shadowRoot.appendChild(this.toastElement);
            }
            this.toastElement.textContent = message;
            clearTimeout(this._toastTimer);
            this.toastElement.classList.remove('show');
            void this.toastElement.offsetWidth; // reinicia la transición si ya estaba visible
            this.toastElement.classList.add('show');
            this._toastTimer = setTimeout(() => this.toastElement.classList.remove('show'), 2000);
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
            this.storage = globalThis.QHP.createAnnotationsBackend();
            if (typeof this.storage.onSessionChange === 'function') {
                // Iniciar/cerrar sesión de Drive conmuta el backend en vivo:
                // recargar desde la nueva fuente y refrescar el sidebar.
                this.storage.onSessionChange(() => this._reloadFromBackend());
            }
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
            // Anclaje robusto: ids de anotaciones no encontradas en la página
            // (estado solo de runtime, nunca persistido), caché del texto
            // derivado de anotaciones legacy y cola de write-back para
            // selectores re-sanados.
            this._orphanedIds = new Set();
            this._derivedExactCache = new WeakMap();
            this._writeBackQueue = [];
            this._writeBackQueued = new Set();
            this._writeBackCount = 0;
            this._writeBackTimer = null;

            this.storage.load((loadedAnnotations) => {
                this.annotations = loadedAnnotations;
                this._loadAnnotations();
            });
            this._setupEventListeners();
            this._setupMutationObserver();
        }

        // La migración legacy local→sync (era pre-chunking, gateada por
        // 'highlighter-local-data-migrated') se retiró en F2.4: habría
        // absorbido hacia sync la copia local descargada al cerrar sesión
        // de Drive (§6-bis). Las anotaciones locales antiguas siguen
        // visibles (load() fusiona local+sync) y migran orgánicamente al
        // editarse (saveAnnotation escribe en sync y limpia la copia local).

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
                    this.menu.host.classList.add('ctrl-is-pressed');
                }
            });
            document.addEventListener('keyup', (e) => {
                if (e.key === 'Control') {
                    document.body.classList.remove('ctrl-is-pressed');
                    this.menu.host.classList.remove('ctrl-is-pressed');
                }
            });
            window.addEventListener('blur', () => {
                document.body.classList.remove('ctrl-is-pressed');
                this.menu.host.classList.remove('ctrl-is-pressed');
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

        /**
         * Recarga completa desde el backend activo. Se dispara al conmutar
         * la sesión de Drive (sync ⇄ Drive): misma secuencia que el cambio
         * de URL, pero sin tocar `currentUrl`.
         */
        async _reloadFromBackend() {
            if (this.bodyObserver) this.bodyObserver.disconnect();

            await this._closeOrFinalizeContextMenu();

            document.querySelectorAll('.highlighter-mark').forEach(el => DOMManager.unwrap(el));

            this.annotations = new Map();
            this._orphanedIds = new Set();
            this._notifySidebarOfUpdate();

            this.storage.load((loadedAnnotations) => {
                this.annotations = loadedAnnotations;
                this._loadAnnotations();
                this._notifySidebarOfUpdate();
            });

            if (this.bodyObserver) {
                this.bodyObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
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
                    copyText: () => this._copyAnnotationText(null),
                },
                buttons: {
                    colors: Object.entries(this.colors).map(([name, color]) => ({
                        action: 'create', value: color, label: chrome.i18n.getMessage(`colors_${name}`), className: 'highlighter-color-selector', content: `<div style="width:100%; height:100%; background-color:${this.solidColors[name]}; border-radius:3px;"></div>`
                    })),
                    types: [
                        { action: 'setType', value: 'highlight', label: chrome.i18n.getMessage('highlight'), content: 'A', className: `highlighter-type-selector ${this.currentAnnotationType === 'highlight' ? 'active' : ''}` },
                        { action: 'setType', value: 'underline', label: chrome.i18n.getMessage('underline'), content: '<span class="underline">A</span>', className: `highlighter-type-selector ${this.currentAnnotationType === 'underline' ? 'active' : ''}` }
                    ],
                    copy: [
                        { action: 'copyText', label: chrome.i18n.getMessage('copyAnnotationText'), content: CLIPBOARD_ICON_SVG, className: 'highlighter-copy-btn' }
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
                    copyText: () => this._copyAnnotationText(this.activeAnnotationId),
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
                    copy: [
                        { action: 'copyText', label: chrome.i18n.getMessage('copyAnnotationText'), content: CLIPBOARD_ICON_SVG, className: 'highlighter-copy-btn' }
                    ],
                    actions: [
                        { action: 'delete', label: chrome.i18n.getMessage('delete'), content: `<svg class="delete-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V6H17H19C19.5523 6 20  6.44772 20 7C20 7.55228 19.5523 8 19 8H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V8H5C4.44772 8 4 7.55228 4 7C4 6.44772 4.44772 6 5 6H7H9V5ZM10 8H8V18C8 18.5523 8.44772 19 9 19H15C15.5523 19 16 18.5523 16 18V8H14H10ZM13 6H11V5H13V6Z"/></svg><span>${chrome.i18n.getMessage('delete')}</span>`, className: 'highlighter-delete-btn' }
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
                    annotation.contentUpdatedAt = Date.now();
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

            this._anchorAll();

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

            // For detecting theme changes (light/dark mode)
            this.lastBodyBg = window.getComputedStyle(document.body).backgroundColor;
            this.themeObserver = new MutationObserver(() => {
                const newBodyBg = window.getComputedStyle(document.body).backgroundColor;
                if (newBodyBg !== this.lastBodyBg) {
                    const wasLight = DOMManager.isColorLight(this.lastBodyBg);
                    const isLight = DOMManager.isColorLight(newBodyBg);
            
                    if (wasLight !== isLight) {
                        this._reapplyAllAnnotationStyles();
                    }
            
                    this.lastBodyBg = newBodyBg;
                }
            });
            this.themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
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
            this._anchorAll();
        }

        // ——— Anclaje robusto (cascada verificada + auto-reparación) ———

        /**
         * Texto que debe contener el resaltado: la cita v2 si existe; para
         * anotaciones legacy (v1), texto plano derivado de su HTML sanitizado.
         */
        _expectedTextFor(annotation) {
            if (annotation.quote && typeof annotation.quote.exact === 'string' && annotation.quote.exact.length > 0) {
                return { text: annotation.quote.exact, derived: false };
            }
            let derived = this._derivedExactCache.get(annotation);
            if (derived === undefined) {
                derived = globalThis.QHP.anchoring.htmlToText(annotation.text || '');
                this._derivedExactCache.set(annotation, derived);
            }
            return { text: derived, derived: true };
        }

        /** El rango resuelto solo vale si su texto coincide con el esperado. */
        _rangeMatchesExpected(range, expected) {
            if (!range || range.collapsed) return false;
            const anchoring = globalThis.QHP.anchoring;
            // Para el texto derivado de legacy la igualdad normalizada estricta
            // es imposible (los bordes de bloque <p>/<br> añaden espacios);
            // se usa comparación laxa con tolerancia baja.
            return expected.derived
                ? anchoring.looseEquals(range.toString(), expected.text)
                : anchoring.verifyRange(range, expected.text);
        }

        /**
         * Cascada de anclaje: pointers (rápido) → position → cita
         * (exacta/normalizada/difusa). Cada paso se VERIFICA contra el texto
         * esperado; sin verificación un pointer desalineado pintaría texto
         * equivocado. No muta el DOM. Devuelve { range, method } o null.
         */
        _anchorAnnotation(annotation, index) {
            const anchoring = globalThis.QHP.anchoring;
            const expected = this._expectedTextFor(annotation);
            if (!expected.text) return null;

            const fromPointers = annotation.pointers ? DOMManager.getRangeFromPointers(annotation.pointers) : null;
            if (fromPointers && this._rangeMatchesExpected(fromPointers, expected)) {
                return { range: fromPointers, method: 'pointers' };
            }

            if (annotation.position) {
                const fromPosition = anchoring.positionToRange(annotation.position, index);
                if (fromPosition && this._rangeMatchesExpected(fromPosition, expected)) {
                    return { range: fromPosition, method: 'position' };
                }
            }

            // Citas capadas (v2) o legacy muy largas: buscar la cabeza y
            // extender el final por la longitud real conocida.
            let exact = expected.text;
            let fullLength;
            if (exact.length >= anchoring.QUOTE_CAP) {
                fullLength = annotation.position
                    ? annotation.position.end - annotation.position.start
                    : expected.text.length;
                exact = exact.slice(0, anchoring.QUOTE_CAP);
            }
            const hit = anchoring.quoteToRange(
                {
                    exact,
                    prefix: annotation.quote ? annotation.quote.prefix : '',
                    suffix: annotation.quote ? annotation.quote.suffix : '',
                },
                index,
                {
                    hintPosition: annotation.position ? annotation.position.start : undefined,
                    fullLength,
                }
            );
            if (hit) return { range: hit.range, method: hit.method === 'fuzzy' ? 'fuzzy' : 'quote' };
            return null;
        }

        /**
         * Pasada única de anclaje para todas las anotaciones sin mark en el
         * DOM. Fase A: resolver rangos y capturar selectores frescos sobre el
         * DOM intacto. Fase B: envolver en orden de documento (wrapRange muta
         * nodos de texto; los Range vivos se auto-ajustan y hay una guardia
         * anti-deriva). Lo que no se encuentra queda como huérfano: permanece
         * en `this.annotations` y en el sidebar, nunca se borra.
         */
        _anchorAll() {
            if (this.isTemporarilyHidden || this.isGloballyDisabled) return;
            const anchoring = globalThis.QHP.anchoring;

            const pending = [];
            this.annotations.forEach(annotation => {
                if (!document.querySelector(`[data-annotation-id="${annotation.id}"]`)) {
                    pending.push(annotation);
                }
            });

            const previousOrphans = this._orphanedIds;
            const orphans = new Set();

            if (pending.length === 0) {
                // Nada que anclar: no construir el índice (camino caliente del
                // MutationObserver).
                this._orphanedIds = orphans;
                if (previousOrphans.size > 0) this._notifySidebarOfUpdate();
                return;
            }

            const index = anchoring.buildTextIndex(document.body);

            // Fase A: resolver todo sobre el DOM prístino. Los selectores de
            // reparación se capturan aquí porque este DOM (sin marks) es el
            // mismo que verá la próxima carga de la página.
            const resolved = [];
            pending.forEach(annotation => {
                const hit = this._anchorAnnotation(annotation, index);
                if (!hit) {
                    orphans.add(annotation.id);
                    return;
                }
                let heal = null;
                if (hit.method !== 'pointers' || annotation.schemaVersion !== 2 || !annotation.quote) {
                    heal = {
                        pointers: DOMManager.getRangePointers(hit.range),
                        selectors: anchoring.rangeToSelectors(hit.range, index),
                    };
                }
                resolved.push({ annotation, range: hit.range, heal });
            });

            // Fase B: envolver en orden de documento.
            resolved.sort((a, b) => a.range.compareBoundaryPoints(Range.START_TO_START, b.range));
            resolved.forEach(({ annotation, range, heal }) => {
                const expected = this._expectedTextFor(annotation);
                let finalRange = range;
                let finalHeal = heal;
                if (!this._rangeMatchesExpected(range, expected)) {
                    // El wrapping de una anotación anterior desplazó este
                    // rango: re-resolver contra un índice fresco (el texto del
                    // índice no cambia al envolver, los marks se indexan).
                    const freshIndex = anchoring.buildTextIndex(document.body);
                    const retry = this._anchorAnnotation(annotation, freshIndex);
                    if (!retry) {
                        orphans.add(annotation.id);
                        return;
                    }
                    finalRange = retry.range;
                    finalHeal = {
                        pointers: DOMManager.getRangePointers(retry.range),
                        selectors: anchoring.rangeToSelectors(retry.range, freshIndex),
                    };
                }
                const marks = DOMManager.wrapRange(finalRange, annotation);
                if (!marks || marks.length === 0) {
                    orphans.add(annotation.id);
                    return;
                }
                if (finalHeal) this._applyHeal(annotation, finalRange, finalHeal);
            });

            this._orphanedIds = orphans;
            const orphansChanged = orphans.size !== previousOrphans.size ||
                [...orphans].some(id => !previousOrphans.has(id));
            if (orphansChanged) this._notifySidebarOfUpdate();
        }

        /**
         * Auto-reparación (y migración perezosa de anotaciones v1): actualiza
         * los selectores en memoria y encola la persistencia.
         */
        _applyHeal(annotation, range, heal) {
            if (!heal.selectors) return;
            // No persistir anclajes dentro de editores: su contenido es
            // inestable y generaría escrituras constantes.
            const container = range.commonAncestorContainer;
            const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
            if (element && element.isContentEditable) return;

            annotation.schemaVersion = 2;
            annotation.pointers = heal.pointers;
            annotation.quote = heal.selectors.quote;
            annotation.position = heal.selectors.position;
            // Solo se refrescan anclajes: estampar anchorsUpdatedAt (nunca
            // contentUpdatedAt) para que este guardado de fondo no pueda
            // pisar contenido editado en otro dispositivo (merge LWW doble).
            annotation.anchorsUpdatedAt = Date.now();
            this._derivedExactCache.delete(annotation);
            this._enqueueWriteBack(annotation.id);
        }

        _enqueueWriteBack(annotationId) {
            // Cap por sesión de página: lo pendiente se re-sana en la próxima
            // visita (la migración es idempotente). Protege la cuota de
            // escrituras de chrome.storage.sync.
            if (this._writeBackCount >= 20) return;
            if (this._writeBackQueued.has(annotationId)) return;
            this._writeBackQueued.add(annotationId);
            this._writeBackQueue.push(annotationId);
            this._writeBackCount++;
            if (this._writeBackTimer === null) this._flushWriteBack();
        }

        _flushWriteBack() {
            const id = this._writeBackQueue.shift();
            if (id === undefined) {
                this._writeBackTimer = null;
                return;
            }
            this._writeBackQueued.delete(id);
            const annotation = this.annotations.get(id);
            if (annotation) {
                this.storage.saveAnnotation(annotation, () => {});
            }
            this._writeBackTimer = setTimeout(() => this._flushWriteBack(), 500);
        }

        _notifySidebarOfUpdate() {
            const annotationsArray = Array.from(this.annotations.values());

            annotationsArray.sort((a, b) => {
                const elA = document.querySelector(`[data-annotation-id='${a.id}']`);
                const elB = document.querySelector(`[data-annotation-id='${b.id}']`);

                // Las anotaciones sin mark en la página (huérfanas) van al
                // final, con orden estable entre ellas.
                if (!elA && !elB) return 0;
                if (!elA) return 1;
                if (!elB) return -1;

                const position = elA.compareDocumentPosition(elB);

                // elB follows elA, so elA is first. To keep a before b, return a negative value.
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                    return -1;
                } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                    return 1;
                } else {
                    return 0;
                }
            });

            // `orphaned` es estado de runtime: viaja al sidebar en una copia,
            // nunca se persiste en la anotación.
            const sortedEntries = annotationsArray.map(annotation => [
                annotation.id,
                { ...annotation, orphaned: this._orphanedIds.has(annotation.id) },
            ]);

            chrome.runtime.sendMessage({
                action: 'annotationsUpdated',
                url: this.currentUrl,
                data: sortedEntries
            }).catch(e => {
                if (e.message.includes("Could not establish connection. Receiving end does not exist.")) {
                    // Sidebar is closed, this is expected.
                } else {
                    console.warn("Highlighter: Could not send update to sidebar.", e);
                }
            });
        }

        /**
         * Texto plano de la anotación para el portapapeles: en su HTML
         * sanitizado los límites de bloque ya son <br>, que aquí se vuelven
         * saltos de línea.
         */
        _annotationPlainText(annotation) {
            const doc = new DOMParser().parseFromString(annotation.text || '', 'text/html');
            doc.body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            return doc.body.textContent || '';
        }

        /**
         * Copia al portapapeles el texto de la anotación (menú contextual) o
         * de la selección activa (menú de creación, `annotationId` null) y
         * cierra el menú, igual que un clic fuera de él.
         */
        async _copyAnnotationText(annotationId) {
            let text = '';
            if (annotationId) {
                const annotation = this.annotations.get(annotationId);
                if (annotation) text = this._annotationPlainText(annotation);
            } else if (this.activeRange) {
                text = this.activeRange.toString();
            }

            if (text) {
                const notify = () => this.menu.showToast(chrome.i18n.getMessage('textCopiedToClipboard'));
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text)
                        .then(notify)
                        .catch(() => { this._execCommandCopy(text); notify(); });
                } else {
                    this._execCommandCopy(text);
                    notify();
                }
            }

            if (this.activeAnnotationId) {
                await this._closeOrFinalizeContextMenu();
            } else {
                await this.menu.hide();
                this.activeRange = null;
                window.getSelection()?.removeAllRanges();
            }
        }

        /** Fallback de copia; preserva la selección actual de la página. */
        _execCommandCopy(text) {
            const selection = window.getSelection();
            const savedRanges = [];
            for (let i = 0; i < selection.rangeCount; i++) {
                savedRanges.push(selection.getRangeAt(i).cloneRange());
            }
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); } catch (e) { /* portapapeles no disponible */ }
            textarea.remove();
            selection.removeAllRanges();
            savedRanges.forEach(range => selection.addRange(range));
        }

        async createAnnotation(color, type) {
            if (!this.activeRange) return;
            this.isCreatingAnnotation = true;
            const range = this.activeRange;
            this.activeRange = null;
            await this.menu.hide();

            // Doble marca de tiempo (ms epoch) para el merge por grupos de
            // campos de Drive: contenido y anclajes viajan por separado. En
            // el backend sync son campos pasajeros e inofensivos.
            const now = Date.now();
            const annotation = {
                id: this.storage.generateId(),
                pageUrl: this.storage.getPageUrl(),
                text: DOMManager.getSanitizedHtmlFromRange(range),
                pointers: DOMManager.getRangePointers(range),
                color: color,
                type: type,
                comment: '',
                createdAt: new Date().toISOString(),
                contentUpdatedAt: now,
                anchorsUpdatedAt: now
            };

            // Selectores robustos (cita + posición) para re-anclar aunque la
            // estructura de la página cambie. Capturados ANTES de wrapRange,
            // que muta el DOM.
            const anchoring = globalThis.QHP.anchoring;
            const selectors = anchoring.rangeToSelectors(range, anchoring.buildTextIndex(document.body));
            if (selectors) {
                annotation.schemaVersion = 2;
                annotation.quote = selectors.quote;
                annotation.position = selectors.position;
            }

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
            annotation.contentUpdatedAt = Date.now();
            this.annotations.set(id, annotation);
        
            // Save the entire annotation whenever it's updated.
            this.storage.saveAnnotation(annotation, () => {
                // The debounced call from the Tiptap editor handles performance.
                // Always send an update so the sidebar is in sync.
                this._notifySidebarOfUpdate();
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

            // Unwrap the marks from the main page immediately
            document.querySelectorAll(`[data-annotation-id="${annotationIdToDelete}"]`).forEach(el => DOMManager.unwrap(el));

            // Ask the sidebar to animate if available. If it can't or there's no receiver,
            // finalize immediately so storage stays consistent.
            try {
                const response = await new Promise((resolve, reject) => {
                    try {
                        chrome.runtime.sendMessage({
                            action: 'animateDelete',
                            annotationId: annotationIdToDelete
                        }, (resp) => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve(resp);
                            }
                        });
                    } catch (err) {
                        reject(err);
                    }
                });

                if (!response || !response.ok) {
                    // Sidebar didn't animate (no node or not ready). Finalize now.
                    this.finalizeDelete(annotationIdToDelete);
                }
            } catch (e) {
                // Any send error (no receiver, port closed, etc.) -> finalize now.
                this.finalizeDelete(annotationIdToDelete);
            }
        }

        finalizeDelete(annotationId) {
            this.annotations.delete(annotationId);
            this.storage.removeAnnotation(annotationId, () => {
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
            case 'requestRefresh':
                window.highlighterInstance._notifySidebarOfUpdate();
                sendResponse({ status: 'refresh requested' });
                return;
            case 'finalizeDelete':
                if (window.highlighterInstance) {
                    window.highlighterInstance.finalizeDelete(request.annotationId);
                }
                sendResponse({ status: 'deletion finalized' });
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