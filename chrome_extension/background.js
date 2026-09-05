// Helpers puros compartidos con el content script (QHP.shared): merge LWW
// doble, tombstones, cuerpos de página y reensamblado de chunks.
importScripts('storage-backend.js');

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "welcome.html"
    });
    await chrome.storage.sync.set({ 'highlighter-settings': { useDarkText: true } });
  }
  if (details.reason === "install" || details.reason === "update") {
    installPanelContextMenu();
    const url = chrome.runtime.getURL("excluded-websites.json");
    try {
      const response = await fetch(url);
      const { version, sites } = await response.json();

      const { excluded_websites_version, disabledSites = [] } = await chrome.storage.sync.get([
          "excluded_websites_version",
          "disabledSites",
        ]);

      if (version !== excluded_websites_version) {
        const newDisabledSites = [...new Set([...disabledSites, ...sites])];
        await chrome.storage.sync.set({
          disabledSites: newDisabledSites,
          excluded_websites_version: version,
        });
      }
    } catch (error) {
      console.error("Error loading excluded sites:", error);
    }
  }
});

chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }).catch(() => {
            // Sin content script (chrome://, tienda, visor de PDF…): el sidebar
            // no puede cargarse, así que se abre el panel global de anotaciones.
            openAnnotationsPanel();
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openTab') {
        chrome.tabs.create({ url: request.url, active: true });
        return;
    }
    if (request.action === 'openAnnotationsPanel') {
        openAnnotationsPanel(request.pageUrl);
        return;
    }
    if (typeof request.action === 'string' && request.action.startsWith('drive:')) {
        handleDriveMessage(request)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, error: String((error && error.message) || error) }));
        return true; // respuesta asíncrona
    }
    // El resto de acciones (settingsChanged, annotationsUpdated, …) son
    // broadcasts entre content script y sidebar; el SW no participa.
});

/* =====================================================================
 * Panel de anotaciones (annotations.html)
 *
 * Página de la extensión a pestaña completa con TODAS las anotaciones de
 * todos los sitios. Se abre desde el sidebar, desde el menú contextual del
 * icono y, como alternativa, al pulsar el icono en páginas donde el
 * content script no puede ejecutarse. Se reutiliza la pestaña si ya existe.
 * ===================================================================== */

const PANEL_PATH = 'annotations.html';
const PANEL_MENU_ID = 'qhp-open-annotations-panel';

async function openAnnotationsPanel(pageUrl) {
    const base = chrome.runtime.getURL(PANEL_PATH);
    try {
        const tabs = await chrome.tabs.query({ url: `${base}*` });
        // Sin permiso "tabs", Chrome ignora el filtro `url` y devuelve todas
        // las pestañas: comprobar la URL antes de reutilizar una.
        const panelTab = (tabs || []).find((tab) => typeof tab.url === 'string' && tab.url.startsWith(base));
        if (panelTab) {
            const tab = panelTab;
            await chrome.tabs.update(tab.id, { active: true });
            if (typeof tab.windowId === 'number') {
                await chrome.windows.update(tab.windowId, { focused: true });
            }
            if (pageUrl) {
                chrome.tabs.sendMessage(tab.id, { action: 'panel:focusPage', pageUrl }).catch(() => {});
            }
            return;
        }
    } catch (e) {
        // Sin permiso para filtrar pestañas por URL: se abre una nueva.
    }
    const url = pageUrl ? `${base}?page=${encodeURIComponent(pageUrl)}` : base;
    await chrome.tabs.create({ url, active: true });
}

function installPanelContextMenu() {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: PANEL_MENU_ID,
            title: chrome.i18n.getMessage('openAnnotationsPanel'),
            contexts: ['action'],
        });
    });
}

if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener((info) => {
        if (info.menuItemId === PANEL_MENU_ID) openAnnotationsPanel();
    });
}

/* =====================================================================
 * Sincronización con Google Drive (drive.appdata) — F2.1–F2.3 del plan.
 *
 * El SW es el único dueño del token OAuth y del cliente REST. Los content
 * scripts hablan por mensajes `drive:*` (ver DriveAnnotationsBackend en
 * storage-backend.js). Las escrituras pasan por una cola persistente en
 * chrome.storage.local (los SW de MV3 se suspenden) que se vacía con un
 * read-merge-write por página contra `appDataFolder`.
 * ===================================================================== */

