import { config } from "/angel/config.js";

const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

const state = {
    warnedNoApi: false,
    lastInfoLog: 0,
    nextProductId: 1,
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const settings = getSettings();

    while (true) {
        try {
            if (!hasCorporationApi(ns)) {
                if (!state.warnedNoApi) {
                    ns.print("[CORP] Corporation API unavailable. Idling.");
                    state.warnedNoApi = true;
                }
                await ns.sleep(settings.loopDelayMs);
                continue;
            }

            state.warnedNoApi = false;

            const corpReady = await ensureCorporationExists(ns, settings);
            if (!corpReady) {
                await ns.sleep(settings.loopDelayMs);
                continue;
            }

            await runCycle(ns, settings);
        } catch (error) {
            ns.print(`[CORP] cycle error: ${String(error)}`);
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

function hasCorporationApi(ns) {
    try {
        if (!ns.corporation || typeof ns.corporation.hasCorporation !== "function") {
            return false;
        }
        ns.corporation.hasCorporation();
        return true;
    } catch {
        return false;
    }
}

async function ensureCorporationExists(ns, settings) {
    if (ns.corporation.hasCorporation()) {
        return true;
    }

    if (!settings.autoCreate) {
        logInfoThrottled(ns, "[CORP] No corporation yet (autoCreate disabled)");
        return false;
    }

    if (settings.createWithSeedCapital) {
        const money = ns.getServerMoneyAvailable("home");
        if (money < settings.minFundsForCreation) {
            logInfoThrottled(
                ns,
                `[CORP] Waiting to create corp (${ns.formatNumber(money, 2)} / ${ns.formatNumber(settings.minFundsForCreation, 2)})`
            );
            return false;
        }
    }

    try {
        const created = ns.corporation.createCorporation(settings.corporationName, settings.createWithSeedCapital);
        if (created) {
            ns.print(`[CORP] Corporation created: ${settings.corporationName}`);
            return true;
        }
    } catch (error) {
        ns.print(`[CORP] Corporation create failed: ${String(error)}`);
    }

    return ns.corporation.hasCorporation();
}

async function runCycle(ns, settings) {
    const corp = ns.corporation.getCorporation();
    let budget = Math.max(0, corp.funds * settings.maxSpendRatioPerCycle);

    budget = await ensurePrimaryDivision(ns, settings, budget);
    budget = manageUpgrades(ns, settings, budget);

    if (settings.enableProducts) {
        budget = await ensureProductDivision(ns, settings, budget);
        budget = manageProducts(ns, settings, budget);
    }

    const funds = ns.corporation.getCorporation().funds;
    logInfoThrottled(ns, `[CORP] Funds ${ns.formatNumber(funds, 2)} | Cycle spend budget left ${ns.formatNumber(Math.max(0, budget), 2)}`);
}

async function ensurePrimaryDivision(ns, settings, budget) {
    budget = ensureDivision(ns, settings.primaryIndustry, settings.primaryDivision, budget, settings);
    if (!divisionExists(ns, settings.primaryDivision)) {
        return budget;
    }

    const cities = getTargetCities(settings);
    for (const city of cities) {
        budget = ensureDivisionCity(ns, settings.primaryDivision, city, budget, settings);
        budget = ensureWarehouse(ns, settings.primaryDivision, city, settings.minWarehouseLevelPrimary, budget, settings);
        budget = ensureOffice(ns, settings.primaryDivision, city, settings.minOfficeSizePrimary, budget, settings);
        setAgricultureSales(ns, settings.primaryDivision, city);
    }

    return budget;
}

async function ensureProductDivision(ns, settings, budget) {
    const funds = ns.corporation.getCorporation().funds;
    if (!divisionExists(ns, settings.productDivision) && funds < settings.productStartFunds) {
        return budget;
    }

    budget = ensureDivision(ns, settings.productIndustry, settings.productDivision, budget, settings);
    if (!divisionExists(ns, settings.productDivision)) {
        return budget;
    }

    const cities = getTargetCities(settings);
    for (const city of cities) {
        budget = ensureDivisionCity(ns, settings.productDivision, city, budget, settings);
        budget = ensureWarehouse(ns, settings.productDivision, city, settings.minWarehouseLevelProduct, budget, settings);
        budget = ensureOffice(ns, settings.productDivision, city, settings.minOfficeSizeProduct, budget, settings);
        setProductSales(ns, settings.productDivision, city);
    }

    return budget;
}

function ensureDivision(ns, industry, divisionName, budget, settings) {
    if (divisionExists(ns, divisionName)) {
        return budget;
    }

    const cost = safeNumber(() => ns.corporation.getExpandIndustryCost(industry), Number.POSITIVE_INFINITY);
    if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
        return budget;
    }

    try {
        ns.corporation.expandIndustry(industry, divisionName);
        ns.print(`[CORP] Expanded industry ${industry} -> ${divisionName}`);
        return budget - cost;
    } catch (error) {
        ns.print(`[CORP] expandIndustry failed for ${divisionName}: ${String(error)}`);
        return budget;
    }
}

function ensureDivisionCity(ns, divisionName, city, budget, settings) {
    if (!divisionExists(ns, divisionName)) {
        return budget;
    }

    const division = ns.corporation.getDivision(divisionName);
    if (division.cities.includes(city)) {
        return budget;
    }

    const cost = safeNumber(() => ns.corporation.getExpandCityCost(), Number.POSITIVE_INFINITY);
    if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
        return budget;
    }

    try {
        ns.corporation.expandCity(divisionName, city);
        ns.print(`[CORP] Expanded ${divisionName} to ${city}`);
        return budget - cost;
    } catch (error) {
        ns.print(`[CORP] expandCity failed (${divisionName}/${city}): ${String(error)}`);
        return budget;
    }
}

function ensureWarehouse(ns, divisionName, city, minLevel, budget, settings) {
    if (!cityReady(ns, divisionName, city)) {
        return budget;
    }

    if (!hasWarehouse(ns, divisionName, city)) {
        const purchaseCost = safeNumber(() => ns.corporation.getPurchaseWarehouseCost(), Number.POSITIVE_INFINITY);
        if (!canSpend(ns, purchaseCost, budget, settings.minimumCashBuffer)) {
            return budget;
        }

        try {
            ns.corporation.purchaseWarehouse(divisionName, city);
            ns.print(`[CORP] Purchased warehouse: ${divisionName}/${city}`);
            budget -= purchaseCost;
        } catch (error) {
            ns.print(`[CORP] purchaseWarehouse failed (${divisionName}/${city}): ${String(error)}`);
            return budget;
        }
    }

    if (!hasWarehouse(ns, divisionName, city)) {
        return budget;
    }

    const warehouse = ns.corporation.getWarehouse(divisionName, city);
    if (warehouse.level < minLevel) {
        const levelsNeeded = minLevel - warehouse.level;
        const upgradeCost = safeNumber(
            () => ns.corporation.getUpgradeWarehouseCost(divisionName, city, levelsNeeded),
            Number.POSITIVE_INFINITY
        );
        if (canSpend(ns, upgradeCost, budget, settings.minimumCashBuffer)) {
            try {
                ns.corporation.upgradeWarehouse(divisionName, city, levelsNeeded);
                budget -= upgradeCost;
            } catch {
                // Ignore transient failures and retry next cycle
            }
        }
    }

    try {
        if (ns.corporation.hasUnlockUpgrade("Smart Supply")) {
            ns.corporation.setSmartSupply(divisionName, city, true);
        }
    } catch {
        // Optional behavior
    }

    return budget;
}

function ensureOffice(ns, divisionName, city, minSize, budget, settings) {
    if (!cityReady(ns, divisionName, city)) {
        return budget;
    }

    const office = ns.corporation.getOffice(divisionName, city);
    if (office.size < minSize) {
        const upgradeBy = minSize - office.size;
        const cost = safeNumber(
            () => ns.corporation.getOfficeSizeUpgradeCost(divisionName, city, upgradeBy),
            Number.POSITIVE_INFINITY
        );
        if (canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
            try {
                ns.corporation.upgradeOfficeSize(divisionName, city, upgradeBy);
                budget -= cost;
            } catch {
                // Retry next cycle
            }
        }
    }

    const refreshedOffice = ns.corporation.getOffice(divisionName, city);
    while (refreshedOffice.numEmployees < refreshedOffice.size) {
        const hired = ns.corporation.hireEmployee(divisionName, city);
        if (!hired) break;
        refreshedOffice.numEmployees += 1;
    }

    applyOfficeAssignments(ns, divisionName, city, refreshedOffice.numEmployees);

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

    trySetJob(ns, divisionName, city, "Operations", ops);
    trySetJob(ns, divisionName, city, "Engineer", eng);
    trySetJob(ns, divisionName, city, "Business", bus);
    trySetJob(ns, divisionName, city, "Management", mgmt);
    trySetJob(ns, divisionName, city, "Research & Development", Math.max(0, employees - ops - eng - bus - mgmt));
}

function trySetJob(ns, divisionName, city, role, amount) {
    try {
        ns.corporation.setAutoJobAssignment(divisionName, city, role, Math.max(0, amount));
    } catch {
        // Ignore unsupported/unavailable assignment issues
    }
}

function setAgricultureSales(ns, divisionName, city) {
    if (!hasWarehouse(ns, divisionName, city)) {
        return;
    }
    try {
        ns.corporation.sellMaterial(divisionName, city, "Food", "MAX", "MP");
        ns.corporation.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
    } catch {
        // Not all materials apply to all divisions/cities in all states
    }
}

function setProductSales(ns, divisionName, city) {
    if (!hasWarehouse(ns, divisionName, city)) {
        return;
    }
    const division = ns.corporation.getDivision(divisionName);
    for (const product of division.products) {
        try {
            ns.corporation.sellProduct(divisionName, city, product, "MAX", "MP", true);
        } catch {
            // Ignore unavailable product states
        }
    }
}

function manageProducts(ns, settings, budget) {
    if (!divisionExists(ns, settings.productDivision)) {
        return budget;
    }

    const division = ns.corporation.getDivision(settings.productDivision);
    if (!division.makesProducts) {
        return budget;
    }

    const city = division.cities.includes(settings.productCity)
        ? settings.productCity
        : (division.cities[0] || settings.productCity);

    const products = [...division.products];
    let developingCount = 0;
    for (const product of products) {
        const info = safeGetProduct(ns, settings.productDivision, city, product);
        if (info && Number(info.developmentProgress) < 100) {
            developingCount += 1;
        }
    }

    while (products.length > settings.maxProductsToKeep) {
        const toDrop = products.shift();
        if (!toDrop) break;
        try {
            ns.corporation.discontinueProduct(settings.productDivision, toDrop);
            ns.print(`[CORP] Discontinued product: ${toDrop}`);
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
        ns.corporation.makeProduct(
            settings.productDivision,
            city,
            productName,
            settings.productDesignInvestment,
            settings.productMarketingInvestment
        );
        ns.print(`[CORP] Started product: ${productName}`);
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
        let currentLevel = safeNumber(() => ns.corporation.getUpgradeLevel(upgrade), 0);
        const target = Math.max(0, Number(targetLevel) || 0);

        while (currentLevel < target) {
            const cost = safeNumber(() => ns.corporation.getUpgradeLevelCost(upgrade), Number.POSITIVE_INFINITY);
            if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
                break;
            }

            try {
                ns.corporation.levelUpgrade(upgrade);
                budget -= cost;
                currentLevel += 1;
            } catch {
                break;
            }
        }
    }

    return budget;
}

function maybeUnlockSmartSupply(ns, settings, budget) {
    try {
        if (ns.corporation.hasUnlockUpgrade("Smart Supply")) {
            return budget;
        }
        const cost = ns.corporation.getUnlockUpgradeCost("Smart Supply");
        if (!canSpend(ns, cost, budget, settings.minimumCashBuffer)) {
            return budget;
        }
        ns.corporation.unlockUpgrade("Smart Supply");
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
        const corp = ns.corporation.getCorporation();
        return corp.divisions.includes(divisionName);
    } catch {
        return false;
    }
}

function cityReady(ns, divisionName, city) {
    if (!divisionExists(ns, divisionName)) {
        return false;
    }
    try {
        return ns.corporation.getDivision(divisionName).cities.includes(city);
    } catch {
        return false;
    }
}

function hasWarehouse(ns, divisionName, city) {
    try {
        return ns.corporation.hasWarehouse(divisionName, city);
    } catch {
        return false;
    }
}

function canSpend(ns, cost, budget, minimumCashBuffer) {
    if (!Number.isFinite(cost) || cost <= 0) {
        return false;
    }
    if (budget < cost) {
        return false;
    }
    const funds = safeNumber(() => ns.corporation.getCorporation().funds, 0);
    return funds - cost >= minimumCashBuffer;
}

function safeNumber(fn, fallback) {
    try {
        const value = Number(fn());
        return Number.isFinite(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

function safeGetProduct(ns, divisionName, city, productName) {
    try {
        return ns.corporation.getProduct(divisionName, city, productName);
    } catch {
        return null;
    }
}

function logInfoThrottled(ns, message) {
    const now = Date.now();
    if (now - state.lastInfoLog < 15000) {
        return;
    }
    state.lastInfoLog = now;
    ns.print(message);
}
