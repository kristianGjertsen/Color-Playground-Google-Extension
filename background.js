const STYLE_ENGINE_ID = "color-playground-engine";
const STYLE_VARS_ID = "color-playground-vars";
const LEGACY_STYLE_ID = "color-playground-style";
const DEFAULT_PALETTE = {
    bgPrimary: "#0f172a",
    bgSecondary: "#020617",
    surfaceRaised: "#020617",
    textPrimary: "#e5e7eb",
    textSecondary: "#94a3b8",
    textHeading: "#f8fafc",
    accentPrimary: "#38bdf8",
    accentSecondary: "#22d3ee",
    border: "#334155",
    icon: "#e5e7eb"
};
const DEFAULT_SETTINGS = {
    newSiteDefault: "enabled",
    defaultPalette: DEFAULT_PALETTE
};

const ENGINE_CSS = `
body {
  background-color: var(--bg-primary) !important;
}

div, section, article, main, aside {
  background-color: var(--bg-secondary) !important;
}

header,
nav,
[role="banner"],
header *,
nav * {
  background-color: var(--surface-raised) !important;
}

p, li, span {
  color: var(--text-primary) !important;
}

small, time, footer {
  color: var(--text-secondary) !important;
}

h1, h2, h3, h4, h5 {
  color: var(--text-heading) !important;
}

a, button {
  color: var(--accent-primary) !important;
}

* {
  border-color: var(--border-color) !important;
}

input,
textarea,
select {
  background-color: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-color) !important;
}

input::placeholder,
textarea::placeholder {
  color: var(--text-secondary) !important;
  opacity: 1;
}

input:focus,
textarea:focus,
select:focus {
  outline: 2px solid var(--accent-primary) !important;
  outline-offset: 2px;
}

svg, svg * {
  fill: var(--icon-color) !important;
  stroke: var(--icon-color) !important;
}

/* === ChatGPT own style under === */
[data-message-author-role="assistant"],
[data-message-author-role="user"] {
  background-color: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border-radius: 12px;
}

/* prose / markdown overrides */
.markdown,
.prose,
.prose p,
.prose * {
  color: var(--text-primary) !important;
}

/* remove internal bg layers */
[data-message-author-role] * {
  background-color: transparent !important;
}

/* === ChatGPT prose token override === */
.prose {
  --tw-prose-body: var(--text-primary) !important;
  --tw-prose-headings: var(--text-heading) !important;
  --tw-prose-bold: var(--text-primary) !important;
  --tw-prose-links: var(--accent-primary) !important;
  --tw-prose-code: var(--text-primary) !important;
  --tw-prose-quotes: var(--text-secondary) !important;
}
`;

const isRestrictedUrl = (url) =>
    url.startsWith("chrome://") || url.startsWith("chrome-extension://");

const getHostnameFromUrl = (url) => {
    try {
        return new URL(url).hostname;
    } catch (error) {
        return "*";
    }
};

const normalizePalette = (palette) => ({
    ...DEFAULT_PALETTE,
    ...(palette || {})
});

const paletteToVarsCss = (palette) => `
:root {
  --bg-primary: ${palette.bgPrimary};
  --bg-secondary: ${palette.bgSecondary};
  --surface-raised: ${palette.surfaceRaised};

  --text-primary: ${palette.textPrimary};
  --text-secondary: ${palette.textSecondary};
  --text-heading: ${palette.textHeading};

  --accent-primary: ${palette.accentPrimary};
  --accent-secondary: ${palette.accentSecondary};

  --border-color: ${palette.border};
  --icon-color: ${palette.icon};
}
`;

const applyPaletteToTab = (tabId, palette) => {
    const varsCss = paletteToVarsCss(palette);
    chrome.scripting.executeScript({
        target: { tabId },
        func: (engineId, varsId, legacyId, engineCss, varsCssText) => {
            const legacy = document.getElementById(legacyId);
            if (legacy) legacy.remove();

            let engine = document.getElementById(engineId);
            if (!engine) {
                engine = document.createElement("style");
                engine.id = engineId;
                const root = document.head || document.documentElement;
                root.appendChild(engine);
            }
            engine.textContent = engineCss;

            let vars = document.getElementById(varsId);
            if (!vars) {
                vars = document.createElement("style");
                vars.id = varsId;
                const root = document.head || document.documentElement;
                root.appendChild(vars);
            }
            vars.textContent = varsCssText;
        },
        args: [STYLE_ENGINE_ID, STYLE_VARS_ID, LEGACY_STYLE_ID, ENGINE_CSS, varsCss]
    });
};

