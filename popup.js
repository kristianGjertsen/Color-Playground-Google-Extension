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
    enabled: false,
    sites: {
        "*": DEFAULT_PALETTE
    },
    disabledSites: {},
    bases: {},
    settings: {
        newSiteDefault: "disabled",
        defaultPaletteName: "dark",
        defaultPalette: DEFAULT_PALETTE
    }
};

const ENGINE_CSS_URL = chrome.runtime.getURL("engine.css");
const engineCssPromise = fetch(ENGINE_CSS_URL)
    .then(response => response.text())
    .catch(() => "");

const toggle = document.getElementById("enabledToggle");
const siteToggle = document.getElementById("siteToggle");
const newSiteSelect = document.getElementById("newSiteDefault");
const defaultPaletteSelect = document.getElementById("defaultPalette");
const rolesDetails = document.querySelector(".roles-details");
const openSettingsButton = document.getElementById("openSettings");
const closeSettingsButton = document.getElementById("closeSettings");
const clearAllDataButton = document.getElementById("clearAllData");
let activeTabId = null;
let activeHostname = "*";
let currentPalette = {};
let basePalette = { ...DEFAULT_PALETTE };
let siteDisabled = false;
let settingsState = {
    newSiteDefault: "disabled",
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

const paletteToVarsCss = (palette) => {
    const p = normalizePalette(palette);

    return `
:root {
  --bg-primary: ${p.bgPrimary};
  --bg-secondary: ${p.bgSecondary};
  --surface-raised: ${p.surfaceRaised};

  --text-primary: ${p.textPrimary};
  --text-secondary: ${p.textSecondary};
  --text-heading: ${p.textHeading};

  --accent-primary: ${p.accentPrimary};
  --accent-secondary: ${p.accentSecondary};

  --border-color: ${p.border};
  --icon-color: ${p.icon};
}
`.trim();
};

const applyPaletteToTab = (tabId, palette) => {
    const varsCss = paletteToVarsCss(palette);
    engineCssPromise.then(engineCss => {
        chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                // Installer kun én gang per side
                if (window.__cpButtonMarkerInstalled) {
                    window.__cpMarkButtons?.();
                    return;
                }
                window.__cpButtonMarkerInstalled = true;

                const isTransparent = (value) =>
                    !value ||
                    value === "transparent" ||
                    value === "rgba(0, 0, 0, 0)" ||
                    value === "rgba(0,0,0,0)";

                const toPx = (value) => parseFloat(value) || 0;

                const markButtons = () => {
                    document.querySelectorAll("a[href]").forEach(a => {
                        const r = a.getBoundingClientRect();
                        const width = r.width;
                        const height = r.height;
                        if (!width || !height) {
                            a.removeAttribute("data-cp-button");
                            return;
                        }

                        const area = width * height;
                        const style = getComputedStyle(a);
                        const paddingX = toPx(style.paddingLeft) + toPx(style.paddingRight);
                        const borderRadius = toPx(style.borderRadius);
                        const hasBg = !isTransparent(style.backgroundColor);
                        const display = style.display;

                        // NB: hasBg er ofte for strengt på SPA-sider.
                        // Derfor: tillat også "knappete" uten bakgrunn hvis radius+padding er stor nok.
                        const looksButtonyWithoutBg = borderRadius >= 10 && paddingX >= 18;

                        const isLikelyButton =
                            height >= 28 &&
                            height <= 72 &&
                            width >= 72 &&
                            width <= 420 &&
                            area <= 90000 &&
                            paddingX >= 12 &&
                            borderRadius >= 6 &&
                            (hasBg || looksButtonyWithoutBg) &&
                            (display === "inline-block" ||
                                display === "inline-flex" ||
                                display === "flex" ||
                                display === "inline");

                        if (isLikelyButton) {
                            a.dataset.cpButton = "true";
                        } else {
                            a.removeAttribute("data-cp-button");
                        }
                    });
                };

                window.__cpMarkButtons = markButtons;

                // Throttle kjøringer ved DOM-endringer
                let timer = null;
                const schedule = () => {
                    if (timer) return;
                    timer = setTimeout(() => {
                        timer = null;
                        markButtons();
                    }, 200);
                };

                // Kjør flere ganger etter load for SPA-render
                markButtons();
                [150, 500, 1200, 2500, 5000].forEach(ms => setTimeout(markButtons, ms));

                // Observer DOM og re-kjør når UI endrer seg
                const obs = new MutationObserver(schedule);
                obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
                window.__cpButtonObserver = obs;

                window.addEventListener("resize", schedule, { passive: true });
                window.addEventListener("scroll", schedule, { passive: true });
            }
        });

    });

    chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const isTransparent = (value) =>
                !value ||
                value === "transparent" ||
                value === "rgba(0, 0, 0, 0)" ||
                value === "rgba(0,0,0,0)";
            const toPx = (value) => parseFloat(value) || 0;

            document.querySelectorAll("a[href]").forEach(a => {
                const r = a.getBoundingClientRect();
                const width = r.width;
                const height = r.height;
                const area = width * height;
                const style = getComputedStyle(a);
                const paddingX = toPx(style.paddingLeft) + toPx(style.paddingRight);
                const borderRadius = toPx(style.borderRadius);
                const hasBg = !isTransparent(style.backgroundColor);
                const display = style.display;

                const isLikelyButton =
                    height >= 32 &&
                    height <= 64 &&
                    width >= 80 &&
                    width <= 360 &&
                    area <= 35000 &&
                    paddingX >= 16 &&
                    hasBg &&
                    borderRadius >= 6 &&
                    (display === "inline-block" ||
                        display === "inline-flex" ||
                        display === "flex" ||
                        display === "inline");

                if (isLikelyButton) {
                    a.dataset.cpButton = "true";
                } else {
                    a.removeAttribute("data-cp-button");
                }
            });
        }
    });
};

