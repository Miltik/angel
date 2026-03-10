/**
 * Crime Worker - Handles all singularity API calls for crime
 * Listens for commands on CRIME_WORKER_PORT and sends results back
 */

const CRIME_WORKER_PORT = 21; // Arbitrary unused port for crime worker commands
const CRIME_RESULT_PORT = 22; // Port for sending results back

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("🧑‍💼 Crime worker started");
    while (true) {
        const data = ns.readPort(CRIME_WORKER_PORT);
        if (data === "NULL PORT DATA") {
            await ns.sleep(100);
            continue;
        }
        let cmd;
        try {
            cmd = JSON.parse(data);
        } catch (e) {
            ns.print("Invalid command: " + data);
            continue;
        }
        let result = {};
        try {
            if (cmd.action === "getCurrentWork") {
                result = ns.singularity.getCurrentWork();
            } else if (cmd.action === "getCrimeChance") {
                result = ns.singularity.getCrimeChance(cmd.crime);
            } else if (cmd.action === "commitCrime") {
                result = ns.singularity.commitCrime(cmd.crime, false);
            } else {
                result = { error: "Unknown action" };
            }
        } catch (e) {
            result = { error: String(e) };
        }
        try {
            ns.writePort(CRIME_RESULT_PORT, JSON.stringify({ id: cmd.id, action: cmd.action, result }));
        } catch (e) {
            ns.print("Failed to write result: " + e);
        }
    }
}
