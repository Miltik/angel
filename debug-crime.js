/** @param {NS} ns */
export async function main(ns) {
    const paths = [
        "/angel/modules/crime-core.js",
        "angel/modules/crime-core.js",
        "/angel/modules/crime.js",
        "angel/modules/crime.js"
    ];
    
    for (const path of paths) {
        const exists = ns.fileExists(path, "home");
        const ram = exists ? ns.getScriptRam(path, "home") : "N/A";
        ns.tprint(`${path}: exists=${exists}, ram=${ram}GB`);
    }
    
    ns.tprint("\nConfig check:");
    const config = await ns.read("/angel/config.js");
    const hasCrimeCore = config.includes("crime-core");
    ns.tprint(`config.js contains "crime-core": ${hasCrimeCore}`);
}
