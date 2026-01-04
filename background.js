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
    newSiteDefault: "disabled",
    defaultPalette: DEFAULT_PALETTE
};
const STORAGE_DEFAULTS = {
    enabled: false,
    sites: {},
    disabledSites: {},
    settings: DEFAULT_SETTINGS,
    bases: {}
};

const ENGINE_CSS_URL = chrome.runtime.getURL("engine.css");
const engineCssPromise = fetch(ENGINE_CSS_URL)
    .then(response => response.text())
    .catch(() => "");

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
    engineCssPromise.then(engineCss => {
        chrome.scripting.executeScript({
            target: { tabId },
            func: (engineId, varsId, legacyId, engineCssText, varsCssText) => {
                const legacy = document.getElementById(legacyId);
                if (legacy) legacy.remove();

                const existingEngine = document.getElementById(engineId);
                if (existingEngine) existingEngine.remove();
                const existingVars = document.getElementById(varsId);
                if (existingVars) existingVars.remove();

                const root = document.head || document.documentElement;

                const engine = document.createElement("style");
                engine.id = engineId;
                engine.textContent = engineCssText;
                root.appendChild(engine);

                const vars = document.createElement("style");
                vars.id = varsId;
                vars.textContent = varsCssText;
                root.appendChild(vars);
            },
            args: [
                STYLE_ENGINE_ID,
                STYLE_VARS_ID,
                LEGACY_STYLE_ID,
                engineCss,
                varsCss
            ]
        });
    });

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

            return roles;
        }
    });

const getStorage = () =>
    new Promise(resolve => chrome.storage.local.get(STORAGE_DEFAULTS, resolve));

const queryActiveTab = () =>
    new Promise(resolve => {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            if (tabs && tabs.length) {
                resolve(tabs[0]);
                return;
            }
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                resolve(tab);
            });
        });
    });

const ensureBasePalette = async (tabId, hostname, data, fallback) => {
    const baseMap = data.bases || {};
    if (baseMap[hostname]) {
        return normalizePalette(baseMap[hostname]);
    }
    try {
        const [res] = await analyzePageColors(tabId);
        if (res && res.result) {
            const base = normalizePalette(res.result);
            const nextBases = { ...baseMap, [hostname]: base };
            chrome.storage.local.set({ bases: nextBases });
            return base;
        }
    } catch (error) {
        return normalizePalette(fallback);
    }
    return normalizePalette(fallback);
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const captureOriginalForTab = async (tabId, hostname) => {
    let tab = null;
    if (tabId) {
        try {
            tab = await chrome.tabs.get(tabId);
        } catch (error) {
            tab = null;
        }
    }
    if (!tab) {
        tab = await queryActiveTab();
    }
    if (!tab || !tab.id || !tab.url || isRestrictedUrl(tab.url)) return;
    const resolvedHostname = hostname || getHostnameFromUrl(tab.url);
    if (!resolvedHostname || resolvedHostname === "*") return;

    removePaletteFromTab(tab.id);
    await wait(80);

    let detected = null;
    try {
        const [res] = await analyzePageColors(tab.id);
        if (res && res.result) {
            detected = normalizePalette(res.result);
        }
    } catch (error) {
        detected = null;
    }

    const data = await getStorage();
    const baseMap = data.bases || {};
    const siteMap = data.sites || {};
    const basePalette = detected || normalizePalette(baseMap[resolvedHostname] || DEFAULT_PALETTE);
    const nextBases = { ...baseMap, [resolvedHostname]: basePalette };
    const nextSites = { ...siteMap, [resolvedHostname]: basePalette };

    await new Promise(resolve =>
        chrome.storage.local.set({ bases: nextBases, sites: nextSites }, resolve)
    );

    await syncHostname(resolvedHostname);
};

const resolvePaletteForTab = async (tabId, url, data, options = {}) => {
    if (!data.enabled) return null;
    if (!url || isRestrictedUrl(url)) return null;
    const hostname = getHostnameFromUrl(url);
    if (data.disabledSites && data.disabledSites[hostname]) return null;

    const siteMap = data.sites || {};
    const baseMap = data.bases || {};
    const overrides = siteMap[hostname] || {};
    const hasOverrides = Object.keys(overrides).length > 0;
    const resolvedSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    const fallbackPalette =
        resolvedSettings.defaultPalette || siteMap["*"] || DEFAULT_PALETTE;
    let base = baseMap[hostname];
    if (!base && options.ensureBase) {
        base = await ensureBasePalette(tabId, hostname, data, fallbackPalette);
        if (base) {
            data.bases = { ...baseMap, [hostname]: base };
        }
    }

    if (!hasOverrides && resolvedSettings.newSiteDefault === "disabled") {
        return null;
    }

    if (hasOverrides) {
        const resolvedBase = base || fallbackPalette;
        return normalizePalette({ ...resolvedBase, ...overrides });
    }
    return normalizePalette(fallbackPalette);
};

const syncTabWithData = async (tab, data, options = {}) => {
    if (!tab || !tab.id || !tab.url || isRestrictedUrl(tab.url)) return;
    const palette = await resolvePaletteForTab(tab.id, tab.url, data, options);
    if (!palette) {
        removePaletteFromTab(tab.id);
        return;
    }
    applyPaletteToTab(tab.id, palette);
};

const syncAllTabs = async () => {
    const data = await getStorage();
    const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));
    await Promise.all(tabs.map(tab => syncTabWithData(tab, data)));
};

const syncActiveTab = async () => {
    const tab = await queryActiveTab();
    if (!tab) return;
    const data = await getStorage();
    await syncTabWithData(tab, data);
};

const syncHostname = async (hostname) => {
    if (!hostname || hostname === "*") return;
    const data = await getStorage();
    const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));
    const matches = tabs.filter(
        tab =>
            tab &&
            tab.url &&
            !isRestrictedUrl(tab.url) &&
            getHostnameFromUrl(tab.url) === hostname
    );
    await Promise.all(matches.map(tab => syncTabWithData(tab, data)));
};

console.log("Service worker started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;
    if (message.type === "sync-all") {
        syncAllTabs().then(() => sendResponse({ ok: true }));
        return true;
    }
    if (message.type === "sync-active") {
        syncActiveTab().then(() => sendResponse({ ok: true }));
        return true;
    }
    if (message.type === "sync-hostname") {
        syncHostname(message.hostname).then(() => sendResponse({ ok: true }));
        return true;
    }
    if (message.type === "capture-original") {
        captureOriginalForTab(message.tabId, message.hostname).then(() =>
            sendResponse({ ok: true })
        );
        return true;
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    if (!tab.url || isRestrictedUrl(tab.url)) return;
    getStorage().then((data) => {
        syncTabWithData(tab, data, { ensureBase: true });
    });
});


chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type !== "AI_GENERATE_PALETTE") return;

    fetch("https://colorplayground.kristiangjertsen5.workers.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: msg.prompt })
    })
        .then(r => r.json())
        .then((response) => {
            console.log("AI response:", response);
            const { palette } = response || {};
            if (!palette) return;

            // 🔁 Bruk samme vei som presets
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                if (!tab?.id || !tab.url) return;

                const hostname = new URL(tab.url).hostname;

                chrome.storage.local.get(STORAGE_DEFAULTS, (data) => {
                    const sites = { ...(data.sites || {}) };
                    sites[hostname] = palette;

                    chrome.storage.local.set({ sites }, () => {
                        applyPaletteToTab(tab.id, normalizePalette(palette));
                    });
                });
            });
        })
        .catch(err => {
            console.error("AI palette error:", err);
        });
});
