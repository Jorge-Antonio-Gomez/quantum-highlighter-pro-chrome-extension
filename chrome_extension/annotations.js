/*
 * Quantum Highlighter PRO — Panel de anotaciones (annotations.html)
 *
 * Página de la extensión a pestaña completa con TODAS las anotaciones de
 * todos los sitios. Lee y escribe directamente en el backend activo:
 *  - chrome.storage.sync (+ copia local) vía SyncAnnotationsBackend;
 *  - Google Drive vía mensajes `drive:*` al service worker.
 *
 * No necesita que ninguna página esté abierta. Si la página anotada está
 * abierta en otra pestaña, se le avisa (`reloadAnnotations`) para que
 * refleje el cambio; a su vez, el content script emite `annotationsUpdated`
 * y el panel se actualiza en vivo con esos datos.
 */
(function () {
    'use strict';

    const QHP = globalThis.QHP;
    const SETTINGS_KEY = 'highlighter-settings';
    const SESSION_KEY = QHP.shared.SESSION_KEY;
    const ANNOTATION_KEY_PREFIX = QHP.shared.ANNOTATION_KEY_PREFIX;
    const COLORS = ['yellow', 'red', 'green', 'blue', 'purple', 'pink', 'orange', 'grey'];
    const COLOR_KEYS = {
        yellow: 'panelColorYellow', red: 'panelColorRed', green: 'panelColorGreen', blue: 'panelColorBlue',
        purple: 'panelColorPurple', pink: 'panelColorPink', orange: 'panelColorOrange', grey: 'panelColorGrey',
    };
    const DAY_MS = 24 * 60 * 60 * 1000;
    const NOTIFY_DEBOUNCE_MS = 400;
    const LIVE_UPDATE_DEBOUNCE_MS = 400;
    const SELF_WRITE_GRACE_MS = 1500;
    const SAVE_TIMEOUT_MS = 10000;

    const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

    // ------------------------------------------------------------------
    // Iconos (trazos estilo Lucide, sin dependencias)
    // ------------------------------------------------------------------
    const ICONS = {
        refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
        chevron: '<path d="m6 9 6 6 6-6"/>',
        moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        'cloud-off': '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
        highlighter: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
        'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
        pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
        'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
        underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>',
        globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
        note: '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
        bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
        italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
        strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>',
        code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
        quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
        list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
        'list-ordered': '<line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
        link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    };

    function iconSvg(name) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
    }

    const TOOLBAR = [
        { cmd: 'bold', key: 'toolbarBold', active: 'bold', icon: 'bold' },
        { cmd: 'italic', key: 'toolbarItalic', active: 'italic', icon: 'italic' },
        { cmd: 'underline', key: 'toolbarUnderline', active: 'underline', icon: 'underline' },
        { cmd: 'strike', key: 'toolbarStrike', active: 'strike', icon: 'strike' },
        { cmd: 'link', key: 'toolbarLink', active: 'link', icon: 'link' },
        { cmd: 'quote', key: 'toolbarBlockquote', active: 'blockquote', icon: 'quote' },
        { cmd: 'code', key: 'toolbarCodeBlock', active: 'codeBlock', icon: 'code' },
        { cmd: 'bullet', key: 'panelToolbarBulletList', active: 'bulletList', icon: 'list' },
        { cmd: 'ordered', key: 'panelToolbarOrderedList', active: 'orderedList', icon: 'list-ordered' },
    ];

    // ------------------------------------------------------------------
    // Estado
    // ------------------------------------------------------------------
    const state = {
        backend: 'sync',          // 'sync' | 'drive'
        fromCache: false,         // Drive inaccesible: datos de la caché local
        pages: new Map(),         // pageUrl -> { pageUrl, domain, title, annotations: Map(id -> anotación) }
        filters: { query: '', colors: new Set(), type: 'all', date: 'all', withComment: false, sites: new Set() },
        sort: 'newest',
        collapsed: new Set(),     // pageUrls plegadas
        editing: null,            // { id, pageUrl, editor, cardEl }
        newNoteId: null,          // nota de página aún no guardada
        settings: { sidebarDarkMode: false },
        focusPage: null,          // pageUrl a la que desplazarse tras renderizar
        lastGroups: [],           // grupos visibles del último render (para exportar)
        loaded: false,
        selfWriteUntil: 0,        // ignorar storage.onChanged de nuestras propias escrituras
    };

    const els = {};
    const textCache = new WeakMap();
    const dateFormatter = new Intl.DateTimeFormat(chrome.i18n.getUILanguage() || undefined, { dateStyle: 'medium' });

    // ------------------------------------------------------------------
    // Utilidades de texto / HTML
    // ------------------------------------------------------------------
    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function htmlToText(html) {
        if (typeof html !== 'string' || html === '') return '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.body.querySelectorAll('br, p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr').forEach((el) => el.append(' '));
        return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const ALLOWED_TAGS = new Set([
        'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'DEL', 'A', 'CODE', 'PRE', 'BLOCKQUOTE',
        'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'DIV', 'HR', 'SUB', 'SUP', 'MARK',
    ]);

    /** Comentarios (HTML de Tiptap): lista blanca de etiquetas, solo href seguro en enlaces. */
    function sanitizeHtml(html) {
        if (typeof html !== 'string' || html === '') return '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.body.querySelectorAll('script, style, iframe, object, embed, link, meta, svg, math, template, form, input, button, textarea, img, video, audio').forEach((el) => el.remove());
        doc.body.querySelectorAll('*').forEach((el) => {
            if (!ALLOWED_TAGS.has(el.tagName)) {
                el.replaceWith(...Array.from(el.childNodes));
                return;
            }
            for (const attr of Array.from(el.attributes)) {
                if (el.tagName === 'A' && attr.name === 'href') continue;
                el.removeAttribute(attr.name);
            }
            if (el.tagName === 'A') {
                const href = (el.getAttribute('href') || '').trim();
                if (!/^(https?:|mailto:)/i.test(href)) {
                    el.removeAttribute('href');
                } else {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }
        });
        return doc.body.innerHTML;
    }

    /** Conversión sencilla del HTML del comentario a Markdown para exportar/copiar. */
    function htmlToMarkdown(html) {
        if (typeof html !== 'string' || html === '') return '';
        const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html');
        const renderChildren = (node) => Array.from(node.childNodes).map(renderNode).join('');
        const renderNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, ' ');
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            const inner = () => renderChildren(node);
            switch (node.tagName) {
                case 'BR': return '\n';
                case 'P': case 'DIV': return `${inner().trim()}\n\n`;
                case 'STRONG': case 'B': return `**${inner()}**`;
                case 'EM': case 'I': return `*${inner()}*`;
                case 'S': case 'STRIKE': case 'DEL': return `~~${inner()}~~`;
                case 'CODE': return node.parentElement && node.parentElement.tagName === 'PRE' ? inner() : `\`${inner()}\``;
                case 'PRE': return `\`\`\`\n${node.textContent.replace(/\n$/, '')}\n\`\`\`\n\n`;
                case 'A': {
                    const href = node.getAttribute('href');
                    const text = inner();
                    return href ? `[${text}](${href})` : text;
                }
                case 'BLOCKQUOTE': return inner().trim().split('\n').map((line) => `> ${line}`).join('\n') + '\n\n';
                case 'UL': return Array.from(node.children).map((li) => `- ${renderChildren(li).trim()}`).join('\n') + '\n\n';
                case 'OL': return Array.from(node.children).map((li, i) => `${i + 1}. ${renderChildren(li).trim()}`).join('\n') + '\n\n';
                case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
                    return `${'#'.repeat(Number(node.tagName[1]))} ${inner().trim()}\n\n`;
                case 'HR': return '---\n\n';
                default: return inner();
            }
        };
        return renderChildren(doc.body).replace(/\n{3,}/g, '\n\n').trim();
    }

    // ------------------------------------------------------------------
    // Helpers de anotación / página
    // ------------------------------------------------------------------
    function isNote(annotation) {
        return annotation.type === 'note';
    }

    function createdTs(annotation) {
        const parsed = Date.parse(annotation.createdAt || '');
        if (!Number.isNaN(parsed)) return parsed;
        return typeof annotation.contentUpdatedAt === 'number' ? annotation.contentUpdatedAt : 0;
    }

    /** Texto plano de cita y comentario, cacheado por objeto. */
    function derived(annotation) {
        let cached = textCache.get(annotation);
        if (!cached) {
            const exact = annotation.quote && typeof annotation.quote.exact === 'string' ? annotation.quote.exact.trim() : '';
            cached = {
                quote: exact || htmlToText(annotation.text || ''),
                comment: htmlToText(annotation.comment || ''),
            };
            textCache.set(annotation, cached);
        }
        return cached;
    }

    function domainOf(pageUrl) {
        return String(pageUrl || '').split('/')[0].split('?')[0];
    }

    /** `pageUrl` se guarda sin esquema (dominio + ruta); https cubre la práctica totalidad de la web. */
    function pageHref(pageUrl) {
        return `https://${pageUrl}`;
    }

    function faviconUrl(pageUrl) {
        return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageHref(pageUrl))}&size=32`);
    }

    /** Enlace a la página con fragmento de texto (#:~:text=) para que Chrome desplace hasta la cita. */
    function highlightHref(annotation) {
        const base = pageHref(annotation.pageUrl);
        if (isNote(annotation)) return base;
        const text = derived(annotation).quote;
        if (!text) return base;
        const enc = (s) => encodeURIComponent(s).replace(/-/g, '%2D');
        const words = text.split(/\s+/).filter(Boolean);
        const fragment = words.length <= 10
            ? enc(text)
            : `${enc(words.slice(0, 5).join(' '))},${enc(words.slice(-5).join(' '))}`;
        return `${base}#:~:text=${fragment}`;
    }

    function computePageTitle(page) {
        let best = null;
        for (const annotation of page.annotations.values()) {
            if (typeof annotation.pageTitle === 'string' && annotation.pageTitle.trim()) {
                if (!best || QHP.shared.effectiveContentTs(annotation) > QHP.shared.effectiveContentTs(best)) best = annotation;
            }
        }
        return best ? best.pageTitle.trim() : '';
    }

    function refreshPageMeta(page) {
        page.domain = domainOf(page.pageUrl);
        page.title = computePageTitle(page);
    }

    function ensurePage(pageUrl) {
        let page = state.pages.get(pageUrl);
        if (!page) {
            page = { pageUrl, domain: domainOf(pageUrl), title: '', annotations: new Map() };
            state.pages.set(pageUrl, page);
        }
        return page;
    }

    function findAnnotation(id, pageUrl) {
        const page = state.pages.get(pageUrl);
        return page ? page.annotations.get(id) || null : null;
    }

    function removeFromState(annotation) {
        const page = state.pages.get(annotation.pageUrl);
        if (!page) return;
        page.annotations.delete(annotation.id);
        if (page.annotations.size === 0) state.pages.delete(annotation.pageUrl);
        else refreshPageMeta(page);
    }

    function formatDate(ts) {
        return ts ? dateFormatter.format(new Date(ts)) : '';
    }

    function isoDate(date) {
        return date.toISOString().slice(0, 10);
    }

    // ------------------------------------------------------------------
    // Mensajería / almacenamiento
    // ------------------------------------------------------------------
    function sendRuntimeMessage(message) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (!response || response.ok === false) {
                        reject(new Error((response && response.error) || 'unknown error'));
                        return;
                    }
                    resolve(response);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    function withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), ms);
            promise.then(
                (value) => { clearTimeout(timer); resolve(value); },
                (error) => { clearTimeout(timer); reject(error); }
            );
        });
    }

    const store = {
        sync: new QHP.SyncAnnotationsBackend(),

        async isDriveActive() {
            const items = await chrome.storage.local.get(SESSION_KEY);
            const session = items && items[SESSION_KEY];
            return !!(session && session.signedIn);
        },

        async loadAll() {
            if (await this.isDriveActive()) {
                const response = await sendRuntimeMessage({ action: 'drive:loadAll' });
                const pages = (response.pages || []).map((p) => ({
                    pageUrl: p.pageUrl,
                    annotations: Object.values(p.annotations || {}),
                }));
                return { backend: 'drive', fromCache: !!response.fromCache, pages };
            }
            const syncItems = await chrome.storage.sync.get(null);
            const localItems = await chrome.storage.local.get(null);
            // Igual que SyncAnnotationsBackend.load(): la copia local (descargada
            // al cerrar sesión de Drive) prevalece sobre sync.
            const all = QHP.shared.reassembleAll({ ...(syncItems || {}), ...(localItems || {}) }, null);
            const byPage = new Map();
            for (const annotation of all.values()) {
                if (!annotation || !annotation.id || !annotation.pageUrl) continue;
                if (!byPage.has(annotation.pageUrl)) byPage.set(annotation.pageUrl, []);
                byPage.get(annotation.pageUrl).push(annotation);
            }
            const pages = Array.from(byPage, ([pageUrl, annotations]) => ({ pageUrl, annotations }));
            return { backend: 'sync', fromCache: false, pages };
        },

        save(annotation) {
            state.selfWriteUntil = Date.now() + SELF_WRITE_GRACE_MS;
            if (state.backend === 'drive') {
                return sendRuntimeMessage({ action: 'drive:saveAnnotation', pageUrl: annotation.pageUrl, annotation });
            }
            return withTimeout(new Promise((resolve) => this.sync.saveAnnotation(annotation, resolve)), SAVE_TIMEOUT_MS);
        },

        remove(annotation) {
            state.selfWriteUntil = Date.now() + SELF_WRITE_GRACE_MS;
            if (state.backend === 'drive') {
                return sendRuntimeMessage({ action: 'drive:removeAnnotation', pageUrl: annotation.pageUrl, annotationId: annotation.id });
            }
            return withTimeout(new Promise((resolve) => this.sync.removeAnnotation(annotation.id, resolve)), SAVE_TIMEOUT_MS);
        },

        async stats() {
            if (state.backend !== 'sync') return null;
            try {
                return await this.sync.getStorageStats();
            } catch (e) {
                return null;
            }
        },
    };

    // ------------------------------------------------------------------
    // Carga
    // ------------------------------------------------------------------
    async function loadAll() {
        setLoading(true);
        try {
            const result = await store.loadAll();
            if (state.editing) cancelEdit(false);
            state.backend = result.backend;
            state.fromCache = result.fromCache;
            state.pages = new Map();
            for (const p of result.pages) {
                if (!p || !p.pageUrl) continue;
                const page = ensurePage(p.pageUrl);
                for (const annotation of p.annotations) {
                    if (!annotation || !annotation.id) continue;
                    delete annotation.orphaned;
                    page.annotations.set(annotation.id, annotation);
                }
                if (page.annotations.size === 0) state.pages.delete(p.pageUrl);
                else refreshPageMeta(page);
            }
            state.loaded = true;
            renderAll();
            renderStats();
        } catch (error) {
            console.error('QHP panel: no se pudieron cargar las anotaciones', error);
            showToast(t('panelLoadFailed'), true);
        } finally {
            setLoading(false);
        }
    }

    function setLoading(loading) {
        els.loading.hidden = !loading;
        if (loading) {
            els.emptyState.hidden = true;
            els.noResults.hidden = true;
        }
    }

    // ------------------------------------------------------------------
    // Filtros
    // ------------------------------------------------------------------
    function hasActiveFilters() {
        const f = state.filters;
        return !!(f.query || f.colors.size || f.type !== 'all' || f.date !== 'all' || f.withComment || f.sites.size);
    }

    function dateThreshold(mode) {
        const now = new Date();
        switch (mode) {
            case 'today': {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                return start.getTime();
            }
            case 'week': return now.getTime() - 7 * DAY_MS;
            case 'month': return now.getTime() - 30 * DAY_MS;
            case 'year': return new Date(now.getFullYear(), 0, 1).getTime();
            default: return 0;
        }
    }

    function matchesFilters(annotation, page) {
        if (state.editing && state.editing.id === annotation.id) return true;
        if (state.newNoteId === annotation.id) return true;
        const f = state.filters;
        const type = isNote(annotation) ? 'note' : (annotation.type === 'underline' ? 'underline' : 'highlight');
        if (f.type !== 'all' && type !== f.type) return false;
        if (f.colors.size > 0 && !f.colors.has(annotation.color)) return false;
        if (f.sites.size > 0 && !f.sites.has(page.domain)) return false;
        const text = derived(annotation);
        if (f.withComment && !text.comment) return false;
        if (f.date !== 'all' && createdTs(annotation) < dateThreshold(f.date)) return false;
        if (f.query) {
            const haystack = `${text.quote}\n${text.comment}\n${page.title}\n${page.pageUrl}`.toLowerCase();
            const words = f.query.split(/\s+/).filter(Boolean);
            if (!words.every((word) => haystack.includes(word))) return false;
        }
        return true;
    }

    function pageHasVisibleAnnotations(page) {
        for (const annotation of page.annotations.values()) {
            if (matchesFilters(annotation, page)) return true;
        }
        return false;
    }

    function resetFilters(rerender) {
        state.filters = { query: '', colors: new Set(), type: 'all', date: 'all', withComment: false, sites: new Set() };
        els.search.value = '';
        els.colorFilters.querySelectorAll('.color-chip').forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
        els.typeFilters.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', btn.dataset.type === 'all'));
        els.dateFilter.value = 'all';
        els.withComment.checked = false;
        els.siteFilters.querySelectorAll('.site-btn').forEach((btn) => btn.classList.remove('active'));
        if (rerender) render();
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    function renderAll() {
        renderBackend();
        renderPrivacyNote();
        renderSites();
        render();
    }

    function renderBackend() {
        els.backendBadge.textContent = t(state.backend === 'drive' ? 'panelBackendDrive' : 'panelBackendSync');
        els.cacheBanner.hidden = !(state.backend === 'drive' && state.fromCache);
    }

    /** Nota permanente de privacidad en el lateral (divulgación destacada). */
    function renderPrivacyNote() {
        els.privacyNoteText.textContent = t(state.backend === 'drive' ? 'panelPrivacyNoteDrive' : 'panelPrivacyNoteSync');
        const disclosure = QHP.disclosure;
        if (disclosure) els.privacyNoteLink.href = disclosure.PRIVACY_POLICY_URL;
    }

    // ------------------------------------------------------------------
    // Aviso de prácticas de datos (consentimiento / cambios tras actualizar)
    // ------------------------------------------------------------------
    function hideDisclosure() {
        els.disclosureOverlay.hidden = true;
    }

    function maybeShowDisclosure() {
        const disclosure = QHP.disclosure;
        if (!disclosure) return;
        disclosure.getState((disclosureState) => {
            if (!disclosureState.needed) return;
            const content = disclosure.content(disclosureState.mode);
            els.disclosureTitle.textContent = content.title;
            els.disclosureIntro.textContent = content.intro;
            const parts = [];
            const addList = (headingText, items) => {
                const h4 = document.createElement('h4');
                h4.textContent = headingText;
                const ul = document.createElement('ul');
                for (const item of items) {
                    const li = document.createElement('li');
                    li.textContent = item;
                    ul.appendChild(li);
                }
                parts.push(h4, ul);
            };
            if (content.changes.length > 0) addList(content.changesHeading, content.changes);
            addList(content.practicesHeading, content.items);
            els.disclosureBody.replaceChildren(...parts);
            els.disclosureLink.href = content.url;
            els.disclosureLink.textContent = content.link;
            els.disclosureAccept.textContent = content.accept;
            els.disclosureOverlay.hidden = false;
            els.disclosureAccept.focus();
        });
    }

    async function renderStats() {
        let annotations = 0;
        const sites = new Set();
        for (const page of state.pages.values()) {
            annotations += page.annotations.size;
            sites.add(page.domain);
        }
        const lines = [t('panelStats', [String(annotations), String(state.pages.size), String(sites.size)])];
        if (state.backend === 'sync') {
            const stats = await store.stats();
            if (stats && typeof stats.percentUsed === 'number') {
                lines.push(t('panelStorageUsage', [String(Math.round(stats.percentUsed * 100))]));
            }
        }
        els.stats.replaceChildren(...lines.map((line) => {
            const div = document.createElement('div');
            div.textContent = line;
            return div;
        }));
    }

    function renderSites() {
        const counts = new Map();
        for (const page of state.pages.values()) {
            counts.set(page.domain, (counts.get(page.domain) || 0) + page.annotations.size);
        }
        for (const site of Array.from(state.filters.sites)) {
            if (!counts.has(site)) state.filters.sites.delete(site);
        }
        const entries = Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        els.siteFilters.replaceChildren(...entries.map(([domain, count]) => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'site-btn' + (state.filters.sites.has(domain) ? ' active' : '');
            button.dataset.site = domain;
            const name = document.createElement('span');
            name.className = 'site-name';
            name.textContent = domain;
            name.title = domain;
            const badge = document.createElement('span');
            badge.className = 'site-count';
            badge.textContent = String(count);
            button.append(name, badge);
            li.appendChild(button);
            return li;
        }));
    }

    function sortGroups(groups) {
        const titleOf = (group) => (group.page.title || group.page.pageUrl).toLowerCase();
        switch (state.sort) {
            case 'oldest': groups.sort((a, b) => a.oldest - b.oldest); break;
            case 'page': groups.sort((a, b) => titleOf(a).localeCompare(titleOf(b))); break;
            case 'count': groups.sort((a, b) => b.annotations.length - a.annotations.length || b.newest - a.newest); break;
            default: groups.sort((a, b) => b.newest - a.newest);
        }
    }

    function render() {
        if (!state.loaded) return;
        const editingCard = state.editing ? state.editing.cardEl : null;

        const groups = [];
        let total = 0;
        let shown = 0;
        for (const page of state.pages.values()) {
            const all = Array.from(page.annotations.values());
            total += all.length;
            const visible = all.filter((annotation) => matchesFilters(annotation, page));
            if (visible.length === 0) continue;
            shown += visible.length;
            visible.sort((a, b) => createdTs(a) - createdTs(b));
            let newest = 0;
            let oldest = Number.POSITIVE_INFINITY;
            for (const annotation of visible) {
                const ts = createdTs(annotation);
                if (ts > newest) newest = ts;
                if (ts < oldest) oldest = ts;
            }
            groups.push({ page, annotations: visible, newest, oldest });
        }
        sortGroups(groups);
        state.lastGroups = groups;

        const fragment = document.createDocumentFragment();
        for (const group of groups) fragment.appendChild(buildGroup(group));
        els.groups.replaceChildren(fragment);

        // La tarjeta en edición conserva su editor Tiptap entre renders.
        if (editingCard && state.editing) {
            const fresh = els.groups.querySelector(`.card[data-id="${CSS.escape(state.editing.id)}"]`);
            if (fresh) fresh.replaceWith(editingCard);
        }

        els.emptyState.hidden = total !== 0;
        els.noResults.hidden = !(total > 0 && shown === 0);
        els.resultCount.textContent = total > 0 ? t('panelResultCount', [String(shown), String(total)]) : '';
        els.clearFilters.hidden = !hasActiveFilters();
        updateCollapseToggle(groups);
        applyFocus();
    }

    function updateCollapseToggle(groups) {
        const allCollapsed = groups.length > 0 && groups.every((group) => state.collapsed.has(group.page.pageUrl));
        els.collapseToggle.hidden = groups.length === 0;
        els.collapseToggle.dataset.mode = allCollapsed ? 'expand' : 'collapse';
        els.collapseToggle.textContent = t(allCollapsed ? 'panelExpandAll' : 'panelCollapseAll');
    }

    function buildGroup({ page, annotations }) {
        const section = document.createElement('section');
        section.className = 'page-group';
        section.dataset.pageUrl = page.pageUrl;
        const collapsed = state.collapsed.has(page.pageUrl);
        if (collapsed) section.classList.add('collapsed');

        const header = document.createElement('div');
        header.className = 'page-header';
        header.dataset.act = 'collapse';
        header.innerHTML = `
            <button class="collapse-btn" type="button" data-act="collapse" aria-expanded="${collapsed ? 'false' : 'true'}"><span class="icon">${iconSvg('chevron')}</span></button>
            <img class="favicon" alt="" loading="lazy">
            <div class="page-meta">
                <h2 class="page-title"></h2>
                <a class="page-link" target="_blank" rel="noopener noreferrer" data-act="open-page"></a>
            </div>
            <span class="count-badge"></span>
            <div class="page-actions">
                <a class="icon-btn" target="_blank" rel="noopener noreferrer" data-act="open-page"><span class="icon">${iconSvg('external-link')}</span></a>
                <button class="icon-btn" type="button" data-act="add-note"><span class="icon">${iconSvg('plus')}</span></button>
                <button class="icon-btn" type="button" data-act="copy-md"><span class="icon">${iconSvg('copy')}</span></button>
                <button class="icon-btn danger" type="button" data-act="delete-page"><span class="icon">${iconSvg('trash')}</span></button>
            </div>`;

        const favicon = header.querySelector('.favicon');
        favicon.src = faviconUrl(page.pageUrl);
        favicon.addEventListener('error', () => {
            const fallback = document.createElement('span');
            fallback.className = 'icon favicon favicon-fallback';
            fallback.innerHTML = iconSvg('globe');
            favicon.replaceWith(fallback);
        }, { once: true });

        header.querySelector('.page-title').textContent = page.title || t('panelUntitledPage');
        const pageLink = header.querySelector('.page-link');
        pageLink.href = pageHref(page.pageUrl);
        pageLink.textContent = page.pageUrl;
        pageLink.title = pageHref(page.pageUrl);
        header.querySelector('.count-badge').textContent = String(annotations.length);

        const openLink = header.querySelector('.page-actions [data-act="open-page"]');
        openLink.href = pageHref(page.pageUrl);
        openLink.title = t('panelOpenPage');
        header.querySelector('[data-act="add-note"]').title = t('panelAddPageNote');
        header.querySelector('[data-act="copy-md"]').title = t('panelCopyMarkdown');
        header.querySelector('[data-act="delete-page"]').title = t('panelDeletePage');

        const cards = document.createElement('div');
        cards.className = 'cards';
        for (const annotation of annotations) cards.appendChild(buildCard(annotation));

        section.append(header, cards);
        return section;
    }

    function buildCard(annotation) {
        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.id = annotation.id;
        card.dataset.pageUrl = annotation.pageUrl;
        const color = COLORS.includes(annotation.color) ? annotation.color : 'grey';
        card.style.setProperty('--card-color', `var(--qhp-color-${color})`);
        const note = isNote(annotation);
        if (note) card.classList.add('is-note');
        else if (annotation.type === 'underline') card.classList.add('is-underline');

        const text = derived(annotation);
        const body = document.createElement('div');
        body.className = 'card-body';

        if (note) {
            const label = document.createElement('div');
            label.className = 'note-label';
            label.innerHTML = `<span class="icon">${iconSvg('note')}</span>`;
            label.append(t('panelPageNoteLabel'));
            body.appendChild(label);
        } else {
            const quote = document.createElement('blockquote');
            quote.className = 'quote';
            quote.textContent = text.quote;
            body.appendChild(quote);
        }

        const comment = document.createElement('div');
        comment.className = 'comment';
        comment.innerHTML = text.comment
            ? sanitizeHtml(annotation.comment)
            : `<span class="placeholder">${escapeHtml(t('noComment'))}</span>`;
        body.appendChild(comment);

        const editor = document.createElement('div');
        editor.className = 'editor';
        editor.hidden = true;
        body.appendChild(editor);

        const footer = document.createElement('footer');
        footer.className = 'card-footer';
        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const created = createdTs(annotation);
        const date = document.createElement('span');
        date.className = 'card-date';
        date.textContent = formatDate(created);
        meta.appendChild(date);
        if (typeof annotation.contentUpdatedAt === 'number' && annotation.contentUpdatedAt - created > 60 * 1000) {
            const edited = document.createElement('span');
            edited.className = 'card-edited';
            edited.textContent = `· ${t('panelEditedOn', [formatDate(annotation.contentUpdatedAt)])}`;
            meta.appendChild(edited);
        }
        footer.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'card-actions';
        actions.innerHTML = `
            <a class="icon-btn" target="_blank" rel="noopener noreferrer" data-act="go"><span class="icon">${iconSvg('arrow-up-right')}</span></a>
            <button class="icon-btn" type="button" data-act="edit"><span class="icon">${iconSvg('pencil')}</span></button>
            <div class="color-picker">
                <button class="icon-btn color-dot" type="button" data-act="color-menu"></button>
                <div class="color-popover" hidden>${COLORS.map((c) => `<button class="color-option${c === color ? ' active' : ''}" type="button" data-act="set-color" data-color="${c}" style="--chip-color: var(--qhp-color-${c})"></button>`).join('')}</div>
            </div>
            ${note ? '' : `<button class="icon-btn" type="button" data-act="toggle-type"><span class="icon">${iconSvg(annotation.type === 'underline' ? 'highlighter' : 'underline')}</span></button>`}
            <button class="icon-btn danger" type="button" data-act="delete"><span class="icon">${iconSvg('trash')}</span></button>`;

        const go = actions.querySelector('[data-act="go"]');
        go.href = highlightHref(annotation);
        go.title = t(note ? 'panelOpenPage' : 'panelGoToHighlight');
        actions.querySelector('[data-act="edit"]').title = t('panelEditComment');
        actions.querySelector('[data-act="color-menu"]').title = t('panelChangeColor');
        actions.querySelectorAll('[data-act="set-color"]').forEach((btn) => { btn.title = t(COLOR_KEYS[btn.dataset.color]); });
        const typeButton = actions.querySelector('[data-act="toggle-type"]');
        if (typeButton) typeButton.title = t(annotation.type === 'underline' ? 'panelSetHighlight' : 'panelSetUnderline');
        actions.querySelector('[data-act="delete"]').title = t('deleteAnnotation');
        footer.appendChild(actions);
        body.appendChild(footer);

        const bar = document.createElement('div');
        bar.className = 'card-bar';
        card.append(bar, body);
        return card;
    }

    // ------------------------------------------------------------------
    // Acciones sobre grupos y tarjetas
    // ------------------------------------------------------------------
    function closePopovers(except) {
        document.querySelectorAll('.color-popover:not([hidden])').forEach((popover) => {
            if (except && popover.parentElement.contains(except)) return;
            popover.hidden = true;
        });
        if (els.exportMenu && !els.exportMenu.hidden && !(except && els.exportButton.contains(except))) {
            els.exportMenu.hidden = true;
            els.exportButton.setAttribute('aria-expanded', 'false');
        }
    }

    function confirmThen(button, onConfirm) {
        if (button.dataset.armed === '1') {
            disarm(button);
            onConfirm();
            return;
        }
        button.dataset.armed = '1';
        button.dataset.originalHtml = button.innerHTML;
        button.dataset.originalTitle = button.title;
        button.classList.add('confirming');
        button.textContent = t('panelConfirmDelete');
        button._disarmTimer = setTimeout(() => disarm(button), 4000);
    }

    function disarm(button) {
        if (button.dataset.armed !== '1') return;
        clearTimeout(button._disarmTimer);
        button.dataset.armed = '';
        button.classList.remove('confirming');
        button.innerHTML = button.dataset.originalHtml || '';
        button.title = button.dataset.originalTitle || '';
    }

    function toggleCollapse(groupEl) {
        const pageUrl = groupEl.dataset.pageUrl;
        if (state.collapsed.has(pageUrl)) state.collapsed.delete(pageUrl);
        else state.collapsed.add(pageUrl);
        const collapsed = state.collapsed.has(pageUrl);
        groupEl.classList.toggle('collapsed', collapsed);
        const button = groupEl.querySelector('.collapse-btn');
        if (button) button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        updateCollapseToggle(state.lastGroups);
    }

    function onGroupsClick(event) {
        const actEl = event.target.closest('[data-act]');
        if (!actEl || !els.groups.contains(actEl)) return;
        const act = actEl.dataset.act;
        if (act === 'open-page' || act === 'go') return; // enlaces: navegación nativa

        const card = actEl.closest('.card');
        const groupEl = actEl.closest('.page-group');
        const page = groupEl ? state.pages.get(groupEl.dataset.pageUrl) : null;
        const annotation = card ? findAnnotation(card.dataset.id, card.dataset.pageUrl) : null;

        switch (act) {
            case 'collapse':
                if (groupEl) toggleCollapse(groupEl);
                break;
            case 'add-note':
                if (page) addPageNote(page);
                break;
            case 'copy-md':
                if (page) copyPageMarkdown(page);
                break;
            case 'delete-page':
                if (page) confirmThen(actEl, () => deletePage(page));
                break;
            case 'edit':
                if (card && annotation) startEdit(card, annotation);
                break;
            case 'save':
                saveEdit();
                break;
            case 'cancel':
                cancelEdit(true);
                break;
            case 'tb':
                runToolbar(actEl.dataset.cmd);
                break;
            case 'color-menu': {
                closePopovers(actEl);
                const popover = actEl.parentElement.querySelector('.color-popover');
                if (popover) popover.hidden = !popover.hidden;
                break;
            }
            case 'set-color':
                if (annotation) setColor(annotation, actEl.dataset.color);
                break;
            case 'toggle-type':
                if (annotation) toggleType(annotation);
                break;
            case 'delete':
                if (card && annotation) confirmThen(actEl, () => deleteOne(annotation, card));
                break;
            default:
                break;
        }
    }

    async function persist(annotation, successKey) {
        try {
            await store.save(annotation);
            if (successKey) showToast(t(successKey));
            notifyTabs(annotation.pageUrl);
            renderStats();
        } catch (error) {
            console.error('QHP panel: no se pudo guardar la anotación', error);
            showToast(t('panelSaveFailed'), true);
        }
    }

    function setColor(annotation, color) {
        closePopovers();
        if (!COLORS.includes(color) || annotation.color === color) return;
        annotation.color = color;
        annotation.contentUpdatedAt = Date.now();
        render();
        persist(annotation, null);
    }

    function toggleType(annotation) {
        if (isNote(annotation)) return;
        annotation.type = annotation.type === 'underline' ? 'highlight' : 'underline';
        annotation.contentUpdatedAt = Date.now();
        render();
        persist(annotation, null);
    }

    async function deleteOne(annotation, card) {
        if (state.editing && state.editing.id === annotation.id) cancelEdit(false);
        removeFromState(annotation);
        card.classList.add('removing');
        setTimeout(() => renderAll(), 220);
        try {
            await store.remove(annotation);
            showToast(t('panelDeleted'));
            notifyTabs(annotation.pageUrl);
            renderStats();
        } catch (error) {
            console.error('QHP panel: no se pudo borrar la anotación', error);
            showToast(t('panelSaveFailed'), true);
        }
    }

    async function deletePage(page) {
        const list = Array.from(page.annotations.values());
        if (state.editing && state.editing.pageUrl === page.pageUrl) cancelEdit(false);
        state.pages.delete(page.pageUrl);
        state.collapsed.delete(page.pageUrl);
        renderAll();
        let failed = 0;
        for (const annotation of list) {
            try {
                await store.remove(annotation);
            } catch (error) {
                failed += 1;
                console.error('QHP panel: no se pudo borrar la anotación', error);
            }
        }
        notifyTabs(page.pageUrl);
        renderStats();
        if (failed > 0) showToast(t('panelSaveFailed'), true);
        else showToast(t('panelPageDeleted', [String(list.length)]));
    }

    function addPageNote(page) {
        if (state.editing) cancelEdit(false);
        const now = Date.now();
        const note = {
            id: store.sync.generateId(),
            pageUrl: page.pageUrl,
            text: '',
            color: 'yellow',
            type: 'note',
            comment: '',
            createdAt: new Date(now).toISOString(),
            contentUpdatedAt: now,
            anchorsUpdatedAt: now,
            schemaVersion: 2,
        };
        if (page.title) note.pageTitle = page.title;
        page.annotations.set(note.id, note);
        state.newNoteId = note.id;
        state.collapsed.delete(page.pageUrl);
        render();
        const card = els.groups.querySelector(`.card[data-id="${CSS.escape(note.id)}"]`);
        if (card) {
            startEdit(card, note);
            card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    async function copyPageMarkdown(page) {
        const annotations = Array.from(page.annotations.values()).sort((a, b) => createdTs(a) - createdTs(b));
        try {
            await navigator.clipboard.writeText(markdownForPage(page, annotations));
            showToast(t('panelCopied'));
        } catch (error) {
            console.error('QHP panel: no se pudo copiar al portapapeles', error);
            showToast(t('panelSaveFailed'), true);
        }
    }

    // ------------------------------------------------------------------
    // Edición de comentarios (Tiptap)
    // ------------------------------------------------------------------
    function createEditor(host, content) {
        const { Editor, StarterKit, Placeholder } = window.Tiptap;
        return new Editor({
            element: host,
            extensions: [
                StarterKit.configure({
                    heading: { levels: [1, 2, 3] },
                    link: {
                        openOnClick: false,
                        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
                    },
                }),
                Placeholder.configure({ placeholder: t('commentPlaceholder') }),
            ],
            content: content || '',
            editable: true,
            onTransaction: ({ editor }) => updateToolbarState(editor),
        });
    }

    function toolbarHtml() {
        return `<div class="editor-toolbar">${TOOLBAR.map((item) =>
            `<button class="icon-btn" type="button" data-act="tb" data-cmd="${item.cmd}" title="${escapeHtml(t(item.key))}"><span class="icon">${iconSvg(item.icon)}</span></button>`
        ).join('')}</div>`;
    }

    function updateToolbarState(editor) {
        if (!state.editing || state.editing.editor !== editor) return;
        state.editing.cardEl.querySelectorAll('.editor-toolbar [data-cmd]').forEach((button) => {
            const item = TOOLBAR.find((entry) => entry.cmd === button.dataset.cmd);
            if (item) button.classList.toggle('active', editor.isActive(item.active));
        });
    }

    function runToolbar(cmd) {
        const editor = state.editing && state.editing.editor;
        if (!editor) return;
        switch (cmd) {
            case 'bold': editor.chain().focus().toggleBold().run(); break;
            case 'italic': editor.chain().focus().toggleItalic().run(); break;
            case 'underline': editor.chain().focus().toggleUnderline().run(); break;
            case 'strike': editor.chain().focus().toggleStrike().run(); break;
            case 'quote': editor.chain().focus().toggleBlockquote().run(); break;
            case 'code': editor.chain().focus().toggleCodeBlock().run(); break;
            case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
            case 'ordered': editor.chain().focus().toggleOrderedList().run(); break;
            case 'link': {
                const previous = editor.getAttributes('link').href || '';
                const input = window.prompt(t('panelLinkPrompt'), previous);
                if (input === null) {
                    editor.commands.focus();
                    break;
                }
                const trimmed = input.trim();
                if (!trimmed) {
                    editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    break;
                }
                const href = /^(https?:|mailto:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
                editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
                break;
            }
            default: break;
        }
    }

    function startEdit(card, annotation) {
        if (state.editing) {
            if (state.editing.id === annotation.id) return;
            cancelEdit(true);
            // El render anterior reconstruyó las tarjetas: volver a localizarla.
            card = els.groups.querySelector(`.card[data-id="${CSS.escape(annotation.id)}"]`) || card;
        }
        const host = card.querySelector('.editor');
        host.hidden = false;
        host.innerHTML = `${toolbarHtml()}<div class="editor-host"></div><div class="editor-actions"><button class="btn" type="button" data-act="cancel">${escapeHtml(t('panelCancel'))}</button><button class="btn primary" type="button" data-act="save">${escapeHtml(t('panelSave'))}</button></div>`;
        const editor = createEditor(host.querySelector('.editor-host'), annotation.comment || '');
        card.classList.add('editing');
        card.querySelector('.comment').hidden = true;
        state.editing = { id: annotation.id, pageUrl: annotation.pageUrl, editor, cardEl: card };
        updateToolbarState(editor);
        editor.commands.focus('end');
    }

    function destroyEditor() {
        if (!state.editing) return;
        try {
            state.editing.editor.destroy();
        } catch (e) {
            // El editor ya estaba destruido.
        }
        const card = state.editing.cardEl;
        if (card && card.isConnected) {
            card.classList.remove('editing');
            const host = card.querySelector('.editor');
            if (host) {
                host.hidden = true;
                host.innerHTML = '';
            }
            const comment = card.querySelector('.comment');
            if (comment) comment.hidden = false;
        }
    }

    function cancelEdit(rerender) {
        const editing = state.editing;
        if (!editing) return;
        destroyEditor();
        state.editing = null;
        if (state.newNoteId === editing.id) {
            // Nota nueva descartada: nunca llegó a guardarse.
            const page = state.pages.get(editing.pageUrl);
            if (page) {
                page.annotations.delete(editing.id);
                if (page.annotations.size === 0) state.pages.delete(editing.pageUrl);
            }
            state.newNoteId = null;
        }
        if (rerender) renderAll();
    }

    async function saveEdit() {
        const editing = state.editing;
        if (!editing) return;
        const annotation = findAnnotation(editing.id, editing.pageUrl);
        if (!annotation) {
            cancelEdit(true);
            return;
        }
        const html = editing.editor.isEmpty ? '' : editing.editor.getHTML();
        const isNewNote = state.newNoteId === annotation.id;
        if (isNewNote && !html) {
            cancelEdit(true);
            return;
        }
        annotation.comment = html;
        annotation.contentUpdatedAt = Date.now();
        textCache.delete(annotation);
        destroyEditor();
        state.editing = null;
        state.newNoteId = null;
        renderAll();
        await persist(annotation, isNewNote ? 'panelNoteCreated' : 'panelSaved');
    }

    // ------------------------------------------------------------------
    // Sincronización con pestañas abiertas
    // ------------------------------------------------------------------
    const notifyTimers = new Map();
    const recentlyNotified = new Map(); // pageUrl -> ms epoch del último aviso
    const RECENT_NOTIFY_WINDOW_MS = 6000;

    /** Pide a las pestañas con esa página abierta que recarguen sus anotaciones. */
    function notifyTabs(pageUrl) {
        recentlyNotified.set(pageUrl, Date.now());
        clearTimeout(notifyTimers.get(pageUrl));
        notifyTimers.set(pageUrl, setTimeout(() => {
            notifyTimers.delete(pageUrl);
            chrome.tabs.query({}, (tabs) => {
                for (const tab of tabs || []) {
                    if (typeof tab.id !== 'number') continue;
                    try {
                        const maybePromise = chrome.tabs.sendMessage(tab.id, { action: 'reloadAnnotations', pageUrl });
                        if (maybePromise && typeof maybePromise.catch === 'function') maybePromise.catch(() => {});
                    } catch (e) {
                        // Pestaña sin content script.
                    }
                }
            });
        }, NOTIFY_DEBOUNCE_MS));
    }

    const liveTimers = new Map();

    /** `annotationsUpdated` de un content script: estado completo y actual de esa página. */
    function handleLiveUpdate(pageUrl, entries) {
        clearTimeout(liveTimers.get(pageUrl));
        liveTimers.set(pageUrl, setTimeout(() => {
            liveTimers.delete(pageUrl);
            if (!state.loaded) return;
            if (state.editing && state.editing.pageUrl === pageUrl) return; // no pisar una edición en curso
            // Tras un aviso nuestro, la pestaña vacía su lista antes de recargar
            // desde el backend: ese vacío transitorio no debe borrar el grupo.
            const emptyUpdate = !entries || entries.length === 0;
            const notifiedAt = recentlyNotified.get(pageUrl) || 0;
            if (emptyUpdate && Date.now() - notifiedAt < RECENT_NOTIFY_WINDOW_MS) return;
            if (state.newNoteId) {
                const pending = state.pages.get(pageUrl);
                if (pending && pending.annotations.has(state.newNoteId)) return;
            }
            const page = ensurePage(pageUrl);
            page.annotations = new Map();
            for (const entry of entries || []) {
                const annotation = Array.isArray(entry) ? entry[1] : null;
                if (!annotation || !annotation.id) continue;
                const copy = { ...annotation };
                delete copy.orphaned;
                page.annotations.set(copy.id, copy);
            }
            if (page.annotations.size === 0) state.pages.delete(pageUrl);
            else refreshPageMeta(page);
            renderAll();
            renderStats();
        }, LIVE_UPDATE_DEBOUNCE_MS));
    }

    // ------------------------------------------------------------------
    // Exportación
    // ------------------------------------------------------------------
    function markdownForPage(page, annotations) {
        const lines = [`## ${page.title || t('panelUntitledPage')}`, `<${pageHref(page.pageUrl)}>`, ''];
        for (const annotation of annotations) {
            if (isNote(annotation)) {
                lines.push(`**${t('panelPageNoteLabel')}**`);
            } else {
                const quote = derived(annotation).quote;
                if (quote) lines.push(...quote.split('\n').map((line) => `> ${line}`));
            }
            const comment = htmlToMarkdown(annotation.comment || '');
            if (comment) lines.push('', comment);
            lines.push('', `*${formatDate(createdTs(annotation))}*`, '');
        }
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function downloadFile(filename, content, mime) {
        const url = URL.createObjectURL(new Blob([content], { type: mime }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportMarkdown() {
        const now = new Date();
        const parts = [`# ${t('panelExportTitle')}`, '', `_${t('panelExportedOn', [dateFormatter.format(now)])}_`, ''];
        for (const group of state.lastGroups) {
            parts.push(markdownForPage(group.page, group.annotations), '', '---', '');
        }
        downloadFile(`quantum-highlighter-annotations-${isoDate(now)}.md`, parts.join('\n'), 'text/markdown;charset=utf-8');
    }

    function exportJson() {
        const now = new Date();
        const data = {
            format: 'quantum-highlighter-pro/annotations',
            version: 1,
            exportedAt: now.toISOString(),
            backend: state.backend,
            pages: state.lastGroups.map((group) => ({
                pageUrl: group.page.pageUrl,
                url: pageHref(group.page.pageUrl),
                title: group.page.title,
                annotations: group.annotations,
            })),
        };
        downloadFile(`quantum-highlighter-annotations-${isoDate(now)}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    }

    // ------------------------------------------------------------------
    // Tema, foco, toast, i18n
    // ------------------------------------------------------------------
    function applyTheme() {
        const dark = !!state.settings.sidebarDarkMode;
        document.body.classList.toggle('dark', dark);
        els.darkToggle.setAttribute('aria-pressed', String(dark));
        els.darkToggle.querySelector('.icon').innerHTML = iconSvg(dark ? 'sun' : 'moon');
    }

    async function toggleTheme() {
        const items = await chrome.storage.sync.get(SETTINGS_KEY);
        const current = (items && items[SETTINGS_KEY]) || {};
        const next = { ...current, sidebarDarkMode: !state.settings.sidebarDarkMode };
        state.settings = { ...state.settings, ...next };
        applyTheme();
        await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
    }

    function focusPage(pageUrl) {
        if (!pageUrl) return;
        state.focusPage = pageUrl;
        state.collapsed.delete(pageUrl);
        if (!state.loaded) return;
        const page = state.pages.get(pageUrl);
        if (!page) {
            state.focusPage = null;
            return;
        }
        if (hasActiveFilters() && !pageHasVisibleAnnotations(page)) resetFilters(false);
        render();
    }

    function applyFocus() {
        if (!state.focusPage) return;
        const target = els.groups.querySelector(`.page-group[data-page-url="${CSS.escape(state.focusPage)}"]`);
        state.focusPage = null;
        if (!target) return;
        requestAnimationFrame(() => {
            target.scrollIntoView({ block: 'start', behavior: 'smooth' });
            target.classList.add('focused');
            setTimeout(() => target.classList.remove('focused'), 2500);
        });
    }

    let toastTimer = null;
    function showToast(text, isError) {
        els.toast.textContent = text;
        els.toast.classList.toggle('error', !!isError);
        els.toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2600);
    }

    function localize() {
        document.title = t('panelPageTitle');
        document.documentElement.lang = (chrome.i18n.getUILanguage() || 'en').split('-')[0];
        document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const message = t(el.dataset.i18nTitle);
            el.title = message;
            el.setAttribute('aria-label', message);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    }

    function buildColorFilters() {
        els.colorFilters.replaceChildren(...COLORS.map((color) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'color-chip';
            chip.dataset.color = color;
            chip.style.setProperty('--chip-color', `var(--qhp-color-${color})`);
            chip.title = t(COLOR_KEYS[color]);
            chip.setAttribute('aria-pressed', 'false');
            return chip;
        }));
    }

    // ------------------------------------------------------------------
    // Eventos
    // ------------------------------------------------------------------
    function debounce(fn, ms) {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    function wireEvents() {
        els.search.addEventListener('input', debounce(() => {
            state.filters.query = els.search.value.trim().toLowerCase();
            render();
        }, 150));

        els.colorFilters.addEventListener('click', (event) => {
            const chip = event.target.closest('.color-chip');
            if (!chip) return;
            const color = chip.dataset.color;
            if (state.filters.colors.has(color)) state.filters.colors.delete(color);
            else state.filters.colors.add(color);
            chip.setAttribute('aria-pressed', String(state.filters.colors.has(color)));
            render();
        });

        els.typeFilters.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-type]');
            if (!button) return;
            state.filters.type = button.dataset.type;
            els.typeFilters.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', btn === button));
            render();
        });

        els.dateFilter.addEventListener('change', () => {
            state.filters.date = els.dateFilter.value;
            render();
        });

        els.withComment.addEventListener('change', () => {
            state.filters.withComment = els.withComment.checked;
            render();
        });

        els.siteFilters.addEventListener('click', (event) => {
            const button = event.target.closest('.site-btn');
            if (!button) return;
            const site = button.dataset.site;
            if (state.filters.sites.has(site)) state.filters.sites.delete(site);
            else state.filters.sites.add(site);
            button.classList.toggle('active', state.filters.sites.has(site));
            render();
        });

        els.clearFilters.addEventListener('click', () => resetFilters(true));

        els.sort.addEventListener('change', () => {
            state.sort = els.sort.value;
            render();
        });

        els.collapseToggle.addEventListener('click', () => {
            if (els.collapseToggle.dataset.mode === 'expand') {
                state.collapsed.clear();
            } else {
                for (const group of state.lastGroups) state.collapsed.add(group.page.pageUrl);
            }
            render();
        });

        els.refreshButton.addEventListener('click', () => loadAll());

        els.exportButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const open = els.exportMenu.hidden;
            closePopovers();
            els.exportMenu.hidden = !open;
            els.exportButton.setAttribute('aria-expanded', String(open));
        });

        els.exportMenu.addEventListener('click', (event) => {
            const item = event.target.closest('[data-export]');
            if (!item) return;
            closePopovers();
            if (item.dataset.export === 'json') exportJson();
            else exportMarkdown();
        });

        els.darkToggle.addEventListener('click', () => { toggleTheme(); });

        els.disclosureAccept.addEventListener('click', () => {
            const disclosure = QHP.disclosure;
            if (disclosure) disclosure.acknowledge(hideDisclosure);
            else hideDisclosure();
        });

        els.groups.addEventListener('click', onGroupsClick);
        // Los botones de la barra de formato no deben robar el foco al editor.
        els.groups.addEventListener('mousedown', (event) => {
            if (event.target.closest('.editor-toolbar button')) event.preventDefault();
        });

        document.addEventListener('click', (event) => {
            if (event.target.closest('.color-picker') || event.target.closest('.menu-wrapper')) return;
            closePopovers();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (!els.disclosureOverlay.hidden) {
                    hideDisclosure();
                    return;
                }
                closePopovers();
                if (state.editing) cancelEdit(true);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && state.editing) {
                event.preventDefault();
                saveEdit();
                return;
            }
            const tag = event.target && event.target.tagName;
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (event.target && event.target.isContentEditable);
            if (event.key === '/' && !typing) {
                event.preventDefault();
                els.search.focus();
                els.search.select();
            }
        });

        window.addEventListener('beforeunload', (event) => {
            if (!state.editing) return;
            event.preventDefault();
            event.returnValue = '';
        });

        chrome.runtime.onMessage.addListener((request) => {
            if (!request || typeof request.action !== 'string') return;
            if (request.action === 'panel:focusPage' && request.pageUrl) {
                focusPage(request.pageUrl);
            } else if (request.action === 'annotationsUpdated' && request.url) {
                handleLiveUpdate(request.url, request.data);
            }
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[SETTINGS_KEY]) {
                state.settings = { ...state.settings, ...(changes[SETTINGS_KEY].newValue || {}) };
                applyTheme();
            }
            if (namespace === 'sync' && QHP.disclosure && changes[QHP.disclosure.ACK_KEY]) {
                hideDisclosure();
            }
            if (namespace === 'local' && changes[SESSION_KEY]) {
                // Iniciar/cerrar sesión de Drive cambia el backend: recargar todo.
                loadAll();
                return;
            }
            if (namespace === 'sync' && state.backend === 'sync' && state.loaded && !state.editing && !state.newNoteId) {
                if (Date.now() < state.selfWriteUntil) return;
                if (Object.keys(changes).some((key) => key.startsWith(ANNOTATION_KEY_PREFIX))) scheduleExternalReload();
            }
        });
    }

    const scheduleExternalReload = debounce(() => loadAll(), 800);

    // ------------------------------------------------------------------
    // Arranque
    // ------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        Object.assign(els, {
            backendBadge: document.getElementById('backend-badge'),
            refreshButton: document.getElementById('refresh-button'),
            exportButton: document.getElementById('export-button'),
            exportMenu: document.getElementById('export-menu'),
            darkToggle: document.getElementById('dark-toggle'),
            cacheBanner: document.getElementById('cache-banner'),
            search: document.getElementById('search'),
            colorFilters: document.getElementById('color-filters'),
            typeFilters: document.getElementById('type-filters'),
            dateFilter: document.getElementById('date-filter'),
            withComment: document.getElementById('with-comment'),
            siteFilters: document.getElementById('site-filters'),
            clearFilters: document.getElementById('clear-filters'),
            stats: document.getElementById('stats'),
            resultCount: document.getElementById('result-count'),
            sort: document.getElementById('sort'),
            collapseToggle: document.getElementById('collapse-toggle'),
            loading: document.getElementById('loading'),
            emptyState: document.getElementById('empty-state'),
            noResults: document.getElementById('no-results'),
            groups: document.getElementById('groups'),
            toast: document.getElementById('toast'),
            privacyNoteText: document.getElementById('privacy-note-text'),
            privacyNoteLink: document.getElementById('privacy-note-link'),
            disclosureOverlay: document.getElementById('disclosure-overlay'),
            disclosureTitle: document.getElementById('disclosure-title'),
            disclosureIntro: document.getElementById('disclosure-intro'),
            disclosureBody: document.getElementById('disclosure-body'),
            disclosureLink: document.getElementById('disclosure-link'),
            disclosureAccept: document.getElementById('disclosure-accept'),
        });

        document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = iconSvg(el.dataset.icon); });
        localize();
        buildColorFilters();
        wireEvents();
        maybeShowDisclosure();

        chrome.storage.sync.get(SETTINGS_KEY, (items) => {
            state.settings = { ...state.settings, ...((items && items[SETTINGS_KEY]) || {}) };
            applyTheme();
        });

        const params = new URLSearchParams(window.location.search);
        const requestedPage = params.get('page');
        if (requestedPage) state.focusPage = requestedPage;

        loadAll();
    });
})();
