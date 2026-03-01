import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";

const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

const state = {
    warnedNoApi: false,
    lastStatusLogTs: 0,
    nextProductId: 1,
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("corporation", "🏢 Corporation", 640, 380, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("🏢 Corporation automation initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    const settings = getSettings();

    while (true) {
        try {
            if (!hasCorporationApi(ns)) {
                if (!state.warnedNoApi) {
                    ui.log("Corporation API unavailable. Idling.", "warn");
                    state.warnedNoApi = true;
                }
                await ns.sleep(settings.loopDelayMs);
                continue;
            }

            state.warnedNoApi = false;

            const corpReady = ensureCorporationExists(ns, settings, ui);
            if (!corpReady) {
                await ns.sleep(settings.loopDelayMs);
                continue;
            }

            runCycle(ns, settings, ui);
        } catch (error) {
            ui.log(`Cycle error: ${String(error)}`, "error");
        }

        await ns.sleep(settings.loopDelayMs);
    }
}

function getSettings() {
    return {
        ...(config.corporation || {}),
        loopDelayMs: Number(config.corporation?.loopDelayMs ?? 5000),
        maxSpendRatioPerCycle: Number(config.corporation?.maxSpendRatioPerCycle ?? 0.12),
        minimumCashBuffer: Number(config.corporation?.minimumCashBuffer ?? 5e9),
        autoCreate: Boolean(config.corporation?.autoCreate ?? false),
        corporationName: String(config.corporation?.corporationName ?? "AngelCorp"),
        createWithSeedCapital: Boolean(config.corporation?.createWithSeedCapital ?? true),
        minFundsForCreation: Number(config.corporation?.minFundsForCreation ?? 150e9),
        primaryIndustry: String(config.corporation?.primaryIndustry ?? "Agriculture"),
        primaryDivision: String(config.corporation?.primaryDivision ?? "Agri"),
        productIndustry: String(config.corporation?.productIndustry ?? "Tobacco"),
        productDivision: String(config.corporation?.productDivision ?? "Cigs"),
        productCity: String(config.corporation?.productCity ?? "Aevum"),
        productPrefix: String(config.corporation?.productPrefix ?? "AngelProduct"),
        expandToAllCities: Boolean(config.corporation?.expandToAllCities ?? true),
        minOfficeSizePrimary: Number(config.corporation?.minOfficeSizePrimary ?? 3),
        minOfficeSizeProduct: Number(config.corporation?.minOfficeSizeProduct ?? 6),
        minWarehouseLevelPrimary: Number(config.corporation?.minWarehouseLevelPrimary ?? 2),
        minWarehouseLevelProduct: Number(config.corporation?.minWarehouseLevelProduct ?? 3),
        enableProducts: Boolean(config.corporation?.enableProducts ?? true),
        productStartFunds: Number(config.corporation?.productStartFunds ?? 300e9),
        productDesignInvestment: Number(config.corporation?.productDesignInvestment ?? 1e9),
        productMarketingInvestment: Number(config.corporation?.productMarketingInvestment ?? 1e9),
        maxProductsToKeep: Number(config.corporation?.maxProductsToKeep ?? 3),
        upgrades: config.corporation?.upgrades || {
            "Smart Factories": 5,
            "Smart Storage": 5,
            "Wilson Analytics": 3,
        },
    };
}

function corpApi(ns) {
    try {
        return (0, eval)("ns.corporation");
    } catch {
        return null;
    }
}

function corpCall(ns, method, ...args) {
    const corp = corpApi(ns);
    if (!corp || typeof corp[method] !== "function") {
        throw new Error(`Corporation method unavailable: ${method}`);
    }
    return corp[method](...args);
}

function hasCorporationApi(ns) {
    try {
        corpCall(ns, "hasCorporation");
        return true;
    } catch {
        return false;
    }
}

function ensureCorporationExists(ns, settings, ui) {
    if (safeBool(() => corpCall(ns, "hasCorporation"), false)) {
        return true;
    }

    if (!settings.autoCreate) {
        logThrottled(ui, "No corporation yet (autoCreate disabled)", "warn", 15000);
        return false;
    }

    if (settings.createWithSeedCapital) {
        const money = ns.getServerMoneyAvailable("home");
        if (money < settings.minFundsForCreation) {
            logThrottled(
                ui,
                `Waiting for corp creation funds: ${ns.formatNumber(money, 2)} / ${ns.formatNumber(settings.minFundsForCreation, 2)}`,
                "info",
                15000
            );
            return false;
        }
    }

    try {
        const created = corpCall(ns, "createCorporation", settings.corporationName, settings.createWithSeedCapital);
        if (created) {
            ui.log(`Corporation created: ${settings.corporationName}`, "success");
            return true;
        }
    } catch (error) {
        ui.log(`Corporation create failed: ${String(error)}`, "error");
    }

    return safeBool(() => corpCall(ns, "hasCorporation"), false);
}

function runCycle(ns, settings, ui) {
    const corp = safeValue(() => corpCall(ns, "getCorporation"), null);
    if (!corp) {
        return;
    }

    let budget = Math.max(0, Number(corp.funds) * settings.maxSpendRatioPerCycle);

    budget = ensurePrimaryDivision(ns, settings, budget, ui);
    budget = manageUpgrades(ns, settings, budget);

    if (settings.enableProducts) {
        budget = ensureProductDivision(ns, settings, budget, ui);
        budget = manageProducts(ns, settings, budget, ui);
    }

    const now = Date.now();
    if (now - state.lastStatusLogTs >= 15000) {
        state.lastStatusLogTs = now;
        const funds = safeNumber(() => corpCall(ns, "getCorporation").funds, 0);
        ui.log(`Funds ${ns.formatNumber(funds, 2)} | Budget left ${ns.formatNumber(Math.max(0, budget), 2)}`, "info");
    }
}

function ensurePrimaryDivision(ns, settings, budget, ui) {
    budget = ensureDivision(ns, settings.primaryIndustry, settings.primaryDivision, budget, settings, ui);
    if (!divisionExists(ns, settings.primaryDivision)) {
        return budget;
    }

    const cities = getTargetCities(settings);
    for (const city of cities) {
        budget = ensureDivisionCity(ns, settings.primaryDivision, city, budget, settings, ui);
        budget = ensureWarehouse(ns, settings.primaryDivision, city, settings.minWarehouseLevelPrimary, budget, settings, ui);
        budget = ensureOffice(ns, settings.primaryDivision, city, settings.minOfficeSizePrimary, budget, settings);
        setAgricultureSales(ns, settings.primaryDivision, city);
    }

    return budget;
}

function ensureProductDivision(ns, settings, budget, ui) {
    const funds = safeNumber(() => corpCall(ns, "getCorporation").funds, 0);
    if (!divisionExists(ns, settings.productDivision) && funds < settings.productStartFunds) {
        return budget;
    }

    budget = ensureDivision(ns, settings.productIndustry, settings.productDivision, budget, settings, ui);
    if (!divisionExists(ns, settings.productDivision)) {
        return budget;
    }

    const cities = getTargetCities(settings);
    for (const city of cities) {
        budget = ensureDivisionCity(ns, settings.productDivision, city, budget, settings, ui);
        budget = ensureWarehouse(ns, settings.productDivision, city, settings.minWarehouseLevelProduct, budget, settings, ui);
        budget = ensureOffice(ns, settings.productDivision, city, settings.minOfficeSizeProduct, budget, settings);
        setProductSales(ns, settings.productDivision, city);
    }

    return budget;
}

function ensureDivision(ns, industry, divisionName, budget, settings, ui) {
    if (divisionExists(ns, divisionName)) {
        return budget;
    }

    const cost = safeNumber(() => corpCall(ns, "getExpandIndustryCost", industry), Number.POSITIVE_INFINITY);
    if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
        return budget;
    }

    try {
        corpCall(ns, "expandIndustry", industry, divisionName);
        ui.log(`Expanded industry ${industry} -> ${divisionName}`, "success");
        return budget - cost;
    } catch (error) {
        ui.log(`expandIndustry failed (${divisionName}): ${String(error)}`, "error");
        return budget;
    }
}

function ensureDivisionCity(ns, divisionName, city, budget, settings, ui) {
    if (!divisionExists(ns, divisionName)) {
        return budget;
    }

    const division = safeValue(() => corpCall(ns, "getDivision", divisionName), null);
    if (!division || division.cities.includes(city)) {
        return budget;
    }

    const cost = safeNumber(() => corpCall(ns, "getExpandCityCost"), Number.POSITIVE_INFINITY);
    if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
        return budget;
    }

    try {
        corpCall(ns, "expandCity", divisionName, city);
        ui.log(`Expanded ${divisionName} to ${city}`, "success");
        return budget - cost;
    } catch (error) {
        ui.log(`expandCity failed (${divisionName}/${city}): ${String(error)}`, "error");
        return budget;
    }
}

