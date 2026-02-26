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

    // 3. Expand to all cities, hire employees, and manage only cities with a warehouse
    let managedCities = [];
    for (const city of cityList) {
        if (!ns.corporation.getDivision(divisionName).cities.includes(city)) {
            ns.corporation.expandCity(divisionName, city);
            ns.tprint(`Expanded '${divisionName}' to ${city}.`);
        }
        // Try to ensure warehouse exists
        if (!ns.corporation.getWarehouse(divisionName, city)) {
            let warehouseCost = ns.corporation.getPurchaseWarehouseCost(divisionName, city);
            if (ns.corporation.getCorporation().funds >= warehouseCost) {
                ns.corporation.purchaseWarehouse(divisionName, city);
                ns.tprint(`Purchased warehouse for '${divisionName}' in ${city}.`);
                let retries = 10;
                while (!ns.corporation.getWarehouse(divisionName, city) && retries > 0) {
                    await ns.sleep(200);
                    retries--;
                }
            }
        }
        // Only manage city if warehouse exists
        if (ns.corporation.getWarehouse(divisionName, city)) {
            managedCities.push(city);
            // Hire employees and assign jobs
            while (ns.corporation.getOffice(divisionName, city).numEmployees < 3) {
                ns.corporation.hireEmployee(divisionName, city);
            }
            ns.corporation.setAutoJobAssignment(divisionName, city, "Operations", 1);
            ns.corporation.setAutoJobAssignment(divisionName, city, "Engineer", 1);
            ns.corporation.setAutoJobAssignment(divisionName, city, "Business", 1);
            // Upgrade office size and warehouse
            if (ns.corporation.getOffice(divisionName, city).size < 3) {
                let upgradeCost = ns.corporation.getUpgradeOfficeCost(divisionName, city, 3 - ns.corporation.getOffice(divisionName, city).size);
                while (ns.corporation.getCorporation().funds < upgradeCost) {
                    ns.tprint(`Waiting for funds to upgrade office in ${city} ($${ns.formatNumber(upgradeCost)} needed, $${ns.formatNumber(ns.corporation.getCorporation().funds)} available)...`);
                    await ns.sleep(5000);
                }
                ns.corporation.upgradeOfficeSize(divisionName, city, 3 - ns.corporation.getOffice(divisionName, city).size);
            }
            ns.corporation.upgradeWarehouse(divisionName, city, 1);
        } else {
            ns.tprint(`No warehouse in ${city}. City will not be managed until warehouse is available.`);
        }
    }

    // 5. Start making money: Sell max
    for (const city of managedCities) {
        try {
            ns.corporation.sellMaterial(divisionName, city, "Food", "MAX", "MP");
        } catch (e) {
            ns.tprint(`Error selling Food in ${city}: ${e}`);
        }
        try {
            ns.corporation.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
        } catch (e) {
            ns.tprint(`Error selling Plants in ${city}: ${e}`);
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
    let productManagedCities = [];
    if (!ns.corporation.getCorporation().divisions.includes(productDivision)) {
        ns.corporation.expandIndustry("Tobacco", productDivision);
        ns.tprint(`Division '${productDivision}' created.`);
    }
    for (const city of cityList) {
        if (!ns.corporation.getDivision(productDivision).cities.includes(city)) {
            ns.corporation.expandCity(productDivision, city);
        }
        if (!ns.corporation.getWarehouse(productDivision, city)) {
            let warehouseCost = ns.corporation.getPurchaseWarehouseCost(productDivision, city);
            if (ns.corporation.getCorporation().funds >= warehouseCost) {
                ns.corporation.purchaseWarehouse(productDivision, city);
                ns.tprint(`Purchased warehouse for '${productDivision}' in ${city}.`);
                let retries = 10;
                while (!ns.corporation.getWarehouse(productDivision, city) && retries > 0) {
                    await ns.sleep(200);
                    retries--;
                }
            }
        }
        if (ns.corporation.getWarehouse(productDivision, city)) {
            productManagedCities.push(city);
        } else {
            ns.tprint(`No warehouse in ${city} for ${productDivision}. City will not be managed until warehouse is available.`);
        }
    }

    // 8. Make products in the product division
    for (let i = 0; i < productNames.length; ++i) {
        if (ns.corporation.getDivision(productDivision).products.length <= i) {
            // Use first managed city for product creation
            if (productManagedCities.length > 0) {
                ns.corporation.makeProduct(productDivision, productManagedCities[0], productNames[i], 1e9, 1e9);
                ns.tprint(`Started making product: ${productNames[i]}`);
            } else {
                ns.tprint(`No managed city with warehouse for ${productDivision}. Cannot make product: ${productNames[i]}`);
            }
        }
    }

    // 9. Sell products
    for (const product of ns.corporation.getDivision(productDivision).products) {
        for (const city of productManagedCities) {
            try {
                ns.corporation.sellProduct(productDivision, city, product, "MAX", "MP", false);
            } catch (e) {
                ns.tprint(`Error selling product ${product} in ${city}: ${e}`);
            }
        }
    }

    ns.tprint("Corporation management script finished setup. Monitor and upgrade as needed!");
}
