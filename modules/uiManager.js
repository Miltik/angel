/**
 * ANGEL UI Manager - Simplified DOM Windows with Console Fallback
 * Gracefully degrades if DOM is unavailable during module load
 * All DOM operations deferred until window creation (runtime)
 * 
 * Usage:
 * import { createWindow } from "/angel/modules/uiManager.js";
 * const ui = createWindow("hacking", "Hacking Module", 600, 400);
 * ui.log("Started operations");
 */

const WINDOWS = new Map();
let nsReference = null;  // Store NS reference for file I/O
const UI_PREFS_KEY = "angelUiWindowPrefs";
let windowPrefsCache = null;

function saveWindowPrefs(prefs) {
    try {
        localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs || {}));
        if (nsReference) {
            try {
                nsReference.write("angel_uiprefs.json", JSON.stringify(prefs || {}), "w");
            } catch (e) {
                // ignore file write failures
            }
        }
    } catch (e) {
        // ignore
    }
}

function loadWindowPrefs() {
    try {
        if (nsReference) {
            try {
                const fileContent = nsReference.read("angel_uiprefs.json");
                if (fileContent) {
                    return JSON.parse(fileContent) || {};
                }
            } catch (e) {
                // fall through
            }
        }
        return JSON.parse(localStorage.getItem(UI_PREFS_KEY) || "{}");
    } catch (e) {
        return {};
    }
}

function getWindowPrefs() {
    if (!windowPrefsCache) {
        windowPrefsCache = loadWindowPrefs() || {};

        // Safety recovery: never permanently hide the UI launcher,
        // and ensure at least one core control window is visible.
        let changed = false;
        if (windowPrefsCache["ui-launcher"] === false) {
            windowPrefsCache["ui-launcher"] = true;
            changed = true;
        }
        if (windowPrefsCache["dashboard"] === false && windowPrefsCache["ui-launcher"] === false) {
            windowPrefsCache["dashboard"] = true;
            changed = true;
        }
        if (changed) {
            saveWindowPrefs(windowPrefsCache);
        }
    }
    return windowPrefsCache;
}

function getDefaultVisibility(id) {
    return id === "dashboard" || id === "ui-launcher";
}

function getPreferredVisibility(id) {
    if (id === "ui-launcher") {
        return true;
    }
    const prefs = getWindowPrefs();
    if (Object.prototype.hasOwnProperty.call(prefs, id)) {
        return Boolean(prefs[id]);
    }
    return getDefaultVisibility(id);
}

function persistVisibility(id, visible) {
    const prefs = getWindowPrefs();
    prefs[id] = Boolean(visible);
    windowPrefsCache = prefs;
    saveWindowPrefs(prefs);
}

// Window state persistence (localStorage + file backup)
function saveWindowState(id, state) {
    try {
        const allStates = JSON.parse(localStorage.getItem("angelWindowStates") || "{}");
        allStates[id] = state;
        localStorage.setItem("angelWindowStates", JSON.stringify(allStates));
        
        // Also save to file for persistence across game resets
        if (nsReference) {
            try {
                nsReference.write("angel_windowstates.json", JSON.stringify(allStates), "w");
            } catch (e) {
                // Silently fail if file write not available
            }
        }
    } catch (e) {
        // Silently fail if localStorage not available
    }
}

function loadWindowState(id) {
    try {
        // Try file first (survives game resets)
        if (nsReference) {
            try {
                const fileContent = nsReference.read("angel_windowstates.json");
                if (fileContent) {
                    const allStates = JSON.parse(fileContent);
                    return allStates[id] || null;
                }
            } catch (e) {
                // Fall through to localStorage
            }
        }
        
        // Fall back to localStorage
        const allStates = JSON.parse(localStorage.getItem("angelWindowStates") || "{}");
        return allStates[id] || null;
    } catch (e) {
        return null;
    }
}

// Check if DOM is available early
let htmlElement = null;
let bodyElement = null;
let isDomAvailable = false;

