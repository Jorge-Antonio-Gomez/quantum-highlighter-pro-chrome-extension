/*
 * Quantum Highlighter PRO — Storage Backend
 *
 * Fachada única para la persistencia de anotaciones. Expone una API estable a
 * `script.js` (content script) y, más adelante, a `sidebar.js` y al service
 * worker. Hoy existe un único backend (`SyncAnnotationsBackend`) que escribe
 * en `chrome.storage.sync` con la misma lógica de chunking que existía en
 * `HighlightStorage`. En Fase 2 añadiremos `DriveAnnotationsBackend` y una
 * fachada que elija el backend activo según la sesión del usuario.
 *
 * Este archivo se carga ANTES de `script.js` (ver `manifest.json`).
 */
(function () {
    'use strict';

    const ANNOTATION_KEY_PREFIX = 'highlighter-annotation-';
    const MAX_CHUNK_SIZE = 7400; // 7.4KB — buffer seguro frente a QUOTA_BYTES_PER_ITEM (8192)

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
            await this._removeChunks(annotation.id);

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

        _createChunks(annotation) {
            const chunks = [];
            const originalId = annotation.id;

            const baseAnnotation = { ...annotation };
            delete baseAnnotation.text;
            delete baseAnnotation.comment;

            const baseStr = JSON.stringify(baseAnnotation);
            const baseSize = new TextEncoder().encode(baseStr).length;

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

            mainChunk.text = textToChunk.substring(0, remainingSize);
            textToChunk = textToChunk.substring(mainChunk.text.length);
            remainingSize -= new TextEncoder().encode(mainChunk.text).length;

            mainChunk.comment = commentToChunk.substring(0, remainingSize);
            commentToChunk = commentToChunk.substring(mainChunk.comment.length);

            chunks.push(mainChunk);

            let chunkIndex = 1;
            while (textToChunk.length > 0 || commentToChunk.length > 0) {
                const contentForThisChunk = {};
                remainingSize = this.MAX_CHUNK_SIZE - 150;

                if (textToChunk.length > 0) {
                    contentForThisChunk.text = textToChunk.substring(0, remainingSize);
                    textToChunk = textToChunk.substring(contentForThisChunk.text.length);
                    remainingSize -= new TextEncoder().encode(contentForThisChunk.text).length;
                }

                if (commentToChunk.length > 0) {
                    contentForThisChunk.comment = commentToChunk.substring(0, remainingSize);
                    commentToChunk = commentToChunk.substring(contentForThisChunk.comment.length);
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

            const processAndReassemble = (items) => {
                const annotations = new Map();
                const chunkMap = new Map();

                for (const key in items) {
                    if (!key.startsWith(this.annotationKeyPrefix)) continue;

                    const item = items[key];
                    if (!item || item.pageUrl !== pageUrl) continue;

                    if (item.chunking && item.chunking.isChunk) {
                        const { originalId, chunkIndex, totalChunks } = item.chunking;
                        if (!chunkMap.has(originalId)) {
                            chunkMap.set(originalId, new Array(totalChunks));
                        }
                        chunkMap.get(originalId)[chunkIndex] = item;
                    } else {
                        annotations.set(item.id, item);
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

                    for (let i = 1; i < chunks.length; i++) {
                        const chunkContent = chunks[i].content;
                        if (chunkContent) {
                            if (chunkContent.text) fullText += chunkContent.text;
                            if (chunkContent.comment) fullComment += chunkContent.comment;
                        }
                    }

                    const reassembledAnnotation = { ...mainChunk };
                    delete reassembledAnnotation.chunking;
                    reassembledAnnotation.text = fullText;
                    reassembledAnnotation.comment = fullComment;

                    annotations.set(originalId, reassembledAnnotation);
                }
                return annotations;
            };

            chrome.storage.sync.get(null, (syncItems) => {
                if (chrome.runtime.lastError) console.error('Error loading sync annotations:', chrome.runtime.lastError);

                chrome.storage.local.get(null, (localItems) => {
                    if (chrome.runtime.lastError) console.error('Error loading local annotations:', chrome.runtime.lastError);

                    const allItems = { ...(syncItems || {}), ...(localItems || {}) };
                    const finalAnnotations = processAndReassemble(allItems);
                    callback(finalAnnotations);
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

    // Exponemos el backend en el contexto global del documento. Se usa así
    // dentro del IIFE de script.js: `new QHP.SyncAnnotationsBackend()`.
    globalThis.QHP = globalThis.QHP || {};
    globalThis.QHP.SyncAnnotationsBackend = SyncAnnotationsBackend;

    /**
     * Factoría que devuelve el backend activo. Hoy siempre `SyncAnnotationsBackend`.
     * En Fase 2, si el usuario está autenticado con Drive, devolverá `DriveAnnotationsBackend`.
     */
    globalThis.QHP.createAnnotationsBackend = function createAnnotationsBackend() {
        return new SyncAnnotationsBackend();
    };
})();
