const themes = {
    dark: {
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
    },
    light: {
        bgPrimary: "#ffffff",
        bgSecondary: "#f1f5f9",
        surfaceRaised: "#e2e8f0",
        textPrimary: "#0f172a",
        textSecondary: "#475569",
        textHeading: "#020617",
        accentPrimary: "#2563eb",
        accentSecondary: "#38bdf8",
        border: "#cbd5f5",
        icon: "#0f172a"
    },
    neon: {
        bgPrimary: "#000000",
        bgSecondary: "#020617",
        surfaceRaised: "#020617",
        textPrimary: "#00ffcc",
        textSecondary: "#66ffe3",
        textHeading: "#ffffff",
        accentPrimary: "#ff00ff",
        accentSecondary: "#00ffff",
        border: "#ff00ff",
        icon: "#00ffcc"
    },
    pink: {
        bgPrimary: "#2b0f1f",
        bgSecondary: "#3b1230",
        surfaceRaised: "#4a163a",
        textPrimary: "#ffe4f1",
        textSecondary: "#f3a8d6",
        textHeading: "#fff0f8",
        accentPrimary: "#ff5fa2",
        accentSecondary: "#ff8bd1",
        border: "#7a2b5a",
        icon: "#ffe4f1"
    },
    purple: {
        bgPrimary: "#150b2e",
        bgSecondary: "#1f1142",
        surfaceRaised: "#2a1658",
        textPrimary: "#efe9ff",
        textSecondary: "#c7b7ff",
        textHeading: "#ffffff",
        accentPrimary: "#8b5cf6",
        accentSecondary: "#a78bfa",
        border: "#3f2a6d",
        icon: "#efe9ff"
    },
    orange: {
        bgPrimary: "#2a1609",
        bgSecondary: "#3b1d0b",
        surfaceRaised: "#4a230d",
        textPrimary: "#fff3e6",
        textSecondary: "#f5c7a0",
        textHeading: "#ffffff",
        accentPrimary: "#f97316",
        accentSecondary: "#fb923c",
        border: "#7a3a16",
        icon: "#fff3e6"
    }
};

const STYLE_ENGINE_ID = "color-playground-engine";
const STYLE_VARS_ID = "color-playground-vars";
const LEGACY_STYLE_ID = "color-playground-style";
const DEFAULT_PALETTE = { ...themes.dark };
const STORAGE_DEFAULTS = {
    enabled: true,
    sites: {
        "*": DEFAULT_PALETTE
    },
    disabledSites: {},
    settings: {
        newSiteDefault: "enabled",
        defaultPaletteName: "dark",
        defaultPalette: DEFAULT_PALETTE
    }
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

const toggle = document.getElementById("enabledToggle");
const siteToggle = document.getElementById("siteToggle");
const newSiteSelect = document.getElementById("newSiteDefault");
const defaultPaletteSelect = document.getElementById("defaultPalette");
const rolesDetails = document.querySelector(".roles-details");
let activeTabId = null;
let activeHostname = "*";
let currentPalette = { ...DEFAULT_PALETTE };
let siteDisabled = false;
let settingsState = {
    newSiteDefault: "enabled",
    defaultPaletteName: "dark",
    defaultPalette: DEFAULT_PALETTE
};

const isRestrictedUrl = (url) =>
    url &&
    (url.startsWith("chrome://") || url.startsWith("chrome-extension://"));

const getHostnameFromUrl = (url) => {
    if (!url || isRestrictedUrl(url)) return "*";
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

const forEachEligibleTab = (callback) => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab || !tab.id || !tab.url || isRestrictedUrl(tab.url)) return;
            callback(tab);
        });
    });
};

const syncInputs = (palette) => {
    document.querySelectorAll("input[type=color]").forEach(input => {
        const role = input.dataset.role;
        if (palette[role]) {
            input.value = palette[role];
        }
    });
};