const extractPagePalette = (tabId) =>
    chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const elements = [
                document.body,
                ...document.querySelectorAll("main, section, header, footer, nav"),
                ...document.querySelectorAll("p, h1, h2, h3, h4, h5, a, button, small, time")
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
                    data.usages.some(u => u.prop === "backgroundColor" && u.area > 20000)
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

                if (!roles.textHeading && data.usages.some(u => u.tag.startsWith("H"))) {
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

            return roles;
        }
    });

const refreshBasePalette = () => {
    if (!activeTabId) return;
    if (toggle && toggle.checked) return;
    chrome.storage.local.get(STORAGE_DEFAULTS, ({ bases }) => {
        const baseMap = bases || {};
        if (baseMap[activeHostname]) return;
        extractPagePalette(activeTabId)
            .then(([res]) => {
                if (!res || !res.result) return;
                const detected = res.result;
                basePalette = normalizePalette(detected);
                chrome.storage.local.set({
                    bases: { ...baseMap, [activeHostname]: basePalette }
                });
                const displayPalette = normalizePalette({
                    ...basePalette,
                    ...currentPalette
                });
                syncInputs(displayPalette);
            })
            .catch(() => { });
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
        ({ enabled, sites, disabledSites, settings, bases }) => {
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
            const baseMap = bases || {};
            if (baseMap[activeHostname]) {
                basePalette = normalizePalette(baseMap[activeHostname]);
            }
            const overrides = siteMap[activeHostname] || {};
            currentPalette = { ...overrides };
            const displayPalette = normalizePalette({
                ...basePalette,
                ...overrides
            });
            syncInputs(displayPalette);
            siteDisabled = Boolean(disabledSites && disabledSites[activeHostname]);
            updateSiteToggle();
        }
    );
};

const savePaletteForHost = (hostname, palette) =>
    new Promise(resolve => {
        chrome.storage.local.get(STORAGE_DEFAULTS, ({ sites }) => {
            const nextSites = { ...(sites || {}) };
            const cleaned = { ...palette };
            Object.keys(cleaned).forEach(key => {
                if (!cleaned[key]) {
                    delete cleaned[key];
                }
            });

            if (Object.keys(cleaned).length === 0) {
                delete nextSites[hostname];
            } else {
                nextSites[hostname] = cleaned;
            }
            chrome.storage.local.set({ sites: nextSites }, resolve);
        });
    });

const applyPaletteToActiveTab = (palette) => {
    if (!toggle || !toggle.checked) return;
    if (!activeHostname || activeHostname === "*") return;
    if (siteDisabled) return;
    if (!activeTabId) return;
    chrome.storage.local.get(STORAGE_DEFAULTS, (data) => {
        const merged = buildMergedPalette(activeHostname, data);
        if (!merged) {
            removePaletteFromHostname(activeHostname);
            return;
        }
        applyPaletteToTab(activeTabId, merged);
    });
};

const buildMergedPalette = (hostname, data) => {
    const siteMap = data.sites || {};
    const baseMap = data.bases || {};
    const resolvedSettings = { ...STORAGE_DEFAULTS.settings, ...(data.settings || {}) };
    const overrides = siteMap[hostname] || {};
    const hasOverrides = Object.keys(overrides).length > 0;
    const fallbackPalette =
        resolvedSettings.defaultPalette || siteMap["*"] || DEFAULT_PALETTE;

    if (!hasOverrides && resolvedSettings.newSiteDefault === "disabled") {
        return null;
    }

    const base = baseMap[hostname] || fallbackPalette;
    if (hasOverrides) {
        return normalizePalette({ ...base, ...overrides });
    }
    return normalizePalette(fallbackPalette);
};

const applyStoredPalettesToAllTabs = () => {
    chrome.storage.local.get(STORAGE_DEFAULTS, (data) => {
        const disabledMap = data.disabledSites || {};
        forEachEligibleTab(tab => {
            const hostname = getHostnameFromUrl(tab.url);
            if (disabledMap[hostname]) {
                removePaletteFromTab(tab.id);
                return;
            }
            const paletteToApply = buildMergedPalette(hostname, data);
            if (!paletteToApply) {
                removePaletteFromTab(tab.id);
                return;
            }
            applyPaletteToTab(tab.id, paletteToApply);
        });
    });
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

const notifyBackground = (type, payload = {}) => {
    chrome.runtime.sendMessage({ type, ...payload });
};

const queryActiveTab = (callback) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs && tabs.length) {
            callback(tabs[0]);
            return;
        }
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            callback(tab);
        });
    });
};

