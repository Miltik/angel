/**
 * Helper: Scan all servers and report any coding contract files (.cct)
 * Run in Bitburner with: run /angel/modules/find_contracts.js
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const visited = new Set();
    const stack = ["home"];
    let found = 0;

    while (stack.length) {
        const server = stack.pop();
        if (visited.has(server)) continue;
        visited.add(server);

        try {
            const files = ns.ls(server).filter(f => f.endsWith('.cct'));
            if (files.length > 0) {
                ns.tprint(`Contracts on ${server}: ${files.join(', ')}`);
                found++;
            }
        } catch (e) {
            // ignore
        }

        try {
            for (const neigh of ns.scan(server)) {
                if (!visited.has(neigh)) stack.push(neigh);
            }
        } catch (e) { }
    }

    ns.tprint(`Scan complete. Found ${found} servers with contracts.`);
}