const DRIVE = {
    SESSION_KEY: QHP.shared.SESSION_KEY,      // 'qhp-drive-session'
    QUEUE_KEY: 'qhp-drive-queue',
    CACHE_PREFIX: 'qhp-drive-cache-',
    LAST_SYNC_KEY: 'qhp-drive-last-sync',
    BACKOFF_KEY: 'qhp-drive-backoff',
    ABSORB_PENDING_KEY: 'qhp-drive-absorb-pending',
    FLUSH_ALARM: 'qhp-drive-flush',
    API: 'https://www.googleapis.com/drive/v3',
    UPLOAD_API: 'https://www.googleapis.com/upload/drive/v3',
    LOAD_TIMEOUT_MS: 4000,                    // lectura con timeout corto (§5)
};

class DriveError extends Error {
    // code: 'auth' | 'rate' | 'network' | 'http'
    constructor(code, message) {
        super(`[${code}] ${message}`);
        this.code = code;
    }
}

function getLocal(key) {
    return chrome.storage.local.get(key).then(items => items[key]);
}

// ---------------------------------------------------------------------
// Flag de sesión (única fuente de verdad, escrito SOLO aquí)
// ---------------------------------------------------------------------

async function getDriveSession() {
    return (await getLocal(DRIVE.SESSION_KEY)) || { signedIn: false };
}

async function setDriveSession(session) {
    await chrome.storage.local.set({ [DRIVE.SESSION_KEY]: session });
}

/**
 * El grant dejó de ser válido (revocado o caducado sin refresh posible).
 * La UI ofrecerá re-conectar; nunca se lanza un prompt espontáneo.
 */
async function markNeedsReauth() {
    const session = await getDriveSession();
    if (!session.signedIn || session.needsReauth) return;
    await setDriveSession({ ...session, needsReauth: true });
    await chrome.alarms.clear(DRIVE.FLUSH_ALARM);
}

// ---------------------------------------------------------------------
// Token OAuth (chrome.identity)
// ---------------------------------------------------------------------

function getToken(interactive) {
    return new Promise((resolve, reject) => {
        try {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(new DriveError('auth', chrome.runtime.lastError ? chrome.runtime.lastError.message : 'no token'));
                } else {
                    resolve(token);
                }
            });
        } catch (e) {
            reject(new DriveError('auth', String(e)));
        }
    });
}

function removeCachedToken(token) {
    return new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));
}

// ---------------------------------------------------------------------
// fetch autenticado con reintento de 401 y clasificación de errores
// ---------------------------------------------------------------------

async function rawDriveFetch(url, init, token) {
    try {
        return await fetch(url, {
            ...init,
            headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
        });
    } catch (e) {
        throw new DriveError('network', String((e && e.message) || e));
    }
}

async function read403Reason(response) {
    try {
        const body = await response.json();
        return (body.error && (
            (body.error.errors && body.error.errors[0] && body.error.errors[0].reason) ||
            body.error.status ||
            body.error.message
        )) || 'forbidden';
    } catch (e) {
        return 'forbidden';
    }
}

/**
 * 401 → invalidar token cacheado y reintentar en silencio una vez; si
 * persiste, needsReauth. Deja pasar el 404 (los llamantes lo tratan como
 * «no existe»); cualquier otro !ok se lanza clasificado.
 */
async function driveFetch(url, init = {}) {
    let token;
    try {
        token = await getToken(false);
    } catch (e) {
        await markNeedsReauth();
        throw e;
    }

    let response = await rawDriveFetch(url, init, token);

    if (response.status === 401) {
        await removeCachedToken(token);
        try {
            token = await getToken(false);
        } catch (e) {
            await markNeedsReauth();
            throw e;
        }
        response = await rawDriveFetch(url, init, token);
        if (response.status === 401) {
            await markNeedsReauth();
            throw new DriveError('auth', '401 tras reintento con token fresco');
        }
    }

    if (response.status === 429) throw new DriveError('rate', 'HTTP 429');
    if (response.status === 403) {
        const reason = await read403Reason(response);
        if (/ratelimit/i.test(reason)) throw new DriveError('rate', `403 ${reason}`);
        throw new DriveError('http', `403 ${reason}`);
    }
    if (!response.ok && response.status !== 404) {
        throw new DriveError('http', `HTTP ${response.status}`);
    }
    return response;
}

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new DriveError('network', `timeout ${ms}ms`)), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });
}

// ---------------------------------------------------------------------
// Cliente REST de Drive v3 sobre appDataFolder (§4 del plan)
// ---------------------------------------------------------------------

async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function pageFileName(hash) {
    return `page-${hash}.json`;
}

/**
 * Lookup por nombre exacto. No se usa appProperties.pageUrl para buscar:
 * cada entrada está limitada a 124 bytes y las URLs lo exceden; el pageUrl
 * completo viaja dentro del JSON.
 */