function ensureWarehouse(ns, divisionName, city, minLevel, budget, settings, ui) {
    if (!cityReady(ns, divisionName, city)) {
        return budget;
    }

    if (!hasWarehouse(ns, divisionName, city)) {
        const purchaseCost = safeNumber(() => corpCall(ns, "getPurchaseWarehouseCost"), Number.POSITIVE_INFINITY);
        if (!canSpend(ns, purchaseCost, budget, settings.minimumCashBuffer)) {
            return budget;
        }

        try {
            corpCall(ns, "purchaseWarehouse", divisionName, city);
            ui.log(`Purchased warehouse: ${divisionName}/${city}`, "info");
            budget -= purchaseCost;
        } catch (error) {
            ui.log(`purchaseWarehouse failed (${divisionName}/${city}): ${String(error)}`, "error");
            return budget;
        }
    }

    if (!hasWarehouse(ns, divisionName, city)) {
        return budget;
    }

    const warehouse = safeValue(() => corpCall(ns, "getWarehouse", divisionName, city), null);
    if (warehouse && warehouse.level < minLevel) {
        const levelsNeeded = minLevel - warehouse.level;
        const upgradeCost = safeNumber(
            () => corpCall(ns, "getUpgradeWarehouseCost", divisionName, city, levelsNeeded),
            Number.POSITIVE_INFINITY
        );
        if (canSpend(ns, upgradeCost, budget, settings.minimumCashBuffer)) {
            try {
                corpCall(ns, "upgradeWarehouse", divisionName, city, levelsNeeded);
                budget -= upgradeCost;
            } catch {
                // retry next cycle
            }
        }
    }

    try {
        if (safeBool(() => corpCall(ns, "hasUnlockUpgrade", "Smart Supply"), false)) {
            corpCall(ns, "setSmartSupply", divisionName, city, true);
        }
    } catch {
        // optional behavior
    }

    return budget;
}

