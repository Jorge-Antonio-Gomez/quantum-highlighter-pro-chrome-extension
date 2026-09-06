/*
 * Quantum Highlighter PRO — Divulgación de prácticas de datos
 *
 * Fuente única de la versión de prácticas de datos y de los textos (claves
 * i18n) que la extensión muestra de forma destacada: en la página de
 * bienvenida, en el aviso en página al crear la primera anotación, en el
 * sidebar y en el panel global. Cubre las políticas de la Chrome Web Store
 * vigentes desde el 1 de agosto de 2026: divulgación destacada con
 * consentimiento afirmativo y aviso de cambios tras la instalación.
 *
 * El usuario acepta una vez por VERSIÓN DE PRÁCTICAS, no por versión de la
 * extensión: `PRACTICES_VERSION` solo cambia cuando cambia QUÉ se guarda o
 * DÓNDE. La aceptación vive en chrome.storage.sync (`qhp-disclosure-ack`);
 * el service worker marca en chrome.storage.local (`qhp-disclosure-mode`)
 * que la instalación es una actualización, para mostrar "qué cambió" a
 * quien ya usaba la extensión.
 *
 * Se carga en el content script, el service worker (importScripts), el
 * sidebar, el panel y la página de bienvenida. Expone `globalThis.QHP.disclosure`.
 */
(function () {
    'use strict';

    const PRACTICES_VERSION = '2026.0905.2';
    const ACK_KEY = 'qhp-disclosure-ack';
    const MODE_KEY = 'qhp-disclosure-mode';
    const PRIVACY_POLICY_URL = 'https://github.com/Jorge-Antonio-Gomez/quantum-highlighter-pro-chrome-extension/blob/main/PRIVACY_POLICY.md';

    // Qué guarda la extensión y dónde, en orden de lectura (claves i18n).
    const PRACTICE_KEYS = [
        'disclosureItemStores',
        'disclosureItemWhere',
        'disclosureItemNever',
        'disclosureItemControl',
    ];

    // Cambios de prácticas por versión, para quien ya había aceptado una anterior.
    const CHANGES = {
        '2026.0905.2': ['disclosureChangeTitle', 'disclosureChangeFavicon', 'disclosureChangeStripe'],
    };

    function message(key, substitutions) {
        try {
            return chrome.i18n.getMessage(key, substitutions) || key;
        } catch (e) {
            return key;
        }
    }

    function touchLastError() {
        // Leerlo evita el aviso "Unchecked runtime.lastError" en consola.
        return chrome.runtime && chrome.runtime.lastError;
    }

    /**
     * Estado del aviso: `needed` si la versión aceptada no es la actual;
     * `mode` 'update' cuando el usuario ya aceptó otra versión (o el SW marcó
     * la instalación como actualización) y 'new' en la primera vez.
     */
    function getState(callback) {
        const finish = (ack, mode) => callback({ needed: ack !== PRACTICES_VERSION, mode, ackVersion: ack });
        try {
            chrome.storage.sync.get(ACK_KEY, (syncItems) => {
                touchLastError();
                const ack = (syncItems && syncItems[ACK_KEY]) || null;
                if (ack) {
                    finish(ack, 'update');
                    return;
                }
                try {
                    chrome.storage.local.get(MODE_KEY, (localItems) => {
                        touchLastError();
                        const flagged = !!(localItems && localItems[MODE_KEY] === 'update');
                        finish(null, flagged ? 'update' : 'new');
                    });
                } catch (e) {
                    finish(null, 'new');
                }
            });
        } catch (e) {
            callback({ needed: false, mode: 'new', ackVersion: null });
        }
    }

    /** Consentimiento afirmativo: registra la versión de prácticas aceptada. */
    function acknowledge(callback) {
        const done = () => { if (typeof callback === 'function') callback(); };
        try {
            chrome.storage.sync.set({ [ACK_KEY]: PRACTICES_VERSION }, () => {
                touchLastError();
                try {
                    chrome.storage.local.remove(MODE_KEY, () => { touchLastError(); done(); });
                } catch (e) {
                    done();
                }
            });
        } catch (e) {
            done();
        }
    }

    /**
     * Llamado por el service worker en `onInstalled` con reason "update":
     * si el usuario no ha aceptado la versión actual, deja constancia de que
     * se trata de una actualización (para mostrar "qué cambió").
     */
    function markUpdate(callback) {
        const done = () => { if (typeof callback === 'function') callback(); };
        try {
            chrome.storage.sync.get(ACK_KEY, (items) => {
                touchLastError();
                const ack = (items && items[ACK_KEY]) || null;
                if (ack === PRACTICES_VERSION) { done(); return; }
                chrome.storage.local.set({ [MODE_KEY]: 'update' }, () => { touchLastError(); done(); });
            });
        } catch (e) {
            done();
        }
    }

    /** Textos resueltos para renderizar el aviso en cualquier superficie. */
    function content(mode) {
        const isUpdate = mode === 'update';
        return {
            title: message(isUpdate ? 'disclosureTitleUpdate' : 'disclosureTitleNew'),
            intro: isUpdate ? message('disclosureIntroUpdate', [PRACTICES_VERSION]) : message('disclosureIntroNew'),
            changesHeading: message('disclosureChangesHeading'),
            changes: isUpdate ? (CHANGES[PRACTICES_VERSION] || []).map((key) => message(key)) : [],
            practicesHeading: message('disclosurePracticesHeading'),
            items: PRACTICE_KEYS.map((key) => message(key)),
            link: message('disclosureLink'),
            accept: message('disclosureAccept'),
            url: PRIVACY_POLICY_URL,
        };
    }

    globalThis.QHP = globalThis.QHP || {};
    globalThis.QHP.disclosure = {
        PRACTICES_VERSION,
        ACK_KEY,
        MODE_KEY,
        PRIVACY_POLICY_URL,
        getState,
        acknowledge,
        markUpdate,
        content,
    };
})();