async function findPageFile(fileName) {
    const q = encodeURIComponent(`name = '${fileName}'`);
    const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
    const response = await driveFetch(
        `${DRIVE.API}/files?spaces=appDataFolder&q=${q}&orderBy=modifiedTime%20desc&fields=${fields}`
    );
    const body = await response.json();
    const files = (body && body.files) || [];
    if (files.length > 1) {
        // Carrera de creación entre dispositivos (§5: ventana aceptable).
        console.warn(`QHP Drive: ${files.length} archivos para ${fileName}; se usa el más reciente.`);
    }
    return files[0] || null;
}

async function downloadPageBody(fileId) {
    const response = await driveFetch(`${DRIVE.API}/files/${fileId}?alt=media`);
    if (response.status === 404) return null;
    try {
        return await response.json();
    } catch (e) {
        console.error('QHP Drive: JSON corrupto en Drive; se tratará como vacío.', e);
        return null;
    }
}

function multipartBody(boundary, metadata, content) {
    return (
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(content)}\r\n` +
        `--${boundary}--`
    );
}

function makeBoundary() {
    return `qhp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// appProperties.qhpAnnotations permite a drive:stats contar anotaciones
// desde files.list sin descargar cuerpos; por eso las escrituras son
// multipart (metadata + media) también en la actualización.
function pageFileAppProperties(body) {
    return { qhpAnnotations: String(Object.keys(body.annotations || {}).length) };
}

async function createPageFile(fileName, body) {
    const boundary = makeBoundary();
    const metadata = {
        name: fileName,
        parents: ['appDataFolder'],
        appProperties: pageFileAppProperties(body),
    };
    await driveFetch(`${DRIVE.UPLOAD_API}/files?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody(boundary, metadata, body),
    });
}

/** @returns false si el archivo desapareció bajo nuestros pies (404). */
async function updatePageFile(fileId, body) {
    const boundary = makeBoundary();
    const metadata = { appProperties: pageFileAppProperties(body) };
    const response = await driveFetch(`${DRIVE.UPLOAD_API}/files/${fileId}?uploadType=multipart&fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody(boundary, metadata, body),
    });
    return response.status !== 404;
}

