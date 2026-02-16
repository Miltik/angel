/**
 * ANGEL UI Manager - Dark-themed Repositionable/Resizable DOM Windows
 * Provides a shared DOM interface for all modules to display their own windows
 * 
 * Usage:
 * import { createWindow, log, update } from "/angel/modules/uiManager.js";
 * 
 * const ui = createWindow("hacking", "Hacking Module", 600, 400);
 * ui.log("Started hacking operations");
 * ui.update("<div>Custom HTML content</div>");
 * 
 * @param {NS} ns
 */

const WINDOWS = new Map();
const STYLES = `
    .angel-window {
        position: fixed;
        background: #1e1e1e;
        color: #e0e0e0;
        border: 1px solid #404040;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        min-width: 300px;
        min-height: 150px;
    }
    
    .angel-window-header {
        background: linear-gradient(135deg, #2c3e50, #34495e);
        color: #ecf0f1;
        padding: 10px 12px;
        cursor: move;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #404040;
        border-radius: 8px 8px 0 0;
        font-weight: bold;
    }
    
    .angel-window-header-title {
        flex: 1;
    }
    
    .angel-window-header-buttons {
        display: flex;
        gap: 8px;
    }
    
    .angel-window-btn {
        background: #34495e;
        color: #ecf0f1;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    }
    
    .angel-window-btn:hover {
        background: #3d5a73;
    }
    
    .angel-window-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        scrollbar-width: thin;
        scrollbar-color: #404040 #1e1e1e;
    }
    
    .angel-window-content::-webkit-scrollbar {
        width: 8px;
    }
    
    .angel-window-content::-webkit-scrollbar-track {
        background: #1e1e1e;
    }
    
    .angel-window-content::-webkit-scrollbar-thumb {
        background: #404040;
        border-radius: 4px;
    }
    
    .angel-window-content::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    
    .angel-window-resize {
        position: absolute;
        width: 20px;
        height: 20px;
        bottom: 0;
        right: 0;
        cursor: se-resize;
        background: linear-gradient(135deg, transparent 50%, #404040 50%);
        border-radius: 0 0 8px 0;
    }
    
    .angel-log-line {
        white-space: pre-wrap;
        word-break: break-word;
        margin: 4px 0;
        line-height: 1.4;
    }
    
    .angel-log-info { color: #3498db; }
    .angel-log-success { color: #2ecc71; }
    .angel-log-warn { color: #f39c12; }
    .angel-log-error { color: #e74c3c; }
    .angel-log-debug { color: #95a5a6; }
`;

/**
 * Initialize UI system - inject styles once
 */
let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    
    const style = document.createElement("style");
    style.textContent = STYLES;
    document.head.appendChild(style);
    stylesInjected = true;
}

/**
 * Create or get a DOM window for a module
 */
export function createWindow(id, title, width = 600, height = 400) {
    injectStyles();
    
    if (WINDOWS.has(id)) {
        return WINDOWS.get(id);
    }
    
    // Create container
    const container = document.createElement("div");
    container.className = "angel-window";
    container.id = `angel-window-${id}`;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.left = `${50 + (WINDOWS.size * 20)}px`;
    container.style.top = `${50 + (WINDOWS.size * 20)}px`;
    
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
    minimizeBtn.onclick = () => {
        const content = container.querySelector(".angel-window-content");
        content.style.display = content.style.display === "none" ? "block" : "none";
    };
    
    const closeBtn = document.createElement("button");
    closeBtn.className = "angel-window-btn";
    closeBtn.textContent = "✕";
    closeBtn.onclick = () => {
        container.remove();
        WINDOWS.delete(id);
    };
    
    buttons.appendChild(minimizeBtn);
    buttons.appendChild(closeBtn);
    
    header.appendChild(titleEl);
    header.appendChild(buttons);
    
    // Content area
    const content = document.createElement("div");
    content.className = "angel-window-content";
    content.id = `angel-content-${id}`;
    
    // Resize handle
    const resize = document.createElement("div");
    resize.className = "angel-window-resize";
    
    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(resize);
    
    document.body.appendChild(container);
    
    // Make draggable
    makeElementDraggable(container, header);
    
    // Make resizable
    makeElementResizable(container, resize);
    
    // Create window API object
    const windowApi = {
        element: container,
        contentEl: content,
        id: id,
        
        /**
         * Log a message with optional level
         */
        log(message, level = "info") {
            const line = document.createElement("div");
            line.className = `angel-log-line angel-log-${level}`;
            line.textContent = message;
            content.appendChild(line);
            content.scrollTop = content.scrollHeight;
        },
        
        /**
         * Clear all content
         */
        clear() {
            content.innerHTML = "";
        },
        
        /**
         * Update with custom HTML
         */
        update(html) {
            content.innerHTML = html;
        },
        
        /**
         * Append custom HTML
         */
        append(html) {
            const el = document.createElement("div");
            el.innerHTML = html;
            content.appendChild(el);
            content.scrollTop = content.scrollHeight;
        },
        
        /**
         * Minimize or restore
         */
        toggle() {
            content.style.display = content.style.display === "none" ? "block" : "none";
        },
        
        /**
         * Close window
         */
        close() {
            container.remove();
            WINDOWS.delete(id);
        },
    };
    
    WINDOWS.set(id, windowApi);
    return windowApi;
}

/**
 * Make element draggable
 */
function makeElementDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

/**
 * Make element resizable
 */
function makeElementResizable(element, handle) {
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    
    handle.onmousedown = (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);
        
        document.onmouseup = () => {
            isResizing = false;
            document.onmouseup = null;
            document.onmousemove = null;
        };
        
        document.onmousemove = (e) => {
            if (!isResizing) return;
            
            const newWidth = Math.max(300, startWidth + (e.clientX - startX));
            const newHeight = Math.max(150, startHeight + (e.clientY - startY));
            
            element.style.width = newWidth + "px";
            element.style.height = newHeight + "px";
        };
    };
}

/**
 * Get window by ID
 */
export function getWindow(id) {
    return WINDOWS.get(id);
}

/**
 * Get all windows
 */
export function getWindows() {
    return Array.from(WINDOWS.values());
}

/**
 * Close all windows
 */
export function closeAll() {
    for (const windowApi of WINDOWS.values()) {
        windowApi.close();
    }
}
