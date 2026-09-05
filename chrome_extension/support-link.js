/*
 * Quantum Highlighter PRO — Enlace de apoyo ("Invítame un café")
 *
 * Único lugar donde vive el Payment Link de Stripe. Lo usan la página de
 * bienvenida (`welcome.js`) y el modal del content script (`script.js`).
 *
 * El botón embebido de Stripe (`<stripe-buy-button>` + js.stripe.com) no es
 * viable en una extensión MV3: la CSP de las páginas de extensión sólo admite
 * scripts propios y el content script no puede inyectar código remoto en las
 * webs. El Payment Link abre exactamente el mismo checkout como enlace normal
 * y, con el parámetro `locale`, Stripe lo muestra en el idioma de la extensión.
 *
 * Expone `globalThis.QHP.buildSupportLink()` y `globalThis.QHP.SUPPORT_PAYMENT_LINK`.
 */
(function () {
    'use strict';

    // Producto "café" de 5 USD por unidad (la cantidad se ajusta en el checkout).
    const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/3cI6oI8ZpcHbgwTfYf2go01';

    // Idiomas que acepta Stripe Checkout en el parámetro `locale`:
    // https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-locale
    const STRIPE_LOCALES = new Set([
        'bg', 'cs', 'da', 'de', 'el', 'en', 'en-GB', 'es', 'es-419', 'et', 'fi',
        'fil', 'fr', 'fr-CA', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv',
        'ms', 'mt', 'nb', 'nl', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sk', 'sl',
        'sv', 'th', 'tr', 'vi', 'zh', 'zh-HK', 'zh-TW'
    ]);

    /**
     * Traduce el idioma de la UI de Chrome (p. ej. "es-419", "pt-BR", "zh-CN",
     * "en-US") al código que entiende Stripe. Devuelve null si no hay
     * equivalente; en ese caso Stripe detecta el idioma por su cuenta.
     */
    function resolveStripeLocale(uiLanguage) {
        const tag = String(uiLanguage || '').trim().replace('_', '-');
        if (!tag) return null;
        if (STRIPE_LOCALES.has(tag)) return tag;

        const [language, region] = tag.split('-');
        if (language === 'zh') {
            // Chrome distingue zh-CN / zh-TW / zh-HK; Stripe usa "zh" para el simplificado.
            const regional = region ? `zh-${region.toUpperCase()}` : null;
            return regional && STRIPE_LOCALES.has(regional) ? regional : 'zh';
        }
        if (language === 'no') return 'nb';
        return STRIPE_LOCALES.has(language) ? language : null;
    }

    function buildSupportLink() {
        let uiLanguage = null;
        try {
            uiLanguage = chrome.i18n.getUILanguage();
        } catch (_) {
            // Fuera de un contexto de extensión (p. ej. la página mock) no existe chrome.i18n.
        }
        const locale = resolveStripeLocale(uiLanguage);
        return locale
            ? `${STRIPE_PAYMENT_LINK}?locale=${encodeURIComponent(locale)}`
            : STRIPE_PAYMENT_LINK;
    }

    globalThis.QHP = globalThis.QHP || {};
    globalThis.QHP.SUPPORT_PAYMENT_LINK = STRIPE_PAYMENT_LINK;
    globalThis.QHP.buildSupportLink = buildSupportLink;
})();