// Solo mantenimiento (la usará F2.4: limpieza en el cierre de sesión).
async function deletePageFile(fileId) {
    await driveFetch(`${DRIVE.API}/files/${fileId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------
// Caché local de cuerpos de página (lecturas offline, §5)
// ---------------------------------------------------------------------

function cacheKeyFor(hash) {
    return `${DRIVE.CACHE_PREFIX}${hash}`;
}

async function getCachedPageBody(hash) {
    return (await getLocal(cacheKeyFor(hash))) || null;
}

async function setCachedPageBody(hash, body) {
    await chrome.storage.local.set({ [cacheKeyFor(hash)]: body });
}

// ---------------------------------------------------------------------
// Cola de escritura persistente (§5)
// ---------------------------------------------------------------------

// Serializa las mutaciones read-modify-write de la cola: dos enqueue (o un
// enqueue y la limpieza post-flush) intercalados se pisarían la lista.
let queueLock = Promise.resolve();
function withQueueLock(fn) {
    const run = queueLock.then(fn, fn);
    queueLock = run.then(() => undefined, () => undefined);
    return run;
}

async function readQueue() {
    return (await getLocal(DRIVE.QUEUE_KEY)) || [];
}

async function enqueueOp(op) {
    op.seq = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await withQueueLock(async () => {
        const queue = await readQueue();
        queue.push(op);
        await chrome.storage.local.set({ [DRIVE.QUEUE_KEY]: queue });
    });
    await ensureFlushAlarm();
    flushQueue(); // si hay red se sube ya; si no, queda para el alarm
}

async function removeOpsFromQueue(ops) {
    const seqs = new Set(ops.map(op => op.seq));
    await withQueueLock(async () => {
        const queue = await readQueue();
        await chrome.storage.local.set({ [DRIVE.QUEUE_KEY]: queue.filter(op => !seqs.has(op.seq)) });
    });
}

async function ensureFlushAlarm() {
    const existing = await chrome.alarms.get(DRIVE.FLUSH_ALARM);
    if (!existing) chrome.alarms.create(DRIVE.FLUSH_ALARM, { periodInMinutes: 1 });
}

// ---------------------------------------------------------------------
// Backoff exponencial para 403 userRateLimitExceeded / 429 (§5)
// ---------------------------------------------------------------------

async function noteRateLimit() {
    const state = (await getLocal(DRIVE.BACKOFF_KEY)) || { failures: 0 };
    const failures = state.failures + 1;
    const delayMinutes = Math.min(Math.pow(2, failures - 1), 60);
    await chrome.storage.local.set({
        [DRIVE.BACKOFF_KEY]: { failures, until: Date.now() + delayMinutes * 60000 },
    });
    chrome.alarms.create(DRIVE.FLUSH_ALARM, { delayInMinutes: delayMinutes, periodInMinutes: 1 });
}

async function clearBackoff() {
    await chrome.storage.local.remove(DRIVE.BACKOFF_KEY);
}

// ---------------------------------------------------------------------
// Flush: read-merge-write por página (§5)
// ---------------------------------------------------------------------

let flushInFlight = null;
let flushRequestedAgain = false;

function flushQueue() {
    if (flushInFlight) {
        flushRequestedAgain = true;
        return flushInFlight;
    }
    flushInFlight = doFlushQueue()
        .catch((error) => console.warn('QHP Drive: flush interrumpido:', (error && error.message) || error))
        .finally(() => {
            flushInFlight = null;
            if (flushRequestedAgain) {
                flushRequestedAgain = false;
                flushQueue();
            }
        });
    return flushInFlight;
}

async function doFlushQueue() {
    const session = await getDriveSession();
    if (!session.signedIn || session.needsReauth) return;

    const backoff = await getLocal(DRIVE.BACKOFF_KEY);
    if (backoff && Date.now() < backoff.until) return;

    // Retomar una absorción incompleta antes de la cola: sus páginas son
    // prerequisito para que las lecturas vean el estado completo.
    if (await getLocal(DRIVE.ABSORB_PENDING_KEY)) {
        const absorption = await runAbsorption();
        if (!absorption.complete) return; // alarm/backoff ya gestionados dentro
    }

    const queue = await readQueue();
    if (queue.length === 0) {
        await chrome.alarms.clear(DRIVE.FLUSH_ALARM);
        return;
    }

    // Agrupar por página: N ops (p. ej. los write-backs del anclaje) se
    // traducen en UNA lectura + UNA escritura por página, no en N requests.
    const byPage = new Map();
    for (const op of queue) {
        if (!byPage.has(op.pageUrl)) byPage.set(op.pageUrl, []);
        byPage.get(op.pageUrl).push(op);
    }

    for (const [pageUrl, ops] of byPage) {
        try {
            await flushPage(pageUrl, ops);
            await removeOpsFromQueue(ops);
        } catch (error) {
            const code = error && error.code;
            if (code === 'rate') { await noteRateLimit(); return; }
            if (code === 'auth') return;                      // markNeedsReauth ya paró el alarm
            if (code === 'network') { await ensureFlushAlarm(); return; }
            // http inesperado: no bloquear al resto de páginas; el alarm reintenta
            console.warn(`QHP Drive: fallo subiendo ${pageUrl}:`, (error && error.message) || error);
        }
    }

    const remaining = await readQueue();
    if (remaining.length === 0) {
        await clearBackoff();
        await chrome.alarms.clear(DRIVE.FLUSH_ALARM);
    } else {
        await ensureFlushAlarm();
    }
}

async function flushPage(pageUrl, ops) {
    const hash = await sha256Hex(pageUrl);
    const fileName = pageFileName(hash);

    // 1. Leer el estado actual de Drive. Si la lectura falla, se lanza y
    //    las ops quedan en cola: nunca escribir a ciegas sobre lo no leído.
    const file = await findPageFile(fileName);
    let base = file ? await downloadPageBody(file.id) : null;
    if (!base || typeof base !== 'object' || !base.annotations) {
        base = QHP.shared.emptyPageBody(pageUrl);
    }

    // 2. Merge LWW doble + tombstones y 3. poda de tombstones viejos.
    const merged = QHP.shared.applyOpsToPageBody(base, ops);
    QHP.shared.pruneTombstones(merged);
    merged.updatedAt = Date.now();

    // 4. Escribir y actualizar caché + lastSyncAt.
    let updated = false;
    if (file) updated = await updatePageFile(file.id, merged);
    if (!updated) await createPageFile(fileName, merged);

    await setCachedPageBody(hash, merged);
    await chrome.storage.local.set({ [DRIVE.LAST_SYNC_KEY]: Date.now() });
}

// ---------------------------------------------------------------------
// Absorción sync+local → Drive (§6): paso idempotente del sign-in
// ---------------------------------------------------------------------

async function collectStoredAnnotationItems() {
    const [syncItems, localItems] = await Promise.all([
        chrome.storage.sync.get(null),
        chrome.storage.local.get(null),
    ]);
    const onlyAnnotations = (items) => {
        const out = {};
        for (const key of Object.keys(items || {})) {
            if (key.startsWith(QHP.shared.ANNOTATION_KEY_PREFIX)) out[key] = items[key];
        }
        return out;
    };
    return {
        syncAnnotations: onlyAnnotations(syncItems),
        localAnnotations: onlyAnnotations(localItems),
    };
}

/**
 * Absorbe todas las anotaciones de chrome.storage.sync y .local hacia
 * Drive con el read-merge-write de §5 (el LWW respeta lo que ya hubiera
 * de otros dispositivos). Solo limpia las claves de origen si TODAS las
 * páginas se escribieron bien; si no, es seguro reintentar (idempotente).
 * Los errores rate/auth/network se relanzan para que el llamante gestione
 * backoff/reauth/alarm.
 */
async function absorbIntoDrive() {
    const { syncAnnotations, localAnnotations } = await collectStoredAnnotationItems();
    const syncKeys = Object.keys(syncAnnotations);
    const localKeys = Object.keys(localAnnotations);
    if (syncKeys.length === 0 && localKeys.length === 0) {
        return { pages: 0, annotations: 0, complete: true };
    }

    // Cada origen se reensambla por separado y se fusiona por id con el
    // LWW doble: un mismo id puede vivir en ambos (p. ej. copia descargada
    // en un cierre de sesión previo + copia llegada por Chrome sync).
    const syncMap = QHP.shared.reassembleAll(syncAnnotations);
    const localMap = QHP.shared.reassembleAll(localAnnotations);
    const merged = new Map(localMap);
    for (const [id, copy] of syncMap) {
        merged.set(id, QHP.shared.mergeAnnotationCopies(merged.get(id), copy));
    }

    const byPage = new Map();
    for (const annotation of merged.values()) {
        if (!annotation || !annotation.id || !annotation.pageUrl) continue;
        if (!byPage.has(annotation.pageUrl)) byPage.set(annotation.pageUrl, []);
        byPage.get(annotation.pageUrl).push({
            type: 'upsert',
            pageUrl: annotation.pageUrl,
            annotation,
            ts: QHP.shared.effectiveContentTs(annotation),
        });
    }

    let failedPages = 0;
    for (const [pageUrl, ops] of byPage) {
        try {
            await flushPage(pageUrl, ops);
        } catch (error) {
            const code = error && error.code;
            if (code === 'rate' || code === 'auth' || code === 'network') throw error;
            failedPages++;
            console.warn(`QHP Drive: absorción de ${pageUrl} falló:`, (error && error.message) || error);
        }
    }
    if (failedPages > 0) {
        return { pages: byPage.size, annotations: merged.size, complete: false };
    }

    // Limpieza solo con éxito total; los settings no se tocan.
    if (syncKeys.length > 0) await chrome.storage.sync.remove(syncKeys);
    if (localKeys.length > 0) await chrome.storage.local.remove(localKeys);
    return { pages: byPage.size, annotations: merged.size, complete: true };
}

/**
 * Ejecuta la absorción gestionando el flag de reintento: si queda
 * incompleta (red, rate, páginas sueltas), `qhp-drive-absorb-pending`
 * asegura que el alarm de flush la retome hasta converger.
 */
async function runAbsorption() {
    try {
        const result = await absorbIntoDrive();
        if (result.complete) {
            await chrome.storage.local.remove(DRIVE.ABSORB_PENDING_KEY);
        } else {
            await chrome.storage.local.set({ [DRIVE.ABSORB_PENDING_KEY]: true });
            await ensureFlushAlarm();
        }
        return result;
    } catch (error) {
        await chrome.storage.local.set({ [DRIVE.ABSORB_PENDING_KEY]: true });
        const code = error && error.code;
        if (code === 'rate') await noteRateLimit();
        else if (code !== 'auth') await ensureFlushAlarm(); // auth: markNeedsReauth ya paró el alarm
        console.warn('QHP Drive: absorción interrumpida:', (error && error.message) || error);
        return { pages: 0, annotations: 0, complete: false };
    }
}

// ---------------------------------------------------------------------
// Handlers de mensajes drive:* (§3)
// ---------------------------------------------------------------------

async function handleDriveMessage(request) {
    switch (request.action) {
        case 'drive:status': return handleStatus();
        case 'drive:signIn': return handleSignIn();
        case 'drive:signOut': return handleSignOut(request);
        case 'drive:loadPage': return handleLoadPage(String(request.pageUrl || ''));
        case 'drive:loadAll': return handleLoadAll();
        case 'drive:saveAnnotation': return handleSaveAnnotation(request);
        case 'drive:removeAnnotation': return handleRemoveAnnotation(request);
        case 'drive:stats': return handleStats();
        default: throw new Error(`acción desconocida: ${request.action}`);
    }
}

async function handleStatus() {
    const session = await getDriveSession();
    const queue = await readQueue();
    return {
        ok: true,
        signedIn: !!session.signedIn,
        account: session.account || null,
        needsReauth: !!session.needsReauth,
        lastSyncAt: (await getLocal(DRIVE.LAST_SYNC_KEY)) || null,
        queueLength: queue.length,
    };
}

async function handleSignIn() {
    await getToken(true); // consent interactivo; rechaza si el usuario cancela

    // La cuenta es informativa: si about.get no responde con el scope
    // drive.appdata, la UI muestra solo «Conectado» (§7).
    let account = null;
    try {
        const response = await driveFetch(`${DRIVE.API}/about?fields=user(emailAddress)`);
        const body = await response.json();
        account = (body.user && body.user.emailAddress) || null;
    } catch (e) {
        console.log('QHP Drive: about.get no disponible con drive.appdata:', (e && e.message) || e);
    }

    // Absorción sync+local → Drive (§6) ANTES de encender el flag: mientras
    // dura, los content scripts siguen leyendo de sync (datos completos);
    // al encenderlo recargan ya contra un Drive que lo contiene todo.
    const absorption = await runAbsorption();

    const previous = await getDriveSession();
    await setDriveSession({
        signedIn: true,
        account,
        since: previous.signedIn ? previous.since : Date.now(),
        needsReauth: false,
    });

    const queue = await readQueue();
    if (queue.length > 0) {
        await ensureFlushAlarm();
        flushQueue();
    }
    return {
        ok: true,
        account,
        absorbed: absorption.annotations,
        absorptionComplete: absorption.complete,
    };
}

/**
 * Enumera los cuerpos de página: desde Drive si hay red; si la lectura
 * falla, desde la caché local (`fromCache: true` — la UI avisa de que la
 * copia puede no incluir cambios recientes de otros dispositivos).
 */
async function collectDrivePageBodies() {
    try {
        const bodies = new Map();
        const fields = encodeURIComponent('nextPageToken,files(id,name)');
        const q = encodeURIComponent("name contains 'page-'");
        let pageToken = null;
        do {
            const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
            const response = await driveFetch(
                `${DRIVE.API}/files?spaces=appDataFolder&q=${q}&pageSize=1000&fields=${fields}${tokenParam}`
            );
            const list = await response.json();
            for (const file of (list && list.files) || []) {
                const body = await downloadPageBody(file.id);
                if (body && body.pageUrl && body.annotations) bodies.set(body.pageUrl, body);
            }
            pageToken = (list && list.nextPageToken) || null;
        } while (pageToken);
        return { bodies, fromCache: false };
    } catch (error) {
        console.warn('QHP Drive: sin acceso a Drive para la copia; se usa la caché local:', (error && error.message) || error);
        const all = await chrome.storage.local.get(null);
        const bodies = new Map();
        for (const key of Object.keys(all)) {
            if (!key.startsWith(DRIVE.CACHE_PREFIX)) continue;
            const body = all[key];
            if (body && body.pageUrl && body.annotations) bodies.set(body.pageUrl, body);
        }
        return { bodies, fromCache: true };
    }
}

function getLocalBytesInUse(keys) {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.getBytesInUse(keys, (bytes) => resolve(bytes || 0));
        } catch (e) {
            resolve(0);
        }
    });
}

async function handleSignOut(request) {
    const session = await getDriveSession();
    if (!session.signedIn) {
        await setDriveSession({ signedIn: false });
        return { ok: true, copied: { pages: 0, annotations: 0 }, fromCache: false };
    }

    // 1. Vaciar la cola. Si quedan pendientes (sin red) y no viene force,
    //    se aborta: la UI avisa y re-llama con force si el usuario confirma.
    await flushQueue();
    let pending = await readQueue();
    if (pending.length > 0 && !request.force) {
        return { ok: false, error: 'pending-ops', pendingOps: pending.length };
    }

    // 2. Copia local (§6-bis): cuerpos desde Drive o desde la caché, con
    //    las ops aún encoladas aplicadas encima (un cambio local sin subir
    //    no debe faltar en la copia; re-conectar lo absorberá hacia Drive).
    const { bodies, fromCache } = await collectDrivePageBodies();
    pending = await readQueue();
    if (pending.length > 0) {
        const byPage = new Map();
        for (const op of pending) {
            if (!byPage.has(op.pageUrl)) byPage.set(op.pageUrl, []);
            byPage.get(op.pageUrl).push(op);
        }
        for (const [pageUrl, ops] of byPage) {
            const base = bodies.get(pageUrl) || QHP.shared.emptyPageBody(pageUrl);
            bodies.set(pageUrl, QHP.shared.applyOpsToPageBody(base, ops));
        }
    }

    // Anotaciones vivas (tombstones ya aplicados) → items sueltos
    // `highlighter-annotation-<id>`, sin chunking (local no tiene cuota por
    // item). Si sobrevive una copia local del mismo id de un cierre de
    // sesión anterior, se fusiona con LWW en vez de pisarla a ciegas.
    const existingLocal = await chrome.storage.local.get(null);
    const itemsToWrite = {};
    let annotationCount = 0;
    let pageCount = 0;
    for (const body of bodies.values()) {
        const live = QHP.shared.liveAnnotations(body);
        const ids = Object.keys(live);
        if (ids.length > 0) pageCount++;
        for (const id of ids) {
            const key = `${QHP.shared.ANNOTATION_KEY_PREFIX}${id}`;
            itemsToWrite[key] = QHP.shared.mergeAnnotationCopies(existingLocal[key], live[id]);
            annotationCount++;
        }
    }

    // 3. Estimación contra la cuota de local (~10 MB). Las claves de
    //    infraestructura Drive se borran justo después, así que su tamaño
    //    cuenta como espacio disponible.
    const QUOTA = chrome.storage.local.QUOTA_BYTES || 10485760;
    const SAFETY_MARGIN = 102400; // 100 KB
    const usedBytes = await getLocalBytesInUse(null);
    const reclaimableKeys = Object.keys(existingLocal).filter(key =>
        key.startsWith(DRIVE.CACHE_PREFIX) || key === DRIVE.QUEUE_KEY);
    const reclaimableBytes = reclaimableKeys.length > 0 ? await getLocalBytesInUse(reclaimableKeys) : 0;
    let copyBytes = 0;
    for (const key of Object.keys(itemsToWrite)) {
        copyBytes += key.length + JSON.stringify(itemsToWrite[key]).length;
    }
    if (usedBytes - reclaimableBytes + copyBytes > QUOTA - SAFETY_MARGIN) {
        // No se cierra la sesión: los datos siguen íntegros en Drive.
        return { ok: false, error: 'local-quota', required: copyBytes, available: Math.max(QUOTA - usedBytes + reclaimableBytes, 0) };
    }

    // 4. Escribir la copia por lotes acotados.
    const BATCH_LIMIT_BYTES = 512 * 1024;
    let batch = {};
    let batchBytes = 0;
    for (const key of Object.keys(itemsToWrite)) {
        batch[key] = itemsToWrite[key];
        batchBytes += key.length + JSON.stringify(itemsToWrite[key]).length;
        if (batchBytes >= BATCH_LIMIT_BYTES) {
            await chrome.storage.local.set(batch);
            batch = {};
            batchBytes = 0;
        }
    }
    if (Object.keys(batch).length > 0) await chrome.storage.local.set(batch);

    // 5. Limpieza de la infraestructura Drive, token y flag off (el
    //    Switching backend vuelve a sync en vivo; load() fusiona local+sync
    //    y la copia se muestra sin código nuevo de lectura).
    const cacheKeys = Object.keys(existingLocal).filter(key => key.startsWith(DRIVE.CACHE_PREFIX));
    await chrome.storage.local.remove([
        ...cacheKeys, DRIVE.QUEUE_KEY, DRIVE.LAST_SYNC_KEY, DRIVE.BACKOFF_KEY, DRIVE.ABSORB_PENDING_KEY,
    ]);
    await chrome.alarms.clear(DRIVE.FLUSH_ALARM);

    try {
        await removeCachedToken(await getToken(false));
    } catch (e) {
        // sin token que limpiar (p. ej. ya revocado): no es un error
    }

    await setDriveSession({ signedIn: false });
    return { ok: true, copied: { pages: pageCount, annotations: annotationCount }, fromCache };
}

async function handleLoadPage(pageUrl) {
    if (!pageUrl) throw new Error('pageUrl requerido');
    const hash = await sha256Hex(pageUrl);
    const session = await getDriveSession();

    let body = null;
    let fromRemote = false;
    if (session.signedIn) {
        try {
            body = await withTimeout(fetchRemotePageBody(pageUrl, hash), DRIVE.LOAD_TIMEOUT_MS);
            fromRemote = true;
        } catch (e) {
            // Sin red / rate / auth: se sirve caché + cola; no es error de UI (§5).
        }
    }
    if (fromRemote) {
        await setCachedPageBody(hash, body);
    } else {
        body = (await getCachedPageBody(hash)) || QHP.shared.emptyPageBody(pageUrl);
    }

    const pendingOps = (await readQueue()).filter(op => op.pageUrl === pageUrl);
    const effective = pendingOps.length > 0 ? QHP.shared.applyOpsToPageBody(body, pendingOps) : body;

    // Acabamos de comprobar que hay red: buena ocasión para vaciar la cola.
    if (fromRemote && (await readQueue()).length > 0) flushQueue();

    return { ok: true, annotations: QHP.shared.liveAnnotations(effective) };
}


/**
 * Todas las páginas con anotaciones vivas, para el panel global. Lee Drive
 * (o la caché local si no hay acceso, `fromCache: true`), refresca la caché
 * y aplica la cola pendiente igual que `handleLoadPage`.
 */
async function handleLoadAll() {
    const session = await getDriveSession();
    if (!session.signedIn) throw new Error('Google Drive no conectado');

    const { bodies, fromCache } = await collectDrivePageBodies();
    const queue = await readQueue();
    const opsByPage = new Map();
    for (const op of queue) {
        if (!op || !op.pageUrl) continue;
        if (!opsByPage.has(op.pageUrl)) opsByPage.set(op.pageUrl, []);
        opsByPage.get(op.pageUrl).push(op);
    }

    const pages = [];
    for (const [pageUrl, body] of bodies) {
        if (!fromCache) {
            try { await setCachedPageBody(await sha256Hex(pageUrl), body); } catch (e) { /* caché opcional */ }
        }
        const ops = opsByPage.get(pageUrl) || [];
        const effective = ops.length > 0 ? QHP.shared.applyOpsToPageBody(body, ops) : body;
        pages.push({ pageUrl, annotations: QHP.shared.liveAnnotations(effective) });
    }
    // Páginas creadas offline que aún no existen en Drive: solo viven en la cola.
    for (const [pageUrl, ops] of opsByPage) {
        if (bodies.has(pageUrl)) continue;
        const effective = QHP.shared.applyOpsToPageBody(QHP.shared.emptyPageBody(pageUrl), ops);
        pages.push({ pageUrl, annotations: QHP.shared.liveAnnotations(effective) });
    }
    return { ok: true, pages, fromCache };
}
/**
 * files.list vacío es autoritativo: la página no existe en Drive (p. ej.
 * appDataFolder vaciado externamente) y se devuelve un cuerpo vacío, que
 * también pisará la caché. Los fallos de red, en cambio, se lanzan.
 */
async function fetchRemotePageBody(pageUrl, hash) {
    const file = await findPageFile(pageFileName(hash));
    if (!file) return QHP.shared.emptyPageBody(pageUrl);
    const body = await downloadPageBody(file.id);
    if (!body || typeof body !== 'object' || !body.annotations) return QHP.shared.emptyPageBody(pageUrl);
    return body;
}

async function handleSaveAnnotation(request) {
    if (!request.pageUrl || !request.annotation || !request.annotation.id) {
        throw new Error('payload inválido para drive:saveAnnotation');
    }
    await enqueueOp({ type: 'upsert', pageUrl: request.pageUrl, annotation: request.annotation, ts: Date.now() });
    return { ok: true };
}

async function handleRemoveAnnotation(request) {
    if (!request.pageUrl || !request.annotationId) {
        throw new Error('payload inválido para drive:removeAnnotation');
    }
    await enqueueOp({ type: 'delete', pageUrl: request.pageUrl, annotationId: request.annotationId, ts: Date.now() });
    return { ok: true };
}

async function handleStats() {
    const fields = encodeURIComponent('nextPageToken,files(id,size,appProperties)');
    const q = encodeURIComponent("name contains 'page-'");
    let pageToken = null;
    let usedBytes = 0;
    let pageCount = 0;
    let itemCount = 0;
    do {
        const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const response = await driveFetch(
            `${DRIVE.API}/files?spaces=appDataFolder&q=${q}&pageSize=1000&fields=${fields}${tokenParam}`
        );
        const body = await response.json();
        for (const file of (body && body.files) || []) {
            pageCount += 1;
            usedBytes += Number(file.size || 0);
            itemCount += Number((file.appProperties && file.appProperties.qhpAnnotations) || 0);
        }
        pageToken = (body && body.nextPageToken) || null;
    } while (pageToken);

    // Sin cuota relevante en appDataFolder: total/percentUsed no aplican.
    return { backend: 'drive', used: usedBytes, total: null, percentUsed: null, itemCount, pageCount };
}

// ---------------------------------------------------------------------
// Reanudación: al despertar el SW (arranque de Chrome o primer mensaje),
// si quedó cola pendiente de una sesión anterior, retomar el flush.
// ---------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DRIVE.FLUSH_ALARM) flushQueue();
});

(async () => {
    try {
        const session = await getDriveSession();
        if (!session.signedIn || session.needsReauth) return;
        const queue = await readQueue();
        const absorbPending = await getLocal(DRIVE.ABSORB_PENDING_KEY);
        if (queue.length > 0 || absorbPending) {
            await ensureFlushAlarm();
            flushQueue();
        }
    } catch (e) {
        console.warn('QHP Drive: comprobación de cola al despertar falló:', e);
    }
})();
