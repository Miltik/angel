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
const CSS_STYLES = `.angel-window{position:fixed;background:#1e1e1e;color:#e0e0e0;border:1px solid #404040;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.5);font-family:'Courier New',monospace;font-size:12px;z-index:10000;display:flex;flex-direction:column;min-width:300px;min-height:150px}.angel-window-header{background:linear-gradient(135deg,#2c3e50,#34495e);color:#ecf0f1;padding:10px 12px;cursor:move;user-select:none;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #404040;border-radius:8px 8px 0 0;font-weight:bold}.angel-window-header-title{flex:1}.angel-window-header-buttons{display:flex;gap:8px}.angel-window-btn{background:#34495e;color:#ecf0f1;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:background .2s}.angel-window-btn:hover{background:#3d5a73}.angel-window-content{flex:1;overflow-y:auto;padding:12px;scrollbar-width:thin;scrollbar-color:#404040 #1e1e1e}.angel-window-content::-webkit-scrollbar{width:8px}.angel-window-content::-webkit-scrollbar-track{background:#1e1e1e}.angel-window-content::-webkit-scrollbar-thumb{background:#404040;border-radius:4px}.angel-window-content::-webkit-scrollbar-thumb:hover{background:#555}.angel-window-resize{position:absolute;width:20px;height:20px;bottom:0;right:0;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,#404040 50%);border-radius:0 0 8px 0}.angel-log-line{white-space:pre-wrap;word-break:break-word;margin:4px 0;line-height:1.4}.angel-log-info{color:#3498db}.angel-log-success{color:#2ecc71}.angel-log-warn{color:#f39c12}.angel-log-error{color:#e74c3c}.angel-log-debug{color:#95a5a6}`;

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

export function createWindow(id, title, width = 600, height = 400) {
    if (WINDOWS.has(id)) {
        return WINDOWS.get(id);
    }

    if (!checkDom()) {
        const mock = createMockWindow(id, title);
        WINDOWS.set(id, mock);
        return mock;
    }

    try {
        injectStyles();

        // Create container
        const container = document.createElement("div");
        container.className = "angel-window";
        container.id = `angel-window-${id}`;
        container.style.width = width + "px";
        container.style.height = height + "px";
        container.style.left = (50 + WINDOWS.size * 20) + "px";
        container.style.top = (50 + WINDOWS.size * 20) + "px";

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
        document.body.appendChild(container);

        // Setup event handlers
        minimizeBtn.onclick = () => {
            content.style.display = content.style.display === "none" ? "block" : "none";
        };
        closeBtn.onclick = () => {
            container.remove();
            WINDOWS.delete(id);
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
            },
            clear() { content.innerHTML = ""; },
            update(html) { content.innerHTML = html; },
            append(html) {
                const el = document.createElement("div");
                el.innerHTML = html;
                content.appendChild(el);
                content.scrollTop = content.scrollHeight;
            },
            toggle() {
                content.style.display = content.style.display === "none" ? "block" : "none";
            },
            close() {
                container.remove();
                WINDOWS.delete(id);
            },
        };

        WINDOWS.set(id, windowApi);
        return windowApi;

    } catch (e) {
        const mock = createMockWindow(id, title);
        WINDOWS.set(id, mock);
        return mock;
    }
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
