import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";

export async function doCompanyWork(ns, ui) {
    const money = ns.getServerMoneyAvailable("home");
    const threshold = config.company?.onlyWhenMoneyBelow || 200000000;

    if (money >= threshold) {
        return false;
    }

    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "COMPANY") {
        return true;
    }

    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training?.city || "Chongqing");
        } catch (e) {
            // Travel failed, continue anyway.
        }
    }

    const companies = ["ECorp", "MegaCorp", "Bachman & Associates", "Blade Industries", "NWO"];
    let placed = false;
    let selectedCompany = null;

    for (const company of companies) {
        try {
            const success = ns.singularity.workForCompany(company, config.company?.focus || false);
            if (success) {
                placed = true;
                selectedCompany = company;
                break;
            }
        } catch (e) {
            // Job not available, try next.
        }
    }

    if (placed && ui) {
        ui.log(`Working for ${selectedCompany} | ${formatMoney(money)}/${formatMoney(threshold)}`, "info");
    }

    return placed;
}

export function shouldDoCompanyWork(ns) {
    const money = ns.getServerMoneyAvailable("home");
    const threshold = config.company?.onlyWhenMoneyBelow || 200000000;
    return money < threshold;
}
