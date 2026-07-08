/*
 * Quantum Highlighter PRO — Anchoring
 *
 * Anclaje robusto de anotaciones al estilo W3C/Hypothes.is. Convierte un Range
 * en selectores redundantes (cita exacta + contexto + posición global) y
 * viceversa, con verificación y búsqueda difusa como último recurso, para que
 * los resaltados sobrevivan a cambios de estructura o de contenido de la
 * página.
 *
 * Expone `globalThis.QHP.anchoring`. Depende de `QHP.approxSearch`
 * (libs/approx-string-match.js). Ambos se cargan ANTES de `script.js`
 * (ver `manifest.json`).
 */
(function () {
    'use strict';

    // Cabeza máxima de `quote.exact` que se persiste. Mantiene el tamaño base
    // de la anotación muy por debajo del MAX_CHUNK_SIZE (7400) del chunker,
    // incluso si un dispositivo con una versión antigua re-guarda el objeto.
    const QUOTE_CAP = 4096;
    // Contexto alrededor de la cita (convención de Hypothes.is).
    const CONTEXT_LENGTH = 32;
    // Umbrales de aceptación del matching difuso: un resaltado mal colocado es
    // peor que uno huérfano.
    const ACCEPT_ERROR_RATE = 0.25;
    const ACCEPT_ERROR_RATE_WITH_CONTEXT = 0.30;
    const CONTEXT_SIMILARITY_FLOOR = 0.7;
    // Guardas de rendimiento / falsos positivos para la búsqueda difusa.
    const MIN_FUZZY_QUOTE_LENGTH = 12;
    const MAX_FUZZY_TEXT_LENGTH = 4000000;
    const MAX_CANDIDATES = 50;
    // Subárboles que no forman parte del texto de la página. El texto dentro
    // de `.highlighter-mark` SÍ se indexa (el mark envuelve texto sin alterarlo).
    const EXCLUDED_SELECTOR = 'script, style, noscript, #highlighter-host, #highlighter-sidebar-instance, #highlighter-resize-cover, #highlighter-resize-guide';

    /** Normalización compartida por captura y matching. */
    function normalizeText(s) {
        return String(s).replace(/\s+/g, ' ').trim();
    }

    /**
     * Texto plano derivado del campo legacy `text` (HTML sanitizado donde los
     * límites de bloque ya son `<br>`; ver getSanitizedHtmlFromRange).
     */
    function htmlToText(html) {
        if (typeof html !== 'string' || html === '') return '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.body.querySelectorAll('br').forEach(br => br.replaceWith(doc.createTextNode(' ')));
        return doc.body.textContent || '';
    }

    /**
     * Igualdad laxa entre dos textos: ignora todo el whitespace y tolera una
     * fracción `tolerance` de errores. Se usa para validar anclajes legacy
     * contra el texto derivado de `text` (los bordes de bloque `<p>`/`<br>`
     * impiden una igualdad normalizada estricta).
     */
    function looseEquals(a, b, tolerance = 0.1) {
        if (typeof a !== 'string' || typeof b !== 'string') return false;
        const sa = a.replace(/\s+/g, '');
        const sb = b.replace(/\s+/g, '');
        if (sa === sb) return true;
        if (!sa || !sb) return false;
        const shorter = sa.length <= sb.length ? sa : sb;
        const longer = sa.length <= sb.length ? sb : sa;
        const budget = Math.ceil(shorter.length * tolerance);
        // La diferencia de longitud ya consume presupuesto de edición; con esta
        // guarda, el matching por subcadena equivale a distancia de edición.
        if (longer.length - shorter.length > budget) return false;
        return globalThis.QHP.approxSearch(longer, shorter, budget).length > 0;
    }

    /**
     * Índice del texto visible de la página: concatenación de los nodos de
     * texto en orden de documento con mapeo offset global ↔ (nodo, offset).
     * Construirlo UNA vez por pasada de anclaje, nunca por anotación.
     */
    function buildTextIndex(root) {
        root = root || document.body;
        const doc = root.ownerDocument || document;
        const entries = [];
        const parts = [];
        const nodeMap = new Map();
        let offset = 0;

        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.data) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent || parent.closest(EXCLUDED_SELECTOR)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let node;
        while ((node = walker.nextNode())) {
            const entry = { node, start: offset, end: offset + node.data.length };
            entries.push(entry);
            nodeMap.set(node, entry);
            parts.push(node.data);
            offset = entry.end;
        }

        const text = parts.join('');
        let normalizedCache = null;

        /** Entry que contiene el offset global dado (start <= off < end). */
        function entryIndexAt(globalOffset) {
            let lo = 0, hi = entries.length - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (entries[mid].end <= globalOffset) lo = mid + 1;
                else if (entries[mid].start > globalOffset) hi = mid - 1;
                else return mid;
            }
            return -1;
        }

        function toRange(start, end) {
            if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
            if (start < 0 || end > text.length || start >= end) return null;
            const startIdx = entryIndexAt(start);
            const endIdx = entryIndexAt(end - 1);
            if (startIdx === -1 || endIdx === -1) return null;
            try {
                const range = doc.createRange();
                range.setStart(entries[startIdx].node, start - entries[startIdx].start);
                range.setEnd(entries[endIdx].node, end - entries[endIdx].start);
                return range;
            } catch (e) {
                return null;
            }
        }

        /**
         * Offset global de una frontera de Range. Para contenedores de texto
         * indexados es directo; para contenedores de elemento (o texto
         * excluido) se localiza el nodo indexado más cercano en orden de
         * documento (`isEnd` decide hacia qué lado se resuelve la frontera).
         */
        function boundaryToGlobal(container, offset, isEnd) {
            if (container.nodeType === Node.TEXT_NODE) {
                const entry = nodeMap.get(container);
                if (entry) return entry.start + Math.min(offset, container.data.length);
            }
            if (entries.length === 0) return null;
            let probe;
            try {
                probe = doc.createRange();
                probe.setStart(container, offset);
                probe.collapse(true);
            } catch (e) {
                return null;
            }
            // Primer entry cuyo inicio queda en o después de la frontera.
            let lo = 0, hi = entries.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                let cmp;
                try { cmp = probe.comparePoint(entries[mid].node, 0); } catch (e) { cmp = 1; }
                if (cmp < 0) lo = mid + 1;
                else hi = mid;
            }
            if (!isEnd) return lo < entries.length ? entries[lo].start : text.length;
            return lo > 0 ? entries[lo - 1].end : 0;
        }

        /**
         * Vista con whitespace colapsado (sin trim) y mapeo de offsets de
         * vuelta al texto crudo. Lazy: solo se construye si la búsqueda exacta
         * falla.
         */
        function normalized() {
            if (normalizedCache) return normalizedCache;
            const chars = [];
            const rawStart = [];
            const rawEnd = [];
            let inWhitespace = false;
            for (let i = 0; i < text.length; i++) {
                if (/\s/.test(text[i])) {
                    if (inWhitespace) {
                        rawEnd[rawEnd.length - 1] = i + 1;
                        continue;
                    }
                    inWhitespace = true;
                    chars.push(' ');
                } else {
                    inWhitespace = false;
                    chars.push(text[i]);
                }
                rawStart.push(i);
                rawEnd.push(i + 1);
            }
            normalizedCache = { text: chars.join(''), rawStart, rawEnd };
            return normalizedCache;
        }

        return { text, entries, nodeMap, entryIndexAt, toRange, boundaryToGlobal, normalized };
    }

    /**
     * Describe un Range como selectores {quote, position} sobre el índice.
     * Llamar SIEMPRE antes de mutar el DOM (wrapRange invalida los nodos).
     */
    function rangeToSelectors(range, index) {
        if (!range || range.collapsed) return null;
        const start = index.boundaryToGlobal(range.startContainer, range.startOffset, false);
        const end = index.boundaryToGlobal(range.endContainer, range.endOffset, true);
        if (start === null || end === null || end <= start) return null;
        return {
            quote: {
                exact: index.text.slice(start, Math.min(end, start + QUOTE_CAP)),
                prefix: index.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
                suffix: index.text.slice(end, Math.min(index.text.length, end + CONTEXT_LENGTH)),
            },
            position: { start, end },
        };
    }

    function positionToRange(position, index) {
        if (!position || !Number.isInteger(position.start) || !Number.isInteger(position.end)) return null;
        return index.toRange(position.start, position.end);
    }

    /**
     * Similitud [0,1] del contexto (prefix/suffix) alrededor de un candidato.
     * Devuelve null si no hay contexto que evaluar.
     */
    function contextSimilarity(index, context, at, isSuffix) {
        if (typeof context !== 'string' || context.length === 0) return null;
        const windowSize = context.length * 2 + 8;
        const windowText = isSuffix
            ? index.text.slice(at, Math.min(index.text.length, at + windowSize))
            : index.text.slice(Math.max(0, at - windowSize), at);
        if (windowText.length === 0) return 0;
        if (isSuffix ? windowText.startsWith(context) : windowText.endsWith(context)) return 1;
        const budget = Math.max(1, Math.floor(context.length / 2));
        const matches = globalThis.QHP.approxSearch(windowText, context, budget);
        if (matches.length === 0) return 0;
        return Math.max(0, 1 - matches[0].errors / context.length);
    }

    /**
     * Busca la cita en el índice: exacta → normalizada → difusa. Desambigua
     * candidatos con scoring estilo Hypothes.is (cita 50, prefix 20, suffix 20,
     * proximidad a `hintPosition` 2) y aplica el umbral de aceptación.
     *
     * options: { hintPosition?: number, fullLength?: number } — `fullLength`
     * extiende el final cuando `exact` es la cabeza capada de una cita larga.
     *
     * Devuelve { range, start, end, method: 'exact'|'normalized'|'fuzzy',
     * errorRate } o null.
     */
    function quoteToRange(quote, index, options = {}) {
        if (!quote || typeof quote.exact !== 'string') return null;
        const exact = quote.exact;
        const normExact = normalizeText(exact);
        if (normExact === '') return null;
        const hint = Number.isFinite(options.hintPosition) ? options.hintPosition : null;
        const fullLength = Number.isInteger(options.fullLength) && options.fullLength > exact.length
            ? options.fullLength : null;

        let candidates = [];
        let method = 'exact';

        let from = 0;
        while (candidates.length < MAX_CANDIDATES) {
            const at = index.text.indexOf(exact, from);
            if (at === -1) break;
            candidates.push({ start: at, end: at + exact.length, errors: 0 });
            from = at + 1;
        }

        if (candidates.length === 0) {
            method = 'normalized';
            const norm = index.normalized();
            let nFrom = 0;
            while (candidates.length < MAX_CANDIDATES) {
                const at = norm.text.indexOf(normExact, nFrom);
                if (at === -1) break;
                candidates.push({
                    start: norm.rawStart[at],
                    end: norm.rawEnd[at + normExact.length - 1],
                    errors: 0,
                });
                nFrom = at + 1;
            }
        }

        if (candidates.length === 0) {
            method = 'fuzzy';
            if (normExact.length < MIN_FUZZY_QUOTE_LENGTH) return null;
            if (index.text.length > MAX_FUZZY_TEXT_LENGTH) return null;
            const maxErrors = Math.min(256, Math.floor(exact.length / 2));
            candidates = globalThis.QHP.approxSearch(index.text, exact, maxErrors)
                .slice(0, MAX_CANDIDATES)
                .map(m => ({ start: m.start, end: m.end, errors: m.errors }));
            if (candidates.length === 0) return null;
        }

        const scored = candidates.map(c => {
            const errorRate = c.errors / Math.max(1, exact.length);
            const prefixSim = contextSimilarity(index, quote.prefix, c.start, false);
            const suffixSim = contextSimilarity(index, quote.suffix, c.end, true);
            let score = 50 * (1 - errorRate);
            if (prefixSim !== null) score += 20 * prefixSim;
            if (suffixSim !== null) score += 20 * suffixSim;
            if (hint !== null) {
                score += 2 * (1 - Math.min(1, Math.abs(c.start - hint) / Math.max(1, index.text.length)));
            }
            return { ...c, errorRate, prefixSim, suffixSim, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        const contextOk = best.prefixSim !== null && best.suffixSim !== null &&
            best.prefixSim >= CONTEXT_SIMILARITY_FLOOR && best.suffixSim >= CONTEXT_SIMILARITY_FLOOR;
        if (best.errorRate > (contextOk ? ACCEPT_ERROR_RATE_WITH_CONTEXT : ACCEPT_ERROR_RATE)) return null;

        const end = fullLength !== null
            ? Math.min(index.text.length, best.start + fullLength)
            : best.end;
        const range = index.toRange(best.start, end);
        if (!range) return null;
        return { range, start: best.start, end, method, errorRate: best.errorRate };
    }

    /**
     * Un rango resuelto solo es válido si su texto coincide (normalizado) con
     * la cita esperada. Para citas capadas se compara solo la cabeza.
     */
    function verifyRange(range, exact) {
        if (!range || typeof exact !== 'string') return false;
        const normExpected = normalizeText(exact);
        if (normExpected === '') return false;
        const normActual = normalizeText(range.toString());
        if (exact.length >= QUOTE_CAP) {
            return normActual.slice(0, normExpected.length) === normExpected;
        }
        return normActual === normExpected;
    }

    globalThis.QHP = globalThis.QHP || {};
    globalThis.QHP.anchoring = {
        QUOTE_CAP,
        CONTEXT_LENGTH,
        buildTextIndex,
        rangeToSelectors,
        positionToRange,
        quoteToRange,
        verifyRange,
        normalizeText,
        htmlToText,
        looseEquals,
    };
})();
