/*
 * Quantum Highlighter PRO — Storage Backend
 *
 * Fachada única para la persistencia de anotaciones. Expone una API estable a
 * `script.js` (content script) y helpers puros compartidos con el service
 * worker (`QHP.shared`, cargado allí vía importScripts). Backends:
 *
 *  - `SyncAnnotationsBackend`: chrome.storage.sync con chunking. Es el
 *    backend activo cuando el usuario no tiene sesión de Google Drive.
 *  - `DriveAnnotationsBackend`: proxy fino que delega en el service worker
 *    por mensajes `drive:*` (el SW es el único dueño del token OAuth).
 *  - `SwitchingAnnotationsBackend`: el backend público que devuelve la
 *    factoría; conmuta en vivo entre los dos anteriores según el flag de
 *    sesión `qhp-drive-session`.
 *
 * Este archivo se carga ANTES de `script.js` (ver `manifest.json`).
 */
(function () {
    'use strict';

    const ANNOTATION_KEY_PREFIX = 'highlighter-annotation-';
    const MAX_CHUNK_SIZE = 7400; // 7.4KB — buffer seguro frente a QUOTA_BYTES_PER_ITEM (8192)
    // Flag de sesión de Drive en chrome.storage.local:
    // { signedIn, account?, since, needsReauth? }. Lo escribe SOLO el SW.
    const SESSION_KEY = 'qhp-drive-session';
    const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

    // ------------------------------------------------------------------
    // Helpers puros compartidos entre el content script y el service
    // worker (QHP.shared). Nada de DOM ni de chrome.* aquí.
    // ------------------------------------------------------------------

    /**
     * Higiene de datos al cargar. Un `quoteExact` suelto en el nivel
     * superior solo puede venir de un objeto reensamblado y re-guardado
     * por una versión antigua en otro dispositivo; se descarta junto con
     * cualquier `quote` sin `exact` utilizable para que la cascada de
     * anclaje re-derive los selectores y los re-sane.
     */
    function sanitizeLoadedAnnotation(annotation) {
        delete annotation.quoteExact;
        if (annotation.quote && (typeof annotation.quote.exact !== 'string' || annotation.quote.exact.length === 0)) {
            delete annotation.quote;
        }
        return annotation;
    }

    /**
     * Reensambla anotaciones (chunked o no) a partir de un volcado de
     * storage. Con `pageUrl` filtra a esa página (uso de `load()`); con
     * `null` reensambla todo (migración global sync+local → Drive, F2.4).
     */
    function reassembleAll(items, pageUrl = null) {
        const annotations = new Map();
        const chunkMap = new Map();

        for (const key in items) {
            if (!key.startsWith(ANNOTATION_KEY_PREFIX)) continue;

            const item = items[key];
            if (!item || (pageUrl !== null && item.pageUrl !== pageUrl)) continue;

            if (item.chunking && item.chunking.isChunk) {
                const { originalId, chunkIndex, totalChunks } = item.chunking;
                if (!chunkMap.has(originalId)) {
                    chunkMap.set(originalId, new Array(totalChunks));
                }
                chunkMap.get(originalId)[chunkIndex] = item;
            } else {
                annotations.set(item.id, sanitizeLoadedAnnotation(item));
            }
        }

        for (const [originalId, chunks] of chunkMap.entries()) {
            if (chunks.some(c => c === undefined)) {
                console.warn(`Highlighter: Incomplete chunks for annotation ID ${originalId}. Skipping.`);
                continue;
            }

            const mainChunk = chunks[0];
            let fullText = mainChunk.text || '';
            let fullComment = mainChunk.comment || '';
            let fullQuoteExact = mainChunk.quoteExact || '';

            for (let i = 1; i < chunks.length; i++) {
                const chunkContent = chunks[i].content;
                if (chunkContent) {
                    if (chunkContent.text) fullText += chunkContent.text;
                    if (chunkContent.comment) fullComment += chunkContent.comment;
                    if (chunkContent.quoteExact) fullQuoteExact += chunkContent.quoteExact;
                }
            }

            const reassembledAnnotation = { ...mainChunk };
            delete reassembledAnnotation.chunking;
            delete reassembledAnnotation.quoteExact;
            reassembledAnnotation.text = fullText;
            reassembledAnnotation.comment = fullComment;
            if (fullQuoteExact) {
                reassembledAnnotation.quote = {
                    ...(mainChunk.quote || {}),
                    exact: fullQuoteExact,
                };
            }

            annotations.set(originalId, sanitizeLoadedAnnotation(reassembledAnnotation));
        }
        return annotations;
    }

    // --- Merge doble-LWW por grupos de campos (§5 del plan de Drive) ---
    //
    // El write-back del anclaje robusto re-guarda la anotación completa con
    // solo los anclajes refrescados; un LWW de anotación entera dejaría que
    // ese guardado de fondo pisara una edición real hecha en otro
    // dispositivo. Por eso cada copia lleva dos marcas (contentUpdatedAt /
    // anchorsUpdatedAt) y el merge decide cada grupo por separado.

    const ANCHOR_FIELDS = ['pointers', 'quote', 'position', 'schemaVersion', 'anchorsUpdatedAt'];

    /** Marca efectiva de contenido; sin estampar, vale la fecha de creación. */
    function effectiveContentTs(annotation) {
        if (!annotation) return 0;
        if (typeof annotation.contentUpdatedAt === 'number') return annotation.contentUpdatedAt;
        const created = Date.parse(annotation.createdAt || '');
        return Number.isNaN(created) ? 0 : created;
    }

    /** Marca efectiva de anclajes; sin estampar, vale la fecha de creación. */
    function effectiveAnchorsTs(annotation) {
        if (!annotation) return 0;
        if (typeof annotation.anchorsUpdatedAt === 'number') return annotation.anchorsUpdatedAt;
        const created = Date.parse(annotation.createdAt || '');
        return Number.isNaN(created) ? 0 : created;
    }

    /**
     * Fusiona dos copias de la misma anotación. Los campos de contenido
     * (text/comment/color/type/createdAt y cualquier campo futuro) los
     * aporta la copia con `contentUpdatedAt` mayor; el grupo de anclaje
     * (ANCHOR_FIELDS) la copia con `anchorsUpdatedAt` mayor. En empate gana
     * `incoming`. No muta sus argumentos.
     */
    function mergeAnnotationCopies(current, incoming) {
        if (!current) return incoming;
        if (!incoming) return current;
        const contentWinner = effectiveContentTs(incoming) >= effectiveContentTs(current) ? incoming : current;
        const anchorsWinner = effectiveAnchorsTs(incoming) >= effectiveAnchorsTs(current) ? incoming : current;
        const merged = { ...contentWinner };
        for (const field of ANCHOR_FIELDS) {
            if (field in anchorsWinner) merged[field] = anchorsWinner[field];
            else delete merged[field];
        }
        return merged;
    }

    /** Cuerpo vacío de archivo de página en Drive (§4 del plan). */
    function emptyPageBody(pageUrl) {
        return { version: 1, pageUrl, updatedAt: 0, annotations: {}, tombstones: {} };
    }

    /**
     * Aplica una lista de ops `{ type: 'upsert'|'delete', annotation?,
     * annotationId?, ts }` sobre un cuerpo de página y devuelve el cuerpo
     * resultante (no muta `body`). Reglas de conflicto:
     *  - upsert contra copia existente → mergeAnnotationCopies (LWW doble);
     *  - delete escribe tombstone salvo que la copia existente tenga
     *    contenido más nuevo que el borrado;
     *  - upsert contra tombstone solo resucita si su contenido es más nuevo
     *    que `deletedAt` (no resucitar borrados).
     * Invariante: un id vive en `annotations` o en `tombstones`, nunca en
     * ambos.
     */
    function applyOpsToPageBody(body, ops) {
        const out = {
            version: 1,
            pageUrl: body.pageUrl,
            updatedAt: body.updatedAt || 0,
            annotations: { ...(body.annotations || {}) },
            tombstones: { ...(body.tombstones || {}) },
        };
        const ordered = [...ops].sort((a, b) => (a.ts || 0) - (b.ts || 0));
        for (const op of ordered) {
            if (op.type === 'delete' && op.annotationId) {
                const id = op.annotationId;
                const deletedAt = op.ts || 0;
                const existing = out.annotations[id];
                if (existing && effectiveContentTs(existing) > deletedAt) continue;
                delete out.annotations[id];
                out.tombstones[id] = Math.max(out.tombstones[id] || 0, deletedAt);
            } else if (op.type === 'upsert' && op.annotation && op.annotation.id) {
                const incoming = sanitizeLoadedAnnotation({ ...op.annotation });
                const id = incoming.id;
                const tombstoneAt = out.tombstones[id] || 0;
                if (tombstoneAt && effectiveContentTs(incoming) <= tombstoneAt) continue;
                delete out.tombstones[id];
                out.annotations[id] = mergeAnnotationCopies(out.annotations[id], incoming);
            }
        }
        return out;
    }

    /** Poda in situ los tombstones con más de 90 días (§5 del plan). */
    function pruneTombstones(body, now = Date.now()) {
        for (const id of Object.keys(body.tombstones || {})) {
            if (now - body.tombstones[id] > TOMBSTONE_TTL_MS) delete body.tombstones[id];
        }
        return body;
    }

    /** Anotaciones vivas de un cuerpo de página, saneadas, como objeto id→anotación. */
    function liveAnnotations(body) {
        const result = {};
        for (const id of Object.keys(body.annotations || {})) {
            result[id] = sanitizeLoadedAnnotation({ ...body.annotations[id] });
        }
        return result;
    }

    /**
     * Backend de anotaciones contra chrome.storage.sync.
     * Conserva exactamente el comportamiento previo (chunking, limpieza de
     * legacy local, reensamblado en `load`). Es la implementación por defecto
     * cuando el usuario no ha iniciado sesión en Google Drive.
     */
    class SyncAnnotationsBackend {
        constructor() {
            this.annotationKeyPrefix = ANNOTATION_KEY_PREFIX;
            this.paramWhitelist = {};
            this.MAX_CHUNK_SIZE = MAX_CHUNK_SIZE;
            this._loadWhitelist();
        }

        _loadWhitelist() {
            const url = chrome.runtime.getURL('param-whitelist.json');
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => { this.paramWhitelist = data; })
                .catch(error => {
                    console.error('Highlighter: Could not load or parse param-whitelist.json. Using empty whitelist.', error);
                    this.paramWhitelist = {};
                });
        }

        getPageUrl() {
            const url = new URL(window.location.href);
            const hostname = url.hostname;
            const pathname = url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
            let pageUrl = `${hostname}${pathname}`;

            if (this.paramWhitelist[hostname]) {
                const paramsToKeep = this.paramWhitelist[hostname];
                const searchParams = new URLSearchParams(url.search);
                const keptParams = [];
                searchParams.forEach((value, key) => {
                    if (paramsToKeep.includes(key)) keptParams.push(`${key}=${value}`);
                });
                if (keptParams.length > 0) pageUrl += `?${keptParams.sort().join('&')}`;
            }
            return pageUrl;
        }

        generateId() {
            return `h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        async saveAnnotation(annotation, callback) {
            // includeLocal=true: si existe una copia local del mismo id
            // (descargada al cerrar sesión de Drive, §6-bis del plan), hay
            // que borrarla o taparía esta edición en load(), donde local
            // pisa a sync.
            await this._removeChunks(annotation.id, true);

            const annotationStr = JSON.stringify(annotation);
            const annotationSize = new TextEncoder().encode(annotationStr).length;

            if (annotationSize < this.MAX_CHUNK_SIZE) {
                const key = `${this.annotationKeyPrefix}${annotation.id}`;
                chrome.storage.sync.set({ [key]: annotation }, () => {
                    if (chrome.runtime.lastError) console.error('Error saving annotation:', chrome.runtime.lastError);
                    if (callback) callback();
                });
                return;
            }

            const chunks = this._createChunks(annotation);
            const dataToSave = {};
            chunks.forEach(chunk => {
                const chunkKey = `${this.annotationKeyPrefix}${chunk.id}`;
                dataToSave[chunkKey] = chunk;
            });

            chrome.storage.sync.set(dataToSave, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving annotation chunks:', chrome.runtime.lastError);
                } else {
                    if (callback) callback();
                }
            });
        }

        /**
         * Bytes UTF-8 de la representación JSON de `str` sin las comillas
         * envolventes. La cuota por item de chrome.storage.sync se mide sobre
         * el JSON serializado, así que contar caracteres (o incluso bytes del
         * texto crudo) subestima strings multibyte o con escapes.
         */
        _jsonByteLength(str) {
            return new TextEncoder().encode(JSON.stringify(str)).length - 2;
        }

        /**
         * Divide `str` en { head, rest } de forma que el JSON de `head` no
         * supere `budgetBytes`. Búsqueda binaria (el tamaño es monótono en la
         * longitud del prefijo); evita cortar un par sustituto por la mitad.
         */
        _splitByJsonBytes(str, budgetBytes) {
            if (!str) return { head: '', rest: '' };
            if (budgetBytes <= 0) return { head: '', rest: str };
            if (this._jsonByteLength(str) <= budgetBytes) return { head: str, rest: '' };
            let lo = 0;
            let hi = str.length; // invariante: el prefijo `lo` cabe, `hi` no
            while (hi - lo > 1) {
                const mid = (lo + hi) >> 1;
                if (this._jsonByteLength(str.slice(0, mid)) <= budgetBytes) lo = mid;
                else hi = mid;
            }
            const lastCode = lo > 0 ? str.charCodeAt(lo - 1) : 0;
            if (lastCode >= 0xD800 && lastCode <= 0xDBFF) lo--;
            return { head: str.slice(0, lo), rest: str.slice(lo) };
        }

        _createChunks(annotation) {
            const chunks = [];
            const originalId = annotation.id;

            const baseAnnotation = { ...annotation };
            delete baseAnnotation.text;
            delete baseAnnotation.comment;
            delete baseAnnotation.quote;

            // El contexto de la cita es pequeño y viaja en el chunk principal;
            // `quote.exact` (potencialmente grande) se derrama como los demás
            // campos de contenido.
            let quoteExactToChunk = '';
            if (annotation.quote && typeof annotation.quote.exact === 'string') {
                quoteExactToChunk = annotation.quote.exact;
                baseAnnotation.quote = {
                    prefix: annotation.quote.prefix || '',
                    suffix: annotation.quote.suffix || '',
                };
            }

            let baseStr = JSON.stringify(baseAnnotation);
            let baseSize = new TextEncoder().encode(baseStr).length;

            if (baseSize >= this.MAX_CHUNK_SIZE - 300) {
                // Sin espacio ni para el contenido mínimo: la cita se descarta
                // (es re-derivable y el anclaje la re-sana en la próxima visita).
                console.warn(`Highlighter: base annotation too large for chunking (${baseSize}B); dropping quote for ${originalId}.`);
                delete baseAnnotation.quote;
                quoteExactToChunk = '';
                baseStr = JSON.stringify(baseAnnotation);
                baseSize = new TextEncoder().encode(baseStr).length;
            }

            const availableContentSize = this.MAX_CHUNK_SIZE - baseSize - 150;

            let textToChunk = annotation.text || '';
            let commentToChunk = annotation.comment || '';

            const mainChunk = { ...baseAnnotation };
            mainChunk.chunking = {
                isChunk: true,
                originalId: originalId,
                chunkIndex: 0,
            };

            let remainingSize = availableContentSize;
            let split;

            split = this._splitByJsonBytes(textToChunk, remainingSize);
            mainChunk.text = split.head;
            textToChunk = split.rest;
            remainingSize -= this._jsonByteLength(mainChunk.text);

            split = this._splitByJsonBytes(commentToChunk, remainingSize);
            mainChunk.comment = split.head;
            commentToChunk = split.rest;
            remainingSize -= this._jsonByteLength(mainChunk.comment);

            split = this._splitByJsonBytes(quoteExactToChunk, remainingSize);
            mainChunk.quoteExact = split.head;
            quoteExactToChunk = split.rest;

            chunks.push(mainChunk);

            let chunkIndex = 1;
            while (textToChunk.length > 0 || commentToChunk.length > 0 || quoteExactToChunk.length > 0) {
                const contentForThisChunk = {};
                remainingSize = this.MAX_CHUNK_SIZE - 150;

                if (textToChunk.length > 0) {
                    split = this._splitByJsonBytes(textToChunk, remainingSize);
                    contentForThisChunk.text = split.head;
                    textToChunk = split.rest;
                    remainingSize -= this._jsonByteLength(contentForThisChunk.text);
                }

                if (commentToChunk.length > 0 && remainingSize > 0) {
                    split = this._splitByJsonBytes(commentToChunk, remainingSize);
                    contentForThisChunk.comment = split.head;
                    commentToChunk = split.rest;
                    remainingSize -= this._jsonByteLength(contentForThisChunk.comment);
                }

                if (quoteExactToChunk.length > 0 && remainingSize > 0) {
                    split = this._splitByJsonBytes(quoteExactToChunk, remainingSize);
                    contentForThisChunk.quoteExact = split.head;
                    quoteExactToChunk = split.rest;
                }

                const secondaryChunk = {
                    id: `${originalId}-chunk-${chunkIndex}`,
                    pageUrl: annotation.pageUrl,
                    chunking: {
                        isChunk: true,
                        originalId: originalId,
                        chunkIndex: chunkIndex,
                    },
                    content: contentForThisChunk
                };
                chunks.push(secondaryChunk);
                chunkIndex++;
            }

            const totalChunks = chunks.length;
            chunks.forEach(chunk => {
                chunk.chunking.totalChunks = totalChunks;
            });

            return chunks;
        }

        async removeAnnotation(annotationId, callback) {
            await this._removeChunks(annotationId, true);
            if (callback) callback();
        }

        async _removeChunks(originalId, includeLocal = false) {
            const keyPrefix = `${this.annotationKeyPrefix}${originalId}`;
            const mainKey = keyPrefix;

            const items = await new Promise(resolve => chrome.storage.sync.get(mainKey, resolve));
            const mainAnnotation = items[mainKey];

            const keysToRemove = [mainKey];
            if (mainAnnotation && mainAnnotation.chunking && mainAnnotation.chunking.isChunk) {
                const totalChunks = mainAnnotation.chunking.totalChunks;
                for (let i = 1; i < totalChunks; i++) {
                    keysToRemove.push(`${keyPrefix}-chunk-${i}`);
                }
            }

            await new Promise(resolve => chrome.storage.sync.remove(keysToRemove, resolve));
            if (chrome.runtime.lastError) console.error('Error removing sync chunks:', chrome.runtime.lastError);

            if (includeLocal) {
                await new Promise(resolve => chrome.storage.local.remove(keysToRemove, resolve));
                if (chrome.runtime.lastError) console.error('Error removing local chunks:', chrome.runtime.lastError);
            }
        }

        load(callback) {
            const pageUrl = this.getPageUrl();

            chrome.storage.sync.get(null, (syncItems) => {
                if (chrome.runtime.lastError) console.error('Error loading sync annotations:', chrome.runtime.lastError);

                chrome.storage.local.get(null, (localItems) => {
                    if (chrome.runtime.lastError) console.error('Error loading local annotations:', chrome.runtime.lastError);

                    const allItems = { ...(syncItems || {}), ...(localItems || {}) };
                    callback(reassembleAll(allItems, pageUrl));
                });
            });
        }

        /**
         * Reporta el uso actual del backend para la UI de "Sync".
         * Devuelve { backend, used, total, percentUsed, itemCount } en bytes.
         * Sólo cuenta las claves con prefijo de anotación (no settings).
         */
        async getStorageStats() {
            const QUOTA = chrome.storage.sync.QUOTA_BYTES || 102400; // 100 KB por defecto en chrome.storage.sync
            const usedBytes = await new Promise(resolve => {
                try {
                    chrome.storage.sync.getBytesInUse(null, bytes => resolve(bytes || 0));
                } catch (e) {
                    resolve(0);
                }
            });
            const items = await new Promise(resolve => chrome.storage.sync.get(null, resolve));
            let itemCount = 0;
            const seenOriginals = new Set();
            for (const key in items) {
                if (!key.startsWith(this.annotationKeyPrefix)) continue;
                const item = items[key];
                if (item && item.chunking && item.chunking.isChunk) {
                    seenOriginals.add(item.chunking.originalId);
                } else if (item && item.id) {
                    seenOriginals.add(item.id);
                }
            }
            itemCount = seenOriginals.size;
            return {
                backend: 'sync',
                used: usedBytes,
                total: QUOTA,
                percentUsed: QUOTA > 0 ? (usedBytes / QUOTA) : 0,
                itemCount
            };
        }
    }

    /**
     * Backend de anotaciones contra Google Drive. Es un proxy fino: cada
     * método manda un mensaje `drive:*` al service worker (único dueño del
     * token OAuth y del cliente REST) con el `pageUrl` ya resuelto, porque
     * la normalización depende de `window.location` y del param-whitelist
     * del content script. Solo debe usarse a través de
     * `SwitchingAnnotationsBackend`.
     */
    class DriveAnnotationsBackend {
        constructor(resolvePageUrl) {
            this.annotationKeyPrefix = ANNOTATION_KEY_PREFIX;
            this._resolvePageUrl = resolvePageUrl;
        }

        _send(message, callback) {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(`Highlighter: ${message.action} failed:`, chrome.runtime.lastError.message);
                        callback(null);
                        return;
                    }
                    if (!response || response.ok === false) {
                        console.error(`Highlighter: ${message.action} rejected:`, response && response.error);
                        callback(null);
                        return;
                    }
                    callback(response);
                });
            } catch (e) {
                console.error(`Highlighter: ${message.action} threw:`, e);
                callback(null);
            }
        }

        load(callback) {
            this._send({ action: 'drive:loadPage', pageUrl: this._resolvePageUrl() }, (response) => {
                const annotations = new Map();
                if (response && response.annotations) {
                    for (const id of Object.keys(response.annotations)) {
                        annotations.set(id, response.annotations[id]);
                    }
                }
                callback(annotations);
            });
        }

        saveAnnotation(annotation, callback) {
            this._send({
                action: 'drive:saveAnnotation',
                pageUrl: annotation.pageUrl || this._resolvePageUrl(),
                annotation,
            }, () => { if (callback) callback(); });
        }

        removeAnnotation(annotationId, callback) {
            this._send({
                action: 'drive:removeAnnotation',
                pageUrl: this._resolvePageUrl(),
                annotationId,
            }, () => { if (callback) callback(); });
        }

        getStorageStats() {
            return new Promise((resolve) => {
                this._send({ action: 'drive:stats' }, (response) => {
                    resolve(response && response.backend
                        ? response
                        : { backend: 'drive', used: 0, total: null, percentUsed: null, itemCount: 0, pageCount: 0 });
                });
            });
        }
    }

    /**
     * Backend público: delega llamada a llamada en sync o Drive según el
     * flag de sesión. La construcción es síncrona (script.js:1540) pero la
     * primera lectura del flag no: las llamadas que lleguen antes se
     * difieren tras `_ready` para no servir sync a un usuario con sesión.
     * `getPageUrl()`/`generateId()` no dependen del backend activo y
     * delegan siempre en sync (que posee el param-whitelist).
     */
    class SwitchingAnnotationsBackend {
        constructor() {
            this._sync = new SyncAnnotationsBackend();
            this._drive = new DriveAnnotationsBackend(() => this._sync.getPageUrl());
            this.annotationKeyPrefix = ANNOTATION_KEY_PREFIX;
            this._signedIn = false;
            this._sessionListeners = [];

            this._ready = new Promise((resolve) => {
                try {
                    chrome.storage.local.get(SESSION_KEY, (items) => {
                        this._signedIn = !!(items && items[SESSION_KEY] && items[SESSION_KEY].signedIn);
                        resolve();
                    });
                } catch (e) {
                    resolve();
                }
            });

            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace !== 'local' || !changes[SESSION_KEY]) return;
                const value = changes[SESSION_KEY].newValue;
                const signedIn = !!(value && value.signedIn);
                // Encadenado tras _ready: si el cambio llega mientras la
                // lectura inicial sigue en vuelo, se aplica después y en orden.
                this._ready.then(() => {
                    if (signedIn === this._signedIn) return;
                    this._signedIn = signedIn;
                    for (const listener of this._sessionListeners) {
                        try { listener(signedIn); } catch (e) {
                            console.error('Highlighter: session-change listener failed:', e);
                        }
                    }
                });
            });
        }

        /** Registra un callback (signedIn) => void para el cambio de backend en vivo. */
        onSessionChange(listener) {
            this._sessionListeners.push(listener);
        }

        getPageUrl() { return this._sync.getPageUrl(); }
        generateId() { return this._sync.generateId(); }

        _active() {
            return this._ready.then(() => (this._signedIn ? this._drive : this._sync));
        }

        load(callback) {
            this._active().then(backend => backend.load(callback));
        }

        saveAnnotation(annotation, callback) {
            this._active().then(backend => backend.saveAnnotation(annotation, callback));
        }

        removeAnnotation(annotationId, callback) {
            this._active().then(backend => backend.removeAnnotation(annotationId, callback));
        }

        getStorageStats() {
            return this._active().then(backend => backend.getStorageStats());
        }
    }

    // Exponemos backends y helpers en el contexto global (documento en el
    // content script, worker global en el SW vía importScripts).
    globalThis.QHP = globalThis.QHP || {};
    globalThis.QHP.SyncAnnotationsBackend = SyncAnnotationsBackend;
    globalThis.QHP.DriveAnnotationsBackend = DriveAnnotationsBackend;
    globalThis.QHP.SwitchingAnnotationsBackend = SwitchingAnnotationsBackend;
    globalThis.QHP.shared = {
        SESSION_KEY,
        ANNOTATION_KEY_PREFIX,
        TOMBSTONE_TTL_MS,
        sanitizeLoadedAnnotation,
        reassembleAll,
        effectiveContentTs,
        effectiveAnchorsTs,
        mergeAnnotationCopies,
        emptyPageBody,
        applyOpsToPageBody,
        pruneTombstones,
        liveAnnotations,
    };

    /**
     * Factoría que devuelve el backend activo: un
     * `SwitchingAnnotationsBackend` que conmuta en vivo entre sync y Drive
     * según el flag de sesión escrito por el service worker.
     */
    globalThis.QHP.createAnnotationsBackend = function createAnnotationsBackend() {
        return new SwitchingAnnotationsBackend();
    };
})();
