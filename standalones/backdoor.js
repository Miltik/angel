import { main as moduleBackdoorMain } from "/angel/modules/backdoor.js";

/** @param {NS} ns */
export async function main(ns) {
    await moduleBackdoorMain(ns);
}
