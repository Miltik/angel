/** @param {NS} ns */
export async function main(ns) {
    // Share power with factions (good for faction rep)
    while (true) {
        await ns.share();
    }
}
