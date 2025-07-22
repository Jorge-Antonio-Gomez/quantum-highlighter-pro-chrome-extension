
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
                    <button data-action="bold" title="Bold"><strong>B</strong></button>
                    <button data-action="italic" title="Italic"><em>I</em></button>
                    <button data-action="underline" title="Underline"><u>U</u></button>
                    <button data-action="strike" title="Strikethrough"><s>S</s></button>
                    <button data-action="blockquote" title="Blockquote"><span style="font-size: 1.3em; font-weight: bold;">"</span></button>
                    <button data-action="codeBlock" title="Code Block"><strong>{}</strong></button>
                    <button data-action="link" title="Link">🔗</button>
                    <button data-action="h1" title="Heading 1">h1</button>
                    <button data-action="h2" title="Heading 2">h2</button>
                    <button data-action="h3" title="Heading 3">h3</button>
                `;

        toolbarContainer.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = e.currentTarget.dataset.action;
                handleToolbarClick(action, editor);
                updateToolbar(editor, toolbarContainer); // Update toolbar state immediately after action
            });
        });
    }

    function setupTiptapEditor(element, toolbarContainer, content, onUpdate, lang) {
        const { Editor, Extension, InputRule, wrappingInputRule, Plugin, PluginKey, TextSelection } = Tiptap;

        const CustomInputRules = Extension.create({
            name: 'customInputRules',
            addInputRules() {
                return [
                    wrappingInputRule({
                        find: /^\s*\|\s$/,
                        type: this.editor.schema.nodes.blockquote,
                    }),
                    new InputRule({
                        find: /^--- $/,
                        handler: ({ state, range }) => {
                            state.tr.delete(range.from, range.to)
                                .insert(range.from, state.schema.nodes.horizontal_rule.create())
                                .scrollIntoView();
                        },
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

                            // Find the end position of the current link mark
                            let markEndPos = $from.pos;
                            $from.parent.nodesBetween($from.parentOffset, $from.parent.content.size, (node, pos) => {
                                if (($from.start() + pos) < $from.pos - node.nodeSize) return;

                                if (linkMark.isInSet(node.marks)) {
                                    markEndPos = $from.start() + pos + node.nodeSize;
                                } else {
                                    return false; // Stop after the first node without the mark
                                }
                            });

                            const deleteStart = $from.pos - 2;
                            const deleteEnd = $from.pos;
                            const insertPos = markEndPos - 2;

                            const finalTr = tr.delete(deleteStart, deleteEnd);
                            const spaceNode = this.editor.schema.text(' ', []); // Create a text node with a space and NO marks
                            
                            // Use replaceWith to insert the node correctly, avoiding the RangeError
                            finalTr.replaceWith(insertPos, insertPos, spaceNode);

                            // The cursor will automatically be placed after the inserted node.
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
                            // We are at the end of a link, and the node before us is the last character.
                            // We need to delete it, which will also remove the link context.
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
                            // We are before the last character of a link.
                            // We need to delete it, which will also remove the link context.
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
                                    if (!link || !view.dom.contains(link)) return false;

                                    if (!this.editor.options.linkTooltipElement) {
                                        this.editor.options.linkTooltipElement = document.createElement('div');
                                        this.editor.options.linkTooltipElement.className = 'tiptap-link-tooltip';
                                        document.body.appendChild(this.editor.options.linkTooltipElement);
                                    }

                                    const tooltip = this.editor.options.linkTooltipElement;
                                    tooltip.textContent = link.getAttribute('href');

                                    computePosition(link, tooltip, {
                                        placement: 'bottom',
                                        middleware: [offset(8), flip(), shift({ padding: 5 })],
                                    }).then(({ x, y }) => {
                                        Object.assign(tooltip.style, {
                                            left: `${x}px`,
                                            top: `${y}px`,
                                        });
                                        tooltip.classList.add('is-visible');
                                    });

                                    return true;
                                },
                                mouseout: (view, event) => {
                                    const link = event.target.closest('a');
                                    if (!link || !view.dom.contains(link)) return false;

                                    const tooltip = this.editor.options.linkTooltipElement;
                                    if (tooltip) {
                                        tooltip.classList.remove('is-visible');
                                    }

                                    return true;
                                },
                            },
                        },
                    }),
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
                    includeChildren: true, // This is ESSENTIAL for placeholders on list items and blockquotes.
                    placeholder: ({ editor, node }) => {
                        // Highest priority: The main placeholder for a completely empty editor.
                        if (editor.isEmpty) {
                            return lang.commentPlaceholder;
                        }

                        const nodeType = node.type.name;

                        // Rule #1: A paragraph inside a list or quote should NOT have its own placeholder
                        // if it's the first and only child. This prevents the double-placeholder bug.
                        if (nodeType === 'paragraph') {
                            const parent = node.parent;
                            const parentType = parent ? parent.type.name : null;
                            
                            if (parentType === 'listItem' || parentType === 'blockquote') {
                                const isFirstAndOnlyChild = parent.childCount === 1 && parent.firstChild === node;
                                if (isFirstAndOnlyChild) {
                                    return null; // Let the parent container show the placeholder.
                                }
                            }
                        }

                        // Rule #2: A container (list/quote) gets a placeholder if it only contains one empty paragraph.
                        const isNodeWithOneEmptyChild = node.childCount === 1 && node.firstChild.content.size === 0;
                        if (isNodeWithOneEmptyChild) {
                            if (nodeType === 'listItem') {
                                return lang.listPlaceholder;
                            }
                            if (nodeType === 'blockquote') {
                                return lang.quotePlaceholder;
                            }
                        }

                        // Rule #3: Any other node gets a placeholder only if it's completely empty.
                        if (node.content.size === 0) {
                            if (nodeType === 'heading') {
                                return `${lang.heading} ${node.attrs.level}`;
                            }
                            if (nodeType === 'codeBlock') {
                                return lang.codePlaceholder;
                            }
                            if (nodeType === 'paragraph') {
                                // This will apply to top-level paragraphs and subsequent empty paragraphs in lists/quotes.
                                return lang.paragraphPlaceholder;
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
                if (event.relatedTarget && toolbarContainer.contains(event.relatedTarget)) {
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
                            // This is a CTRL+Click, handle it.
                            event.preventDefault();
                            event.stopPropagation();
                            chrome.runtime.sendMessage({ action: 'openTab', url: link.href });
                            return true; // We handled it.
                        }
                    }
                    // For any other click, or a simple click on a link, let Tiptap do its thing.
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

        buildToolbar(toolbarContainer, editor);
        updateToolbar(editor, toolbarContainer);

        return editor;
    }


    function showLinkEditor(previousUrl = '', previousText = '') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'highlighter-modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'highlighter-link-modal';
            modal.innerHTML = `
                <h3>Edit Link</h3>
                <div class="form-group">
                    <label for="link-text">Text</label>
                    <input type="text" id="link-text" placeholder="Link text" value="${previousText}">
                </div>
                <div class="form-group">
                    <label for="link-url">URL</label>
                    <input type="text" id="link-url" placeholder="https://example.com" value="${previousUrl}">
                </div>
                <div class="modal-actions">
                    <div class="left-actions">
                        <button class="unlink-btn">Unlink</button>
                    </div>
                    <div class="right-actions">
                        <button class="cancel-btn">Cancel</button>
                        <button class="save-btn">Save</button>
                    </div>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

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
                resolve(''); // Resolve with empty string to indicate unlinking
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
            
            // Capture escape key at document level to ensure it works
            document.addEventListener('keydown', handleEsc, true);
        });
    }

    async function promptForLink(editor) {
        // First, extend the selection to the entire link, if one exists at the cursor.
        editor.chain().focus().extendMarkRange('link').run();

        const { state } = editor;
        const { from, to } = state.selection; // These are now the correct boundaries.
        
        const selectedText = state.doc.textBetween(from, to, ' ');
        const previousUrl = editor.getAttributes('link').href || '';
        
        const result = await showLinkEditor(previousUrl, selectedText);

        if (result === null) { // Canceled
            // Set the cursor to the end of the selection
            editor.chain().focus().setTextSelection({ from: to, to: to }).run();
            return;
        }

        if (result === '') { // Unlink
            // extendMarkRange already selected the link, so unsetting is easy.
            editor.chain().focus().unsetLink().run();
            return;
        }

        let { url, text } = result;

        const linkText = text.trim() || url;
        if (!linkText) {
            return; // Nothing to do if both URL and Text are empty
        }

        // Prepend 'https://' if no protocol is present
        if (url && !/^(https?:\/\/|mailto:|ftp:)/i.test(url)) {
            url = 'https://' + url;
        }

        // The selection is already covering the old link text (or is a cursor).
        // We can just insert the new content, which will replace the selection.
        editor.chain().focus()
            .insertContent(linkText)
            .setTextSelection({ from: from, to: from + linkText.length }) // Select the newly inserted text
            .setLink({ href: url }) // Apply the link to that selection
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
        
            this.element.innerHTML = `<div id="highlighter-arrow"></div>${colorsHTML}${typesHTML}${commentBoxHTML}${actionsHTML}`;
            this.arrowElement = this.element.querySelector('#highlighter-arrow');
        
            this.element.onmousedown = (e) => {
                const button = e.target.closest('button');
                if (!button) return;

                // If the click is on a menu button and the Tiptap editor is focused,
                // prevent the default mousedown behavior. This stops the editor from blurring,
                // which avoids the race condition with the _onMouseUp handler that closes the menu.
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
            this.isTemporarilyHidden = false;
            this.isGloballyDisabled = false; // New flag for instant disabling
            this.activeDebouncedUpdate = null;
            this.tiptapEditor = null;
            this.tiptapToolbarPopup = null;
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

            // Add CTRL key listeners to toggle cursor style for links
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

        async _onKeyDown(event) {
            if (this.isGloballyDisabled || this.isTemporarilyHidden) return;
            
            const activeEl = document.activeElement;
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
        }

        async _onMouseDown(event) {
            if (this.isGloballyDisabled || this.isTemporarilyHidden) return;
            const target = event.target;
            if (target.closest('.highlighter-menu, .highlighter-close-btn, .highlighter-context-menu, .tiptap-toolbar-popup')) return;
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
            if (this.isDraggingInCommentBox) {
                this.isDraggingInCommentBox = false;
                return;
            }
            if (this.isGloballyDisabled || this.isTemporarilyHidden || event.target.closest('.highlighter-menu, .highlighter-mark, .highlighter-close-btn, .highlighter-context-menu, .highlighter-modal-overlay')) return;
            
            setTimeout(async () => {
                if (this.activeAnnotationId) {
                    await this._closeOrFinalizeContextMenu();
                }

                const selection = window.getSelection();
                if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                    // If the creation menu was open (indicated by activeRange), hide it.
                    // This handles the case where the user clicks away, collapsing the selection.
                    if (this.activeRange) {
                        this.menu.hide();
                        this.activeRange = null;
                    }
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
            const annotationId = element.dataset.annotationId;
            if (this.activeAnnotationId === annotationId) {
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
                        const editorElement = document.getElementById(editorElementId);
                        const toolbarElement = document.getElementById(toolbarElementId);
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
                                this.lang
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
                
                // --- Trim and clean the HTML content ---
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = rawHtml;
        
                // Remove trailing empty block nodes (e.g., <p><br></p> or <p></p>)
                while (tempDiv.lastChild && tempDiv.lastChild.nodeType === 1 && tempDiv.lastChild.textContent.trim() === '' && tempDiv.lastChild.tagName !== 'BR') {
                    tempDiv.removeChild(tempDiv.lastChild);
                }
        
                // Remove leading empty block nodes
                while (tempDiv.firstChild && tempDiv.firstChild.nodeType === 1 && tempDiv.firstChild.textContent.trim() === '' && tempDiv.firstChild.tagName !== 'BR') {
                    tempDiv.removeChild(tempDiv.firstChild);
                }
                
                const sanitizedComment = tempDiv.innerHTML.trim();
                // --- End of cleaning ---
        
                if (annotation.comment !== sanitizedComment) {
                    // Manually update and save to avoid recursion from updateAnnotation()
                    annotation.comment = sanitizedComment;
                    this.annotations.set(this.activeAnnotationId, annotation);
                    this.storage.save(this.annotations, () => {
                        this._notifySidebarOfUpdate();
                    });
                }
            }
            
            await this.menu.hide(); // Wait for the animation to finish

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

        async updateAnnotation(updates, idToUpdate, keepMenuOpen = false) {
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
                await this._closeOrFinalizeContextMenu();
            }
        }

        async deleteAnnotation(idToDelete) {
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
                await this._closeOrFinalizeContextMenu();
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
