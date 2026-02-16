/**
 * Capture current ANGEL DOM window layout and persist it.
 *
 * Usage:
 *   run /angel/windowLayoutSnapshot.js
 *
 * Output files:
 *   - angel_windowdefaults.json  (baseline defaults)
 *   - angel_windowstates.json    (current state override)
 */

const DEFAULTS_KEY = "angelWindowDefaults";
const STATES_KEY = "angelWindowStates";
const DEFAULTS_FILE = "angel_windowdefaults.json";
const STATES_FILE = "angel_windowstates.json";

export async function main(ns) {
    ns.disableLog("ALL");

    let doc;
    try {
        doc = eval("document");
    } catch (e) {
        ns.tprint("❌ DOM is not available in this context.");
        return;
    }

    const windows = Array.from(doc.querySelectorAll(".angel-window[id^='angel-window-']"));
    if (windows.length === 0) {
        ns.tprint("⚠️ No ANGEL windows found. Open your windows first, then rerun.");
        return;
    }

    const layout = {};

    for (const el of windows) {
        const id = el.id.replace(/^angel-window-/, "");
        if (!id) continue;

        const width = Math.max(280, Math.round(el.offsetWidth || parseFloat(el.style.width) || 0));
        const height = Math.max(78, Math.round(el.offsetHeight || parseFloat(el.style.height) || 0));
        const left = Math.round(el.offsetLeft || parseFloat(el.style.left) || 0);
        const top = Math.round(el.offsetTop || parseFloat(el.style.top) || 0);

        const content = el.querySelector(".angel-window-content");
        const minimized = Boolean(content && content.style.display === "none");

        layout[id] = {
            left,
            top,
            width,
            height,
            minimized,
        };
    }

    try {
        localStorage.setItem(DEFAULTS_KEY, JSON.stringify(layout));
        localStorage.setItem(STATES_KEY, JSON.stringify(layout));
    } catch (e) {
        // localStorage may be unavailable in some contexts
    }

    try {
        ns.write(DEFAULTS_FILE, JSON.stringify(layout, null, 2), "w");
        ns.write(STATES_FILE, JSON.stringify(layout, null, 2), "w");
    } catch (e) {
        ns.tprint(`⚠️ Failed to write layout files: ${e}`);
    }

    const ids = Object.keys(layout).sort();
    ns.tprint(`✅ Captured ${ids.length} windows.`);
    ns.tprint(`✅ Wrote ${DEFAULTS_FILE} and ${STATES_FILE}`);
    ns.tprint(`📌 Windows: ${ids.join(", ")}`);
}