const removePaletteFromTab = (tabId) => {
    chrome.scripting.executeScript({
        target: { tabId },
        func: (engineId, varsId, legacyId) => {
            [engineId, varsId, legacyId].forEach(id => {
                const node = document.getElementById(id);
                if (node) node.remove();
            });
        },
        args: [STYLE_ENGINE_ID, STYLE_VARS_ID, LEGACY_STYLE_ID]
    });
};

const analyzePageColors = (tabId) =>
    chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            console.log("Extracting colors in page");

            const elements = [
                document.body,
                ...document.querySelectorAll("main, section, header, footer, nav"),
                ...document.querySelectorAll(
                    "p, h1, h2, h3, h4, h5, a, button, small, time"
                )
            ];

            const PROPS = ["color", "backgroundColor"];
            const colors = new Map();

            elements.forEach(el => {
                const style = getComputedStyle(el);
                const area = el.offsetWidth * el.offsetHeight;

                PROPS.forEach(prop => {
                    const value = style[prop];
                    if (
                        !value ||
                        value === "transparent" ||
                        value.includes("rgba(0, 0, 0, 0)")
                    ) {
                        return;
                    }

                    if (!colors.has(value)) {
                        colors.set(value, {
                            count: 0,
                            usages: []
                        });
                    }

                    const entry = colors.get(value);
                    entry.count++;

                    entry.usages.push({
                        prop,
                        tag: el.tagName,
                        fontSize: parseFloat(style.fontSize) || null,
                        area,
                        isLink: el.tagName === "A",
                        isButton: el.tagName === "BUTTON"
                    });
                });
            });

            const luminance = (rgb) => {
                const [r, g, b] = rgb.match(/\d+/g).map(Number);
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };

            const sorted = [...colors.entries()]
                .sort((a, b) => b[1].count - a[1].count);

            const roles = {
                bgPrimary: null,
                bgSecondary: null,
                surfaceRaised: null,
                textPrimary: null,
                textSecondary: null,
                textHeading: null,
                accentPrimary: null,
                accentSecondary: null,
                border: null,
                icon: null
            };

            for (const [color, data] of sorted) {
                const lum = luminance(color);

                if (!roles.bgPrimary && lum > 210) {
                    roles.bgPrimary = color;
                    continue;
                }

                if (
                    !roles.bgSecondary &&
                    lum > 170 &&
                    data.usages.some(
                        u => u.prop === "backgroundColor" && u.area > 20000
                    )
                ) {
                    roles.bgSecondary = color;
                    continue;
                }

                if (
                    !roles.surfaceRaised &&
                    data.usages.some(u => u.tag === "HEADER" || u.tag === "NAV")
                ) {
                    roles.surfaceRaised = color;
                    continue;
                }

                if (!roles.textPrimary && lum < 90) {
                    roles.textPrimary = color;
                    continue;
                }

                if (
                    !roles.textHeading &&
                    data.usages.some(u => u.tag.startsWith("H"))
                ) {
                    roles.textHeading = color;
                    continue;
                }

                if (!roles.textSecondary && lum >= 90 && lum < 150) {
                    roles.textSecondary = color;
                    continue;
                }

                if (
                    !roles.accentPrimary &&
                    data.usages.some(u => u.isLink || u.isButton)
                ) {
                    roles.accentPrimary = color;
                    continue;
                }

                if (!roles.accentSecondary && lum >= 120 && lum < 200) {
                    roles.accentSecondary = color;
                    continue;
                }

                if (!roles.border && lum >= 120 && lum < 200) {
                    roles.border = color;
                    continue;
                }

                if (!roles.icon) {
                    roles.icon = color;
                }
            }

            console.log("Detected color roles:", roles);
            return roles;
        }
    }).then(([res]) => {
        console.log("Page roles returned:", res.result);
    });

console.log("Service worker started");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    if (!tab.url || isRestrictedUrl(tab.url)) return;

    chrome.storage.local.get(
        { enabled: true, sites: {}, disabledSites: {}, settings: DEFAULT_SETTINGS },
        ({ enabled, sites, disabledSites, settings }) => {
            if (!enabled) return;

            const hostname = getHostnameFromUrl(tab.url);
            if (disabledSites && disabledSites[hostname]) {
                removePaletteFromTab(tabId);
                return;
            }
            const siteMap = sites || {};
            const storedPalette = siteMap[hostname];
            const resolvedSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
            if (!storedPalette && resolvedSettings.newSiteDefault === "disabled") {
                removePaletteFromTab(tabId);
                return;
            }
            const fallbackPalette =
                resolvedSettings.defaultPalette || siteMap["*"] || DEFAULT_PALETTE;
            const palette = normalizePalette(storedPalette || fallbackPalette);

            if (!storedPalette) {
                analyzePageColors(tabId);
            }

            applyPaletteToTab(tabId, palette);
        }
    );
});