const refreshActiveTab = () =>
    new Promise(resolve => {
        queryActiveTab((tab) => {
            if (tab && tab.id) {
                activeTabId = tab.id;
                activeHostname =
                    tab.url && !isRestrictedUrl(tab.url)
                        ? getHostnameFromUrl(tab.url)
                        : "*";
            }
            resolve(tab);
        });
    });

queryActiveTab((tab) => {
    if (tab && tab.id && tab.url && !isRestrictedUrl(tab.url)) {
        activeTabId = tab.id;
        activeHostname = getHostnameFromUrl(tab.url);
    } else if (tab && tab.id) {
        activeTabId = tab.id;
        activeHostname = "*";
    }
    loadState();
    refreshBasePalette();
});

if (toggle) {
    toggle.addEventListener("change", () => {
        refreshActiveTab().then(() => {
            const enabled = toggle.checked;
            chrome.storage.local.set({ enabled }, () => {
                notifyBackground("sync-all");
            });
        });
    });
}

if (siteToggle) {
    siteToggle.addEventListener("click", () => {
        refreshActiveTab().then(() => {
            if (!activeHostname || activeHostname === "*") return;
            chrome.storage.local.get(
                STORAGE_DEFAULTS,
                (data) => {
                    const { disabledSites } = data;
                    const disabledMap = { ...(disabledSites || {}) };
                    if (disabledMap[activeHostname]) {
                        delete disabledMap[activeHostname];
                        siteDisabled = false;
                    } else {
                        disabledMap[activeHostname] = true;
                        siteDisabled = true;
                    }
                    chrome.storage.local.set({ disabledSites: disabledMap }, () => {
                        updateSiteToggle();
                        notifyBackground("sync-hostname", {
                            hostname: activeHostname
                        });
                    });
                }
            );
        });
    });
}