function ensureOffice(ns, divisionName, city, minSize, budget, settings) {
    if (!cityReady(ns, divisionName, city)) {
        return budget;
    }

    const office = safeValue(() => corpCall(ns, "getOffice", divisionName, city), null);
    if (!office) {
        return budget;
    }

    if (office.size < minSize) {
        const growBy = minSize - office.size;
        const cost = safeNumber(
            () => corpCall(ns, "getOfficeSizeUpgradeCost", divisionName, city, growBy),
            Number.POSITIVE_INFINITY
        );
        if (canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
            try {
                corpCall(ns, "upgradeOfficeSize", divisionName, city, growBy);
                budget -= cost;
            } catch {
                // retry next cycle
            }
        }
    }

    let refreshed = safeValue(() => corpCall(ns, "getOffice", divisionName, city), null);
    if (!refreshed) {
        return budget;
    }

    while (refreshed.numEmployees < refreshed.size) {
        const hired = safeBool(() => corpCall(ns, "hireEmployee", divisionName, city), false);
        if (!hired) {
            break;
        }
        refreshed = safeValue(() => corpCall(ns, "getOffice", divisionName, city), refreshed);
    }

    applyOfficeAssignments(ns, divisionName, city, refreshed.numEmployees);

    return budget;
}

function applyOfficeAssignments(ns, divisionName, city, employees) {
    if (employees <= 0) {
        return;
    }

    const ops = Math.max(1, Math.floor(employees * 0.35));
    const eng = Math.max(1, Math.floor(employees * 0.3));
    const bus = Math.max(1, Math.floor(employees * 0.2));
    const mgmt = Math.max(0, employees - ops - eng - bus);

    setJob(ns, divisionName, city, "Operations", ops);
    setJob(ns, divisionName, city, "Engineer", eng);
    setJob(ns, divisionName, city, "Business", bus);
    setJob(ns, divisionName, city, "Management", mgmt);

    const assigned = ops + eng + bus + mgmt;
    setJob(ns, divisionName, city, "Research & Development", Math.max(0, employees - assigned));
}

function setJob(ns, divisionName, city, role, amount) {
    try {
        corpCall(ns, "setAutoJobAssignment", divisionName, city, role, Math.max(0, amount));
    } catch {
        // ignore role/availability issues
    }
}

function setAgricultureSales(ns, divisionName, city) {
    if (!hasWarehouse(ns, divisionName, city)) {
        return;
    }
    try {
        corpCall(ns, "sellMaterial", divisionName, city, "Food", "MAX", "MP");
        corpCall(ns, "sellMaterial", divisionName, city, "Plants", "MAX", "MP");
    } catch {
        // ignore unavailable states
    }
}

function setProductSales(ns, divisionName, city) {
    if (!hasWarehouse(ns, divisionName, city)) {
        return;
    }
    const division = safeValue(() => corpCall(ns, "getDivision", divisionName), null);
    if (!division) {
        return;
    }

    for (const product of division.products) {
        try {
            corpCall(ns, "sellProduct", divisionName, city, product, "MAX", "MP", true);
        } catch {
            // ignore unavailable product states
        }
    }
}