const updateSiteToggle = () => {
    if (!siteToggle) return;
    if (!activeHostname || activeHostname === "*") {
        siteToggle.disabled = true;
        siteToggle.textContent = "Disable on this site";
        siteToggle.setAttribute("aria-pressed", "false");
        return;
    }
    siteToggle.disabled = false;
    siteToggle.setAttribute("aria-pressed", siteDisabled ? "true" : "false");
    siteToggle.textContent = siteDisabled
        ? "Enable on this site"
        : "Disable on this site";
};

const loadState = () => {
    chrome.storage.local.get(
        STORAGE_DEFAULTS,
        ({ enabled, sites, disabledSites, settings }) => {
            if (toggle) {
                toggle.checked = enabled;
            }
            settingsState = { ...settingsState, ...(settings || {}) };
            if (newSiteSelect) {
                newSiteSelect.value = settingsState.newSiteDefault || "enabled";
            }
            if (defaultPaletteSelect) {
                defaultPaletteSelect.value =
                    settingsState.defaultPaletteName || "dark";
            }

            const siteMap = sites || {};
            const fallbackPalette =
                settingsState.defaultPalette || siteMap["*"] || DEFAULT_PALETTE;
            const palette = siteMap[activeHostname] || fallbackPalette;
            currentPalette = normalizePalette(palette);
            syncInputs(currentPalette);
            siteDisabled = Boolean(disabledSites && disabledSites[activeHostname]);
            updateSiteToggle();
        }
    );
};

const savePaletteForHost = (hostname, palette) => {
    chrome.storage.local.get(STORAGE_DEFAULTS, ({ sites }) => {
        const nextSites = { ...(sites || {}) };
        if (!nextSites["*"]) {
            nextSites["*"] = DEFAULT_PALETTE;
        }
        nextSites[hostname] = palette;
        chrome.storage.local.set({ sites: nextSites });
    });
};

const applyPaletteToActiveTab = (palette) => {
    if (!toggle || !toggle.checked) return;
    if (!activeHostname || activeHostname === "*") return;
    if (siteDisabled) return;
    if (!activeTabId) return;
    applyPaletteToTab(activeTabId, palette);
};

const applyStoredPalettesToAllTabs = () => {
    chrome.storage.local.get(
        STORAGE_DEFAULTS,
        ({ sites, disabledSites, settings }) => {
            const siteMap = sites || {};
            const disabledMap = disabledSites || {};
            const fallbackPalette =
                (settings && settings.defaultPalette) ||
                siteMap["*"] ||
                DEFAULT_PALETTE;
            forEachEligibleTab(tab => {
                const hostname = getHostnameFromUrl(tab.url);
                if (disabledMap[hostname]) {
                    removePaletteFromTab(tab.id);
                    return;
                }
                const storedPalette = siteMap[hostname];
                if (!storedPalette && settings && settings.newSiteDefault === "disabled") {
                    removePaletteFromTab(tab.id);
                    return;
                }
                const palette = storedPalette || fallbackPalette;
                applyPaletteToTab(tab.id, normalizePalette(palette));
            });
        }
    );
};

const applyPaletteToHostname = (hostname, palette) => {
    forEachEligibleTab(tab => {
        if (getHostnameFromUrl(tab.url) === hostname) {
            applyPaletteToTab(tab.id, palette);
        }
    });
};

const removePaletteFromHostname = (hostname) => {
    forEachEligibleTab(tab => {
        if (getHostnameFromUrl(tab.url) === hostname) {
            removePaletteFromTab(tab.id);
        }
    });
};

const removePaletteFromAllTabs = () => {
    forEachEligibleTab(tab => removePaletteFromTab(tab.id));
};

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id && tab.url && !isRestrictedUrl(tab.url)) {
        activeTabId = tab.id;
        activeHostname = getHostnameFromUrl(tab.url);
    } else if (tab && tab.id) {
        activeTabId = tab.id;
        activeHostname = "*";
    }
    loadState();
});

