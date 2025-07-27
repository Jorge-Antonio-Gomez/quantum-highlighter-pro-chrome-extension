document.addEventListener('DOMContentLoaded', () => {
    // --- INTERNATIONALIZATION ---
    function localizeHtmlPage() {
        // Localize elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                // Special handling for elements that contain other elements (e.g., a span for the text)
                // and shouldn't have their innerHTML overwritten completely.
                const target = el.querySelector('span') || el;
                if (target && !el.querySelector('strong')) { // Avoid overwriting elements with complex content like the tip
                     target.textContent = message;
                } else {
                     el.innerHTML = message;
                }
            }
        });
        // Localize the page title
        document.title = chrome.i18n.getMessage('pageTitle');
    }


    // --- ELEMENTS ---
    const colorIcon = document.getElementById('color-cycle-icon');

    // --- FUNCTIONS ---
    function initialize() {
        // Color cycle animation for the feature icon
        if (colorIcon) {
            const colors = ['#ffd400', '#ff6666', '#5fb236', '#2ea8e5', '#a28ae5', '#e56eee', '#f19837', '#aaaaaa'];
            let currentIndex = 0;
            colorIcon.style.backgroundColor = colors[currentIndex];
            setInterval(() => {
                currentIndex = (currentIndex + 1) % colors.length;
                colorIcon.style.backgroundColor = colors[currentIndex];
            }, 9000 / colors.length);
        }
    }

    localizeHtmlPage();
    initialize();
});