function checkDom() {
    if (isDomAvailable) return true;
    try {
        htmlElement = document?.documentElement;
        bodyElement = document?.body;
        isDomAvailable = !!(htmlElement && bodyElement);
    } catch (e) {
        isDomAvailable = false;
    }
    return isDomAvailable;
}

// Styles to inject - pure string, no DOM yet
const CSS_STYLES = `.angel-window{position:fixed;background:#1e1e1e;color:#e0e0e0;border:1px solid #404040;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.5);font-family:'Courier New',monospace;font-size:12px;z-index:10000;display:flex;flex-direction:column;min-width:300px;min-height:40px;transition:height 0.2s ease}.angel-window-header{background:linear-gradient(135deg,#2c3e50,#34495e);color:#ecf0f1;padding:10px 12px;cursor:move;user-select:none;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #404040;border-radius:8px 8px 0 0;font-weight:bold;flex-shrink:0}.angel-window-header-title{flex:1}.angel-window-header-buttons{display:flex;gap:8px}.angel-window-btn{background:#34495e;color:#ecf0f1;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:background .2s}.angel-window-btn:hover{background:#3d5a73}.angel-window-content{flex:1;overflow-y:auto;padding:12px;scrollbar-width:thin;scrollbar-color:#404040 #1e1e1e}.angel-window-content::-webkit-scrollbar{width:8px}.angel-window-content::-webkit-scrollbar-track{background:#1e1e1e}.angel-window-content::-webkit-scrollbar-thumb{background:#404040;border-radius:4px}.angel-window-content::-webkit-scrollbar-thumb:hover{background:#555}.angel-window-resize{position:absolute;width:20px;height:20px;bottom:0;right:0;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,#404040 50%);border-radius:0 0 8px 0}.angel-log-line{white-space:pre-wrap;word-break:break-word;margin:4px 0;line-height:1.4}.angel-log-info{color:#3498db}.angel-log-success{color:#2ecc71}.angel-log-warn{color:#f39c12}.angel-log-error{color:#e74c3c}.angel-log-debug{color:#95a5a6}`;

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected || !isDomAvailable) return;
    try {
        const style = document.createElement("style");
        style.textContent = CSS_STYLES;
        document.head.appendChild(style);
        stylesInjected = true;
    } catch (e) {
        // Silently fail
    }
}

function createMockWindow(id, title) {
    return {
        id: id,
        isMock: true,
        log(msg, level = "info") {
            console.log(`[${id}] ${msg}`);
        },
        clear() { },
        update(html) { },
        append(html) { },
        toggle() { },
        close() { WINDOWS.delete(id); },
    };
}