if (toggle) {
    toggle.addEventListener("change", () => {
        const enabled = toggle.checked;
        chrome.storage.local.set({ enabled });

        if (enabled) {
            applyStoredPalettesToAllTabs();
        } else {
            removePaletteFromAllTabs();
        }
    });
}

if (siteToggle) {
    siteToggle.addEventListener("click", () => {
        if (!activeHostname || activeHostname === "*") return;
        chrome.storage.local.get(
            STORAGE_DEFAULTS,
            ({ sites, disabledSites }) => {
                const disabledMap = { ...(disabledSites || {}) };
                if (disabledMap[activeHostname]) {
                    delete disabledMap[activeHostname];
                    siteDisabled = false;
                } else {
                    disabledMap[activeHostname] = true;
                    siteDisabled = true;
                }
                chrome.storage.local.set({ disabledSites: disabledMap });
                updateSiteToggle();

                if (siteDisabled || !toggle || !toggle.checked) {
                    removePaletteFromHostname(activeHostname);
                    return;
                }

                const siteMap = sites || {};
                const palette =
                    siteMap[activeHostname] || siteMap["*"] || DEFAULT_PALETTE;
                applyPaletteToHostname(activeHostname, normalizePalette(palette));
            }
        );
    });
}

if (newSiteSelect) {
    newSiteSelect.addEventListener("change", () => {
        const newSiteDefault = newSiteSelect.value;
        settingsState = {
            ...settingsState,
            newSiteDefault
        };
        chrome.storage.local.set({ settings: settingsState });

        chrome.storage.local.get(STORAGE_DEFAULTS, ({ sites }) => {
            const siteMap = sites || {};
            if (siteMap[activeHostname]) return;
            if (newSiteDefault === "disabled") {
                removePaletteFromHostname(activeHostname);
                return;
            }
            if (!toggle || !toggle.checked || siteDisabled) return;
            const palette =
                settingsState.defaultPalette || siteMap["*"] || DEFAULT_PALETTE;
            applyPaletteToHostname(activeHostname, normalizePalette(palette));
        });
    });
}

if (defaultPaletteSelect) {
    defaultPaletteSelect.addEventListener("change", () => {
        const paletteName = defaultPaletteSelect.value;
        const palette = normalizePalette(themes[paletteName] || DEFAULT_PALETTE);
        settingsState = {
            ...settingsState,
            defaultPaletteName: paletteName,
            defaultPalette: palette
        };
        chrome.storage.local.set({ settings: settingsState });

        chrome.storage.local.get(STORAGE_DEFAULTS, ({ sites }) => {
            const siteMap = sites || {};
            if (siteMap[activeHostname]) return;
            if (!toggle || !toggle.checked || siteDisabled) return;
            if (settingsState.newSiteDefault === "disabled") return;
            applyPaletteToHostname(activeHostname, palette);
        });
    });
}

if (rolesDetails) {
    rolesDetails.open = false;
    document.body.classList.toggle("roles-expanded", rolesDetails.open);
    rolesDetails.addEventListener("toggle", () => {
        document.body.classList.toggle("roles-expanded", rolesDetails.open);
    });
}

document.querySelectorAll("button[data-theme]").forEach(btn => {
    btn.addEventListener("click", () => {
        const themeName = btn.dataset.theme;
        currentPalette = normalizePalette(themes[themeName]);
        syncInputs(currentPalette);
        savePaletteForHost(activeHostname, currentPalette);
        applyPaletteToActiveTab(currentPalette);
    });
});

document.querySelectorAll("input[type=color]").forEach(input => {
    input.addEventListener("input", () => {
        const role = input.dataset.role;
        const value = input.value;
        currentPalette = normalizePalette({
            ...currentPalette,
            [role]: value
        });
        savePaletteForHost(activeHostname, currentPalette);
        applyPaletteToActiveTab(currentPalette);
    });
});
