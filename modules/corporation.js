import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";

const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];
const RESEARCH_QUEUE = [
    "Smart Factories", "Smart Storage", "Wilson Analytics", "Overclock",
    "Self-Correcting Assemblers", "Efficient Offices", "Advertising",
    "Automatic Drug Synthesis", "Bulk Purchasing"
];

const state = {
    warnedNoApi: false,
    lastStatusLogTs: 0,
    lastRenderTs: 0,
    nextProductId: 1,
    lastRevenue: 0,
    lastRevenueTime: 0,
    cycleStarted: false,
    cycleCounter: 0,
    expansionMilestoneLogged: false,
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("corporation", "🏢 Corporation", 800, 450, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("🏢 Corporation automation (premium edition)", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    const settings = getSettings();
    let apiCheckAttempts = 0;

    // Log startup settings once
    ui.log(`Settings:`, "info");
    ui.log(`  Primary: ${settings.primaryIndustry}/${settings.primaryDivision} in ${settings.primaryCity}`, "info");
    ui.log(`  Multi-city: ${settings.expandToAllCities ? "enabled" : "disabled (focus single city first)"}`, "info");
    ui.log(`  Products: ${settings.enableProducts ? "enabled" : "disabled"} | Budget/cycle: 20%`, "info");

    while (true) {
        try {
            if (!hasCorporationApi(ns)) {
                if (!state.warnedNoApi) {
                    apiCheckAttempts++;
                    if (apiCheckAttempts === 1) {
                        ui.log("⚠️  Corporation API not available.", "warn");
                        ui.log("Ensure: Corp API unlocked in Bitburner settings", "warn");
                        ui.log("Retrying in 10s intervals...", "info");
                    }
                    state.warnedNoApi = true;
                }
                await ns.sleep(settings.loopDelayMs);
                continue;
            }

            state.warnedNoApi = false;
            if (apiCheckAttempts > 0) {
                ui.log(`✅ Corporation API available (after ${apiCheckAttempts} attempts)`, "success");
                apiCheckAttempts = 0;
            }

            const corpReady = ensureCorporationExists(ns, settings, ui);
            if (!corpReady) {
                await ns.sleep(settings.loopDelayMs);
                continue;
            }

            if (!state.cycleStarted) {
                state.cycleStarted = true;
                ui.log(`🔄 Starting cycle loop (primary: ${settings.primaryIndustry}/${settings.primaryDivision})`, "success");
            }

            runCycle(ns, settings, ui);
            renderUI(ns, ui, settings);
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
        maxSpendRatioPerCycle: Number(config.corporation?.maxSpendRatioPerCycle ?? 0.2),
        minimumCashBuffer: Number(config.corporation?.minimumCashBuffer ?? 10e9),
        autoCreate: Boolean(config.corporation?.autoCreate ?? false),
        corporationName: String(config.corporation?.corporationName ?? "AngelCorp"),
        createWithSeedCapital: Boolean(config.corporation?.createWithSeedCapital ?? true),
        minFundsForCreation: Number(config.corporation?.minFundsForCreation ?? 150e9),
        primaryIndustry: String(config.corporation?.primaryIndustry ?? "Agriculture"),
        primaryDivision: String(config.corporation?.primaryDivision ?? "Agri"),
        productIndustry: String(config.corporation?.productIndustry ?? "Tobacco"),
        productDivision: String(config.corporation?.productDivision ?? "Cigs"),
        secondaryProductDivision: String(config.corporation?.secondaryProductDivision ?? "Soft"),
        secondaryProductIndustry: String(config.corporation?.secondaryProductIndustry ?? "Software"),
        primaryCity: String(config.corporation?.primaryCity ?? "Sector-12"),
        productCity: String(config.corporation?.productCity ?? "Aevum"),
        productPrefix: String(config.corporation?.productPrefix ?? "AngelProduct"),
        expandToAllCities: Boolean(config.corporation?.expandToAllCities ?? false),
        multiCityExpansionMinFunds: Number(config.corporation?.multiCityExpansionMinFunds ?? 500e9),
        multiCityExpansionMinRevenue: Number(config.corporation?.multiCityExpansionMinRevenue ?? 5e9),
        multiCityExpansionMinEmployees: Number(config.corporation?.multiCityExpansionMinEmployees ?? 30),
        minOfficeSizePrimary: Number(config.corporation?.minOfficeSizePrimary ?? 30),
        minOfficeSizeProduct: Number(config.corporation?.minOfficeSizeProduct ?? 30),
        minWarehouseLevelPrimary: Number(config.corporation?.minWarehouseLevelPrimary ?? 10),
        minWarehouseLevelProduct: Number(config.corporation?.minWarehouseLevelProduct ?? 10),
        enableProducts: Boolean(config.corporation?.enableProducts ?? true),
        enableSecondaryProduct: Boolean(config.corporation?.enableSecondaryProduct ?? false),
        productStartFunds: Number(config.corporation?.productStartFunds ?? 300e9),
        productDesignInvestment: Number(config.corporation?.productDesignInvestment ?? 2e9),
        productMarketingInvestment: Number(config.corporation?.productMarketingInvestment ?? 2e9),
        maxProductsToKeep: Number(config.corporation?.maxProductsToKeep ?? 5),
        productMinRating: Number(config.corporation?.productMinRating ?? 10),
        productMinProfitability: Number(config.corporation?.productMinProfitability ?? 0.15),
        upgrades: config.corporation?.upgrades || {"Smart Factories": 10, "Smart Storage": 10, "Wilson Analytics": 5},
    };
}

function corpApi(ns) {
    try {
        return (0, eval)("ns.corporation");
    } catch (e) {
        // Try alternative: direct ns.corporation access
        try {
            return ns.corporation;
        } catch {
            return null;
        }
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
        ui.log("Cannot get corporation data", "error");
        return;
    }

    // Check if we should auto-enable multi-city expansion
    if (!settings.expandToAllCities && shouldExpandToAllCities(ns, settings, ui)) {
        settings.expandToAllCities = true;
        ui.log(`🌍 Milestones reached - enabling multi-city expansion!`, "success");
    }

    let budget = Math.max(0, Number(corp.funds) * settings.maxSpendRatioPerCycle);
    const startBudget = budget;

    budget = ensurePrimaryDivision(ns, settings, budget, ui);
    const afterPrimary = budget;

    budget = manageUpgrades(ns, settings, budget);
    const afterUpgrades = budget;

    if (settings.enableProducts) {
        budget = ensureProductDivision(ns, settings, budget, ui);
        budget = manageProducts(ns, settings, budget, ui);
    }

    if (settings.enableSecondaryProduct) {
        budget = ensureSecondaryProductDivision(ns, settings, budget, ui);
        budget = manageSecondaryProducts(ns, settings, budget, ui);
    }

    // Log cycle summary every 10 cycles
    if (!state.cycleCounter) state.cycleCounter = 0;
    state.cycleCounter = (state.cycleCounter + 1) % 10;
    if (state.cycleCounter === 0 && corp.divisions.length > 0) {
        ui.log(`Budget: ${ns.formatNumber(startBudget, 2)} → ${ns.formatNumber(budget, 2)} (spent: ${ns.formatNumber(startBudget - budget, 2)})`, "info");
    }
}

function ensurePrimaryDivision(ns, settings, budget, ui) {
    // First attempt to create primary division if it doesn't exist
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

function ensureSecondaryProductDivision(ns, settings, budget, ui) {
    const funds = safeNumber(() => corpCall(ns, "getCorporation").funds, 0);
    const primaryStable = isDivisionStable(ns, settings.productDivision);

    if (!primaryStable || funds < settings.productStartFunds * 2) {
        return budget;
    }

    if (!divisionExists(ns, settings.secondaryProductDivision)) {
        budget = ensureDivision(ns, settings.secondaryProductIndustry, settings.secondaryProductDivision, budget, settings, ui);
    }

    if (!divisionExists(ns, settings.secondaryProductDivision)) {
        return budget;
    }

    const cities = getTargetCities(settings);
    for (const city of cities) {
        budget = ensureDivisionCity(ns, settings.secondaryProductDivision, city, budget, settings, ui);
        budget = ensureWarehouse(ns, settings.secondaryProductDivision, city, settings.minWarehouseLevelProduct, budget, settings, ui);
        budget = ensureOffice(ns, settings.secondaryProductDivision, city, settings.minOfficeSizeProduct, budget, settings);
        setProductSales(ns, settings.secondaryProductDivision, city);
    }

    return budget;
}

function ensureDivision(ns, industry, divisionName, budget, settings, ui) {
    if (divisionExists(ns, divisionName)) {
        return budget;
    }

    // Try to get industry data for cost, fallback to getExpandIndustryCost
    let cost = Number.POSITIVE_INFINITY;
    try {
        const industryData = corpCall(ns, "getIndustryData", industry);
        cost = Number(industryData.startingCost || 0);
    } catch {
        // Fallback to getExpandIndustryCost if getIndustryData doesn't exist
        cost = safeNumber(() => corpCall(ns, "getExpandIndustryCost", industry), Number.POSITIVE_INFINITY);
    }
    
    if (!Number.isFinite(cost) || cost === 0) {
        ui.log(`❌ Cannot determine expansion cost for ${industry} (got: ${cost})`, "error");
        ui.log(`   Trying with estimated cost of 70b...`, "info");
        cost = 70e9; // Fallback: typical Agriculture expansion cost
    }

    const funds = safeNumber(() => corpCall(ns, "getCorporation").funds, 0);
    
    // For initial divisions, bypass per-cycle budget limits - check only against total funds
    const corp = safeValue(() => corpCall(ns, "getCorporation"), null);
    const isFirstDivision = corp && corp.divisions.length === 0;
    
    const canAfford = isFirstDivision 
        ? (funds - cost >= settings.minimumCashBuffer)  // First division: use full funds minus buffer
        : canSpend(ns, cost, budget, settings.minimumCashBuffer);  // Later divisions: respect per-cycle budget
    
    if (!canAfford) {
        if (isFirstDivision) {
            ui.log(`💾 ${industry} blocked: Cost ${ns.formatNumber(cost, 2)} | Funds ${ns.formatNumber(funds, 2)} | MinBuffer ${ns.formatNumber(settings.minimumCashBuffer, 2)} [First division]`, "warn");
        } else {
            ui.log(`💾 ${industry} blocked: Cost ${ns.formatNumber(cost, 2)} | Budget ${ns.formatNumber(budget, 2)} | Funds ${ns.formatNumber(funds, 2)} | MinBuffer ${ns.formatNumber(settings.minimumCashBuffer, 2)}`, "warn");
        }
        return budget;
    }

    try {
        ui.log(`🚀 Expanding ${industry} → ${divisionName} (Cost: ${ns.formatNumber(cost, 2)})${isFirstDivision ? ' [FIRST DIVISION]' : ''}`, "info");
        corpCall(ns, "expandIndustry", industry, divisionName);
        ui.log(`✅ Expanded ${industry} → ${divisionName}`, "success");
        
        // If first division bypassed budget, recalculate budget based on remaining funds
        if (isFirstDivision) {
            const remainingFunds = safeNumber(() => corpCall(ns, "getCorporation").funds, 0);
            const newBudget = Math.max(0, remainingFunds * settings.maxSpendRatioPerCycle);
            ui.log(`💰 Budget recalculated: ${ns.formatNumber(newBudget, 2)} (after first division)`, "info");
            return newBudget;
        }
        
        return budget - cost;
    } catch (error) {
        ui.log(`❌ expandIndustry(${industry}, ${divisionName}) failed: ${String(error)}`, "error");
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
        return budget - cost;
    } catch (error) {
        ui.log(`❌ expandCity failed (${divisionName}/${city}): ${String(error)}`, "error");
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
            budget -= purchaseCost;
        } catch (error) {
            ui.log(`❌ purchaseWarehouse failed (${divisionName}/${city}): ${String(error)}`, "error");
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
            } catch {}
        }
    }

    try {
        if (safeBool(() => corpCall(ns, "hasUnlockUpgrade", "Smart Supply"), false)) {
            corpCall(ns, "setSmartSupply", divisionName, city, true);
        }
    } catch {}

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
            } catch {}
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
    } catch {}
}