function manageProducts(ns, settings, budget, ui) {
    if (!divisionExists(ns, settings.productDivision)) {
        return budget;
    }

    const division = safeValue(() => corpCall(ns, "getDivision", settings.productDivision), null);
    if (!division || !division.makesProducts) {
        return budget;
    }

    const city = division.cities.includes(settings.productCity)
        ? settings.productCity
        : (division.cities[0] || settings.productCity);

    const products = [...division.products];
    let developingCount = 0;

    for (const product of products) {
        const info = safeValue(() => corpCall(ns, "getProduct", settings.productDivision, city, product), null);
        if (info && Number(info.developmentProgress) < 100) {
            developingCount += 1;
        }
    }

    while (products.length > settings.maxProductsToKeep) {
        const toDrop = products.shift();
        if (!toDrop) {
            break;
        }
        try {
            corpCall(ns, "discontinueProduct", settings.productDivision, toDrop);
            ui.log(`Discontinued product: ${toDrop}`, "warn");
        } catch {
            break;
        }
    }

    if (developingCount > 0) {
        return budget;
    }

    const investCost = settings.productDesignInvestment + settings.productMarketingInvestment;
    if (!canSpend(ns, investCost, budget, settings.minimumCashBuffer)) {
        return budget;
    }

    const productName = `${settings.productPrefix}-${state.nextProductId}`;
    state.nextProductId += 1;

    try {
        corpCall(
            ns,
            "makeProduct",
            settings.productDivision,
            city,
            productName,
            settings.productDesignInvestment,
            settings.productMarketingInvestment
        );
        ui.log(`Started product: ${productName}`, "success");
        return budget - investCost;
    } catch {
        return budget;
    }
}

function manageUpgrades(ns, settings, budget) {
    if (!settings.upgrades || typeof settings.upgrades !== "object") {
        return budget;
    }

    budget = maybeUnlockSmartSupply(ns, settings, budget);

    for (const [upgrade, targetLevel] of Object.entries(settings.upgrades)) {
        let current = safeNumber(() => corpCall(ns, "getUpgradeLevel", upgrade), 0);
        const target = Math.max(0, Number(targetLevel) || 0);

        while (current < target) {
            const cost = safeNumber(() => corpCall(ns, "getUpgradeLevelCost", upgrade), Number.POSITIVE_INFINITY);
            if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
                break;
            }

            try {
                corpCall(ns, "levelUpgrade", upgrade);
                budget -= cost;
                current += 1;
            } catch {
                break;
            }
        }
    }

    return budget;
}

function maybeUnlockSmartSupply(ns, settings, budget) {
    try {
        if (safeBool(() => corpCall(ns, "hasUnlockUpgrade", "Smart Supply"), false)) {
            return budget;
        }
        const cost = safeNumber(() => corpCall(ns, "getUnlockUpgradeCost", "Smart Supply"), Number.POSITIVE_INFINITY);
        if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
            return budget;
        }
        corpCall(ns, "unlockUpgrade", "Smart Supply");
        return budget - cost;
    } catch {
        return budget;
    }
}

function getTargetCities(settings) {
    return settings.expandToAllCities ? CITIES : [settings.productCity || "Aevum"];
}

function divisionExists(ns, divisionName) {
    try {
        const corp = corpCall(ns, "getCorporation");
        return Array.isArray(corp.divisions) && corp.divisions.includes(divisionName);
    } catch {
        return false;
    }
}

function cityReady(ns, divisionName, city) {
    if (!divisionExists(ns, divisionName)) {
        return false;
    }
    const division = safeValue(() => corpCall(ns, "getDivision", divisionName), null);
    return Boolean(division && Array.isArray(division.cities) && division.cities.includes(city));
}

function hasWarehouse(ns, divisionName, city) {
    return safeBool(() => corpCall(ns, "hasWarehouse", divisionName, city), false);
}

function canSpend(ns, cost, budget, minimumCashBuffer) {
    if (!Number.isFinite(cost) || cost <= 0) {
        return false;
    }
    if (budget < cost) {
        return false;
    }
    const funds = safeNumber(() => corpCall(ns, "getCorporation").funds, 0);
    return funds - cost >= minimumCashBuffer;
}

function safeValue(fn, fallback) {
    try {
        const value = fn();
        return value === undefined ? fallback : value;
    } catch {
        return fallback;
    }
}

function safeNumber(fn, fallback) {
    try {
        const value = Number(fn());
        return Number.isFinite(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

function safeBool(fn, fallback) {
    try {
        return Boolean(fn());
    } catch {
        return fallback;
    }
}

function logThrottled(ui, message, level = "info", intervalMs = 15000) {
    const now = Date.now();
    if (now - state.lastStatusLogTs < intervalMs) {
        return;
    }
    state.lastStatusLogTs = now;
    ui.log(message, level);
}
