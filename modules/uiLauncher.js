import { createWindow, setWindowVisibility, getWindowVisibility } from "/angel/modules/uiManager.js";

const WINDOW_OPTIONS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "activities", label: "Activities" },
    { id: "augments", label: "Augments" },
    { id: "programs", label: "Programs" },
    { id: "servers", label: "Servers" },
    { id: "hacking", label: "Hacking" },
    { id: "hacknet", label: "Hacknet" },
    { id: "gang", label: "Gang" },
    { id: "stocks", label: "Stocks" },
    { id: "corporation", label: "Corporation" },
    { id: "sleeves", label: "Sleeves" },
    { id: "bladeburner", label: "Bladeburner" },
    { id: "contracts", label: "Contracts" },
    { id: "loot", label: "Loot" },
    { id: "formulas", label: "Formulas" },
    { id: "netmap", label: "Network Map" },
    { id: "xpfarm", label: "XP Farm" },
    { id: "backdoor", label: "Backdoor" },
];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("ui-launcher", "🧭 UI Launcher", 520, 540, ns);
    let handlersBound = false;

    while (true) {
        try {
            render(ui);
            if (!handlersBound && !ui.isMock && ui.contentEl) {
                bindHandlers(ui);
                handlersBound = true;
            }
        } catch (e) {
            ui.log(`Error: ${e}`, "error");
        }

        await ns.sleep(2000);
    }
}

function render(ui) {
    if (ui.isMock) {
        ui.clear();
        ui.log("UI launcher requires DOM windows", "warn");
        return;
    }

    const rows = WINDOW_OPTIONS.map(w => {
        const visible = getWindowVisibility(w.id);
        const stateLabel = visible ? "Visible" : "Hidden";
        const stateColor = visible ? "#2ecc71" : "#95a5a6";
        const actionLabel = visible ? "Hide" : "Show";
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid #333;">
                <div>
                    <div style="font-weight:600;">${w.label}</div>
                    <div style="font-size:11px;color:${stateColor};">${stateLabel}</div>
                </div>
                <button data-action="toggle" data-id="${w.id}" style="background:#34495e;color:#ecf0f1;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;">${actionLabel}</button>
            </div>
        `;
    }).join("");

    ui.update(`
        <div style="display:flex;gap:8px;margin-bottom:10px;">
            <button data-action="show-all" style="background:#2d6a4f;color:#ecf0f1;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;">Show All</button>
            <button data-action="hide-all" style="background:#6c757d;color:#ecf0f1;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;">Hide All</button>
        </div>
        <div style="font-size:11px;color:#b0b0b0;margin-bottom:10px;">Toggle module windows without restarting scripts. Hidden windows keep running.</div>
        <div style="border:1px solid #333;border-radius:6px;overflow:hidden;">${rows}</div>
    `);
}

function bindHandlers(ui) {
    ui.contentEl.addEventListener("click", (event) => {
        const rawTarget = event.target;
        if (!rawTarget) return;

        const target = typeof rawTarget.closest === "function"
            ? rawTarget.closest("[data-action]")
            : rawTarget;
        if (!target || typeof target.getAttribute !== "function") return;

        const action = target.getAttribute("data-action");
        if (!action) return;

        if (action === "show-all") {
            for (const w of WINDOW_OPTIONS) {
                setWindowVisibility(w.id, true);
            }
            render(ui);
            return;
        }

        if (action === "hide-all") {
            for (const w of WINDOW_OPTIONS) {
                if (w.id === "dashboard" || w.id === "ui-launcher") continue;
                setWindowVisibility(w.id, false);
            }
            render(ui);
            return;
        }

        if (action === "toggle") {
            const id = target.getAttribute("data-id");
            if (!id) return;
            setWindowVisibility(id, !getWindowVisibility(id));
            render(ui);
        }
    });
}