function setAgricultureSales(ns, divisionName, city) {
    if (!hasWarehouse(ns, divisionName, city)) {
        return;
    }
    try {
        corpCall(ns, "sellMaterial", divisionName, city, "Food", "MAX", "MP");
        corpCall(ns, "sellMaterial", divisionName, city, "Plants", "MAX", "MP");
    } catch {}
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
        const prodInfo = safeValue(() => corpCall(ns, "getProduct", divisionName, city, product), null);
        if (!prodInfo) continue;

        const rating = Number(prodInfo.rat || 0);
        const markup = calculateMarkup(rating);

        try {
            corpCall(ns, "sellProduct", divisionName, city, product, "MAX", markup.toFixed(2), true);
        } catch {}
    }
}

function calculateMarkup(rating) {
    if (rating < 10) return 1.0;
    if (rating < 30) return 1.1;
    if (rating < 60) return 1.25;
    if (rating < 100) return 1.5;
    return 2.0;
}

function manageProducts(ns, settings, budget, ui) {
    return manageProductsForDivision(ns, settings.productDivision, settings, budget, ui);
}

function manageSecondaryProducts(ns, settings, budget, ui) {
    return manageProductsForDivision(ns, settings.secondaryProductDivision, settings, budget, ui);
}

function manageProductsForDivision(ns, divisionName, settings, budget, ui) {
    if (!divisionExists(ns, divisionName)) {
        return budget;
    }

    const division = safeValue(() => corpCall(ns, "getDivision", divisionName), null);
    if (!division || !division.makesProducts) {
        return budget;
    }

    const city = division.cities.includes(settings.productCity)
        ? settings.productCity
        : (division.cities[0] || settings.productCity);

    const products = [...division.products];
    let developing = 0;
    const toDisc = [];

    for (const product of products) {
        const info = safeValue(() => corpCall(ns, "getProduct", divisionName, city, product), null);
        if (!info) continue;

        const devProg = Number(info.developmentProgress || 0);
        const rating = Number(info.rat || 0);
        const profit = Number(info.prd || 0);

        if (devProg < 100) {
            developing += 1;
        } else if (rating < settings.productMinRating || profit < 0) {
            toDisc.push(product);
        }
    }

    for (const prod of toDisc) {
        if (products.length > 1) {
            try {
                corpCall(ns, "discontinueProduct", divisionName, prod);
                ui.log(`🗑️  Discontinued ${prod} (rating/profit low)`, "warn");
                products.splice(products.indexOf(prod), 1);
            } catch {}
        }
    }

    if (developing > 0 || products.length >= settings.maxProductsToKeep) {
        return budget;
    }

    const investCost = settings.productDesignInvestment + settings.productMarketingInvestment;
    if (!canSpend(ns, investCost, budget, settings.minimumCashBuffer * 2)) {
        return budget;
    }

    const productName = `${settings.productPrefix}-${state.nextProductId}`;
    state.nextProductId += 1;

    try {
        corpCall(
            ns,
            "makeProduct",
            divisionName,
            city,
            productName,
            settings.productDesignInvestment,
            settings.productMarketingInvestment
        );
        ui.log(`🚀 Started product: ${productName}`, "success");
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

    for (const research of RESEARCH_QUEUE) {
        if (!settings.upgrades.hasOwnProperty(research)) {
            try {
                if (!safeBool(() => corpCall(ns, "hasResearched", research), false)) {
                    const cost = safeNumber(() => corpCall(ns, "getResearchCost", research), Number.POSITIVE_INFINITY);
                    if (canSpend(ns, cost, budget, settings.minimumCashBuffer * 1.5)) {
                        corpCall(ns, "research", research);
                        budget -= cost;
                    }
                }
            } catch {}
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

function isDivisionStable(ns, divisionName) {
    if (!divisionExists(ns, divisionName)) {
        return false;
    }
    const division = safeValue(() => corpCall(ns, "getDivision", divisionName), null);
    if (!division) return false;

    const hasProducts = division.makesProducts && division.products.length > 0;
    if (!hasProducts) {
        return Number(division.revenue) > 1e9;
    }

    const city = division.cities[0];
    for (const prod of division.products) {
        const info = safeValue(() => corpCall(ns, "getProduct", divisionName, city, prod), null);
        if (info && Number(info.developmentProgress) >= 100) {
            return true;
        }
    }

    return false;
}

function shouldExpandToAllCities(ns, settings, ui) {
    // Already expanded or explicitly configured
    if (settings.expandToAllCities) {
        return false;
    }

    // Check if primary division exists and is profitable
    if (!divisionExists(ns, settings.primaryDivision)) {
        return false;
    }

    const corp = safeValue(() => corpCall(ns, "getCorporation"), null);
    if (!corp) return false;

    const division = safeValue(() => corpCall(ns, "getDivision", settings.primaryDivision), null);
    if (!division) return false;

    // Check milestone criteria
    const hasFunds = corp.funds >= settings.multiCityExpansionMinFunds;
    const hasRevenue = division.revenue >= settings.multiCityExpansionMinRevenue;
    
    // Check if primary city office has enough employees
    const primaryCity = division.cities.includes(settings.primaryCity) ? settings.primaryCity : division.cities[0];
    const office = safeValue(() => corpCall(ns, "getOffice", settings.primaryDivision, primaryCity), null);
    const hasEmployees = office && office.numEmployees >= settings.multiCityExpansionMinEmployees;

    // All criteria must be met
    const ready = hasFunds && hasRevenue && hasEmployees;
    
    if (ready && !state.expansionMilestoneLogged) {
        state.expansionMilestoneLogged = true;
        ui.log(`📊 Expansion criteria met:`, "info");
        ui.log(`   Funds: ${ns.formatNumber(corp.funds, 2)} ≥ ${ns.formatNumber(settings.multiCityExpansionMinFunds, 2)} ✓`, "info");
        ui.log(`   Revenue: ${ns.formatNumber(division.revenue, 2)}/s ≥ ${ns.formatNumber(settings.multiCityExpansionMinRevenue, 2)}/s ✓`, "info");
        ui.log(`   Employees: ${office.numEmployees} ≥ ${settings.multiCityExpansionMinEmployees} ✓`, "info");
    }

    return ready;
}

function getTargetCities(settings) {
    return settings.expandToAllCities ? CITIES : [settings.primaryCity];
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

function renderUI(ns, ui, settings) {
    const now = Date.now();
    if (now - state.lastRenderTs < 30000) {
        return;
    }
    state.lastRenderTs = now;

    const corp = safeValue(() => corpCall(ns, "getCorporation"), null);
    if (!corp) {
        return;
    }

    // Don't clear - just append a separator and stats
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log(`💰 Funds: ${ns.formatNumber(corp.funds, 2)} | Revenue: ${ns.formatNumber(corp.revenue, 2)}/s | Expenses: ${ns.formatNumber(corp.expenses, 2)}/s`, "info");
    ui.log(`🏭 Divisions: ${corp.divisions.length}`, "info");

    for (const div of corp.divisions) {
        const d = safeValue(() => corpCall(ns, "getDivision", div), null);
        if (!d) continue;
        ui.log(`  ${div}: R${ns.formatNumber(d.revenue, 1)}/s | Emp: ${d.totalEmployees}`, "info");
        if (d.makesProducts && d.products.length > 0) {
            const city = d.cities[0];
            for (const prod of d.products.slice(0, 2)) {
                const p = safeValue(() => corpCall(ns, "getProduct", div, city, prod), null);
                if (p) {
                    const rating = Number(p.rat || 0).toFixed(1);
                    const progress = Number(p.developmentProgress || 0).toFixed(0);
                    ui.log(`    ${prod}: ⭐${rating} | Dev: ${progress}%`, "info");
                }
            }
        }
    }
}