if (newSiteSelect) {
    newSiteSelect.addEventListener("change", () => {
        refreshActiveTab().then(() => {
            const newSiteDefault = newSiteSelect.value;
            settingsState = {
                ...settingsState,
                newSiteDefault
            };
            chrome.storage.local.set({ settings: settingsState }, () => {
                if (!activeHostname || activeHostname === "*") return;
                notifyBackground("sync-hostname", {
                    hostname: activeHostname
                });
            });
        });
    });
}

if (defaultPaletteSelect) {
    defaultPaletteSelect.addEventListener("change", () => {
        refreshActiveTab().then(() => {
            const paletteName = defaultPaletteSelect.value;
            const palette = normalizePalette(themes[paletteName] || DEFAULT_PALETTE);
            settingsState = {
                ...settingsState,
                defaultPaletteName: paletteName,
                defaultPalette: palette
            };
            chrome.storage.local.set({ settings: settingsState }, () => {
                if (!activeHostname || activeHostname === "*") return;
                notifyBackground("sync-hostname", {
                    hostname: activeHostname
                });
            });
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

const openSettings = () => {
    document.body.classList.add("settings-open");
    const panel = document.querySelector(".settings-panel");
    if (panel) panel.setAttribute("aria-hidden", "false");
    if (openSettingsButton) openSettingsButton.disabled = true;
};

const closeSettings = () => {
    document.body.classList.remove("settings-open");
    const panel = document.querySelector(".settings-panel");
    if (panel) panel.setAttribute("aria-hidden", "true");
    if (openSettingsButton) openSettingsButton.disabled = false;
};

if (openSettingsButton) {
    openSettingsButton.addEventListener("click", openSettings);
}

if (closeSettingsButton) {
    closeSettingsButton.addEventListener("click", closeSettings);
}

if (clearAllDataButton) {
    clearAllDataButton.addEventListener("click", () => {
        const shouldClear = window.confirm(
            "Clear all saved data for all sites? This will reset your settings."
        );
        if (!shouldClear) return;
        chrome.storage.local.clear(() => {
            chrome.storage.local.set(STORAGE_DEFAULTS, () => {
                siteDisabled = false;
                settingsState = { ...STORAGE_DEFAULTS.settings };
                loadState();
                notifyBackground("sync-all");
            });
        });
    });
}

document.querySelectorAll("button[data-theme]").forEach(btn => {
    btn.addEventListener("click", () => {
        refreshActiveTab().then(() => {
            const themeName = btn.dataset.theme;
            if (themeName === "original") {
                currentPalette = {};
                const displayPalette = normalizePalette(basePalette);
                syncInputs(displayPalette);
                savePaletteForHost(activeHostname, currentPalette).then(() => {
                    if (!activeHostname || activeHostname === "*") return;
                    notifyBackground("sync-hostname", {
                        hostname: activeHostname
                    });
                });
                return;
            }

            currentPalette = normalizePalette(themes[themeName]);
            syncInputs(currentPalette);
            savePaletteForHost(activeHostname, currentPalette).then(() => {
                if (!activeHostname || activeHostname === "*") return;
                notifyBackground("sync-hostname", {
                    hostname: activeHostname
                });
            });
        });
    });
});

document.querySelectorAll("input[type=color]").forEach(input => {
    input.addEventListener("input", () => {
        refreshActiveTab().then(() => {
            const role = input.dataset.role;
            const value = input.value;
            currentPalette = { ...currentPalette, [role]: value };
            savePaletteForHost(activeHostname, currentPalette).then(() => {
                if (!activeHostname || activeHostname === "*") return;
                notifyBackground("sync-hostname", {
                    hostname: activeHostname
                });
            });
        });
    });
});
