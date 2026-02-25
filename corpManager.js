// corpManager.js
// Standalone Corporation Management Script for Bitburner
// This script will create a corporation, expand into divisions, manage products, and optimize upgrades.
// Usage: Run this script with the Bitburner NS API

/**
 * @param {NS} ns
 */
export async function main(ns) {
    // CONFIGURATION
    const corpName = "AngelCorp";
    const divisionName = "Agriculture";
    const cityList = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];
    const productDivision = "Tobacco"; // Example: expand to Tobacco for products
    const productNames = ["AngelCigs1", "AngelCigs2", "AngelCigs3"];
    const initialFunds = 150e9; // Minimum required for corp creation with funds

    // 1. Create Corporation
    if (!ns.corporation.hasCorporation()) {
        if (ns.getPlayer().money < initialFunds) {
            ns.tprint(`ERROR: Need at least $${ns.formatNumber(initialFunds)} to create a corporation with funds.`);
            return;
        }
        ns.corporation.createCorporation(corpName, true);
        ns.tprint(`Corporation '${corpName}' created.`);
    } else {
        ns.tprint("Corporation already exists.");
    }

    // 2. Expand to Agriculture Division
    if (!ns.corporation.getCorporation().divisions.includes(divisionName)) {
        ns.corporation.expandIndustry("Agriculture", divisionName);
        ns.tprint(`Division '${divisionName}' created.`);
    }

    // 3. Expand to all cities, hire employees, and ensure warehouse exists
    for (const city of cityList) {
        if (!ns.corporation.getDivision(divisionName).cities.includes(city)) {
            ns.corporation.expandCity(divisionName, city);
            ns.tprint(`Expanded '${divisionName}' to ${city}.`);
        }
        // Ensure warehouse exists before any further actions
        if (!ns.corporation.getWarehouse(divisionName, city)) {
            ns.corporation.purchaseWarehouse(divisionName, city);
            ns.tprint(`Purchased warehouse for '${divisionName}' in ${city}.`);
        }
        // Hire employees and assign jobs
        while (ns.corporation.getOffice(divisionName, city).numEmployees < 3) {
            ns.corporation.hireEmployee(divisionName, city);
        }
        ns.corporation.setAutoJobAssignment(divisionName, city, "Operations", 1);
        ns.corporation.setAutoJobAssignment(divisionName, city, "Engineer", 1);
        ns.corporation.setAutoJobAssignment(divisionName, city, "Business", 1);
        // Upgrade office size and warehouse
        if (ns.corporation.getOffice(divisionName, city).size < 3) {
            ns.corporation.upgradeOfficeSize(divisionName, city, 3 - ns.corporation.getOffice(divisionName, city).size);
        }
        ns.corporation.upgradeWarehouse(divisionName, city, 1);
    }

    // 5. Start making money: Sell max
    for (const city of cityList) {
        // Only sell if warehouse exists
        if (ns.corporation.getWarehouse(divisionName, city)) {
            ns.corporation.sellMaterial(divisionName, city, "Food", "MAX", "MP");
            ns.corporation.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
        } else {
            ns.tprint(`Skipping sellMaterial in ${city}: No warehouse for ${divisionName}`);
        }
    }

    // 6. Research upgrades
    const upgrades = ["Smart Factories", "Smart Storage", "DreamSense", "Wilson Analytics"];
    for (const upgrade of upgrades) {
        while (ns.corporation.getUpgradeLevel(upgrade) < 5) {
            if (ns.corporation.getCorporation().funds > ns.corporation.getUpgradeLevelCost(upgrade)) {
                ns.corporation.levelUpgrade(upgrade);
                ns.tprint(`Upgraded ${upgrade}.`);
            } else {
                break;
            }
        }
    }

    // 7. Expand to a product division (e.g., Tobacco)
    if (!ns.corporation.getCorporation().divisions.includes(productDivision)) {
        ns.corporation.expandIndustry("Tobacco", productDivision);
        ns.tprint(`Division '${productDivision}' created.`);
        for (const city of cityList) {
            ns.corporation.expandCity(productDivision, city);
            if (!ns.corporation.getWarehouse(productDivision, city)) {
                ns.corporation.purchaseWarehouse(productDivision, city);
            }
        }
    }

    // 8. Make products in the product division
    for (let i = 0; i < productNames.length; ++i) {
        if (ns.corporation.getDivision(productDivision).products.length <= i) {
            ns.corporation.makeProduct(productDivision, cityList[0], productNames[i], 1e9, 1e9);
            ns.tprint(`Started making product: ${productNames[i]}`);
        }
    }

    // 9. Sell products
    for (const product of ns.corporation.getDivision(productDivision).products) {
        for (const city of cityList) {
            ns.corporation.sellProduct(productDivision, city, product, "MAX", "MP", false);
        }
    }

    ns.tprint("Corporation management script finished setup. Monitor and upgrade as needed!");
}