export function createWindow(id, title, width = 600, height = 400, ns = null) {
    // Store NS reference for file I/O (use first non-null reference)
    if (ns && !nsReference) {
        nsReference = ns;
    }
    
    if (WINDOWS.has(id)) {
        const existing = WINDOWS.get(id);
        const preferredVisible = getPreferredVisibility(id);
        if (!existing.isMock && existing.element) {
            existing.element.style.display = preferredVisible ? "flex" : "none";
        }
        return existing;
    }

    if (!checkDom()) {
        const mock = createMockWindow(id, title);
        WINDOWS.set(id, mock);
        return mock;
    }

    try {
        injectStyles();

        const requestedWidth = width;
        const requestedHeight = height;

        // Create container
        const container = document.createElement("div");
        container.className = "angel-window";
        container.id = `angel-window-${id}`;
        container.style.width = width + "px";
        container.style.height = height + "px";
        container.style.left = (50 + WINDOWS.size * 20) + "px";
        container.style.top = (50 + WINDOWS.size * 20) + "px";

        // Load saved state if available
        const savedState = loadWindowState(id);
        if (savedState) {
            container.style.left = savedState.left + "px";
            container.style.top = savedState.top + "px";
            container.style.width = savedState.width + "px";
            container.style.height = savedState.height + "px";
        }

        // Header
        const header = document.createElement("div");
        header.className = "angel-window-header";

        const titleEl = document.createElement("div");
        titleEl.className = "angel-window-header-title";
        titleEl.textContent = title;

        const buttons = document.createElement("div");
        buttons.className = "angel-window-header-buttons";

        const minimizeBtn = document.createElement("button");
        minimizeBtn.className = "angel-window-btn";
        minimizeBtn.textContent = "−";

        const closeBtn = document.createElement("button");
        closeBtn.className = "angel-window-btn";
        closeBtn.textContent = "✕";

        buttons.appendChild(minimizeBtn);
        buttons.appendChild(closeBtn);
        header.appendChild(titleEl);
        header.appendChild(buttons);

        // Content area
        const content = document.createElement("div");
        content.className = "angel-window-content";

        // Resize handle
        const resize = document.createElement("div");
        resize.className = "angel-window-resize";

        container.appendChild(header);
        container.appendChild(content);
        container.appendChild(resize);
        container.style.display = getPreferredVisibility(id) ? "flex" : "none";
        document.body.appendChild(container);

        // Setup event handlers
        let minimizedState = { isMinimized: false, originalHeight: height };
        let autoSizeEnabled = !savedState;
        let autoSizeScheduled = false;

        function fitToContent() {
            if (!autoSizeEnabled || minimizedState.isMinimized || container.style.display === "none") {
                return;
            }

            const headerHeight = header.offsetHeight || 32;
            const horizontalPadding = 32;
            const verticalPadding = 24;

            const targetWidth = Math.max(
                320,
                Math.min(requestedWidth, Math.ceil((content.scrollWidth || 0) + horizontalPadding))
            );

            const targetHeight = Math.max(
                120,
                Math.min(requestedHeight, Math.ceil((content.scrollHeight || 0) + headerHeight + verticalPadding))
            );

            container.style.width = `${targetWidth}px`;
            container.style.height = `${targetHeight}px`;
        }

        function scheduleAutoSize() {
            if (!autoSizeEnabled || autoSizeScheduled) return;
            autoSizeScheduled = true;
            requestAnimationFrame(() => {
                autoSizeScheduled = false;
                fitToContent();
            });
        }
        
        minimizeBtn.onclick = () => {
            minimizedState.isMinimized = !minimizedState.isMinimized;
            
            if (minimizedState.isMinimized) {
                // Save original height before minimizing
                minimizedState.originalHeight = container.style.height || (height + "px");
                // Collapse to just header (about 32px)
                container.style.height = "32px";
                container.style.minHeight = "32px";
                container.style.maxHeight = "32px";
                container.style.overflow = "hidden";
                content.style.display = "none";
                resize.style.display = "none";
                minimizeBtn.textContent = "+";
            } else {
                // Restore
                container.style.height = minimizedState.originalHeight;
                container.style.minHeight = "";
                container.style.maxHeight = "";
                container.style.overflow = "";
                content.style.display = "block";
                resize.style.display = "block";
                minimizeBtn.textContent = "−";
            }
            
            // Save state
            saveWindowState(id, {
                left: container.style.left,
                top: container.style.top,
                width: container.style.width,
                height: container.style.height,
                minimized: minimizedState.isMinimized
            });
        };
        
        closeBtn.onclick = () => {
            container.style.display = "none";
            persistVisibility(id, false);
        };

        // Make draggable
        let dragState = { pos1: 0, pos2: 0, pos3: 0, pos4: 0 };
        header.onmousedown = (e) => {
            e.preventDefault();
            dragState.pos3 = e.clientX;
            dragState.pos4 = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
                // Save window state after drag
                saveWindowState(id, {
                    left: container.style.left,
                    top: container.style.top,
                    width: container.style.width,
                    height: container.style.height,
                    minimized: minimizedState.isMinimized
                });
            };
            document.onmousemove = (e) => {
                dragState.pos1 = dragState.pos3 - e.clientX;
                dragState.pos2 = dragState.pos4 - e.clientY;
                dragState.pos3 = e.clientX;
                dragState.pos4 = e.clientY;
                container.style.top = (container.offsetTop - dragState.pos2) + "px";
                container.style.left = (container.offsetLeft - dragState.pos1) + "px";
            };
        };

        // Make resizable
        let resizeState = { isResizing: false };
        resize.onmousedown = (e) => {
            resizeState.isResizing = true;
            resizeState.startX = e.clientX;
            resizeState.startY = e.clientY;
            resizeState.startW = parseInt(window.getComputedStyle(container).width, 10);
            resizeState.startH = parseInt(window.getComputedStyle(container).height, 10);
            document.onmouseup = () => {
                resizeState.isResizing = false;
                document.onmouseup = null;
                document.onmousemove = null;
                autoSizeEnabled = false;
                // Save window state after resize
                saveWindowState(id, {
                    left: container.style.left,
                    top: container.style.top,
                    width: container.style.width,
                    height: container.style.height,
                    minimized: minimizedState.isMinimized
                });
            };
            document.onmousemove = (e) => {
                if (!resizeState.isResizing) return;
                const w = Math.max(300, resizeState.startW + (e.clientX - resizeState.startX));
                const h = Math.max(150, resizeState.startH + (e.clientY - resizeState.startY));
                container.style.width = w + "px";
                container.style.height = h + "px";
            };
        };

        // Window API
        const windowApi = {
            element: container,
            contentEl: content,
            id: id,
            isMock: false,
            log(message, level = "info") {
                const line = document.createElement("div");
                line.className = "angel-log-line angel-log-" + level;
                line.textContent = message;
                content.appendChild(line);
                content.scrollTop = content.scrollHeight;
                scheduleAutoSize();
            },
            clear() { content.innerHTML = ""; },
            update(html) {
                content.innerHTML = html;
                scheduleAutoSize();
            },
            append(html) {
                const el = document.createElement("div");
                el.innerHTML = html;
                content.appendChild(el);
                content.scrollTop = content.scrollHeight;
                scheduleAutoSize();
            },
            toggle() {
                content.style.display = content.style.display === "none" ? "block" : "none";
            },
            show() {
                container.style.display = "flex";
                persistVisibility(id, true);
                scheduleAutoSize();
            },
            hide() {
                container.style.display = "none";
                persistVisibility(id, false);
            },
            close() {
                container.style.display = "none";
                persistVisibility(id, false);
            },
        };

        WINDOWS.set(id, windowApi);
        
        // Restore minimized state if it was saved that way
        if (savedState && savedState.minimized) {
            minimizedState.isMinimized = true;
            container.style.height = "32px";
            container.style.minHeight = "32px";
            container.style.maxHeight = "32px";
            container.style.overflow = "hidden";
            content.style.display = "none";
            resize.style.display = "none";
            minimizeBtn.textContent = "+";
        }

        scheduleAutoSize();
        
        return windowApi;

    } catch (e) {
        const mock = createMockWindow(id, title);
        WINDOWS.set(id, mock);
        return mock;
    }
}

export function setWindowVisibility(id, visible) {
    persistVisibility(id, visible);
    const windowApi = WINDOWS.get(id);
    if (windowApi && !windowApi.isMock && windowApi.element) {
        windowApi.element.style.display = visible ? "flex" : "none";
    }
}

export function getWindowVisibility(id) {
    return getPreferredVisibility(id);
}

export function toggleWindowVisibility(id) {
    const next = !getPreferredVisibility(id);
    setWindowVisibility(id, next);
    return next;
}

export function getWindow(id) {
    return WINDOWS.get(id);
}

export function getWindows() {
    return Array.from(WINDOWS.values());
}

export function closeAll() {
    for (const w of WINDOWS.values()) {
        w.close();
    }
}
