/**
 * Coding Contracts Solver - Automatically solve contracts for money/rep
 * Handles: data compression, hamming codes, merging arrays, etc.
 * 
 * @param {NS} ns
 */
import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney } from "/angel/utils.js";

const TELEMETRY_PORT = 20;

let lastState = {
    contractsSolved: 0,
    totalRewards: 0,
    loopCount: 0
};

let telemetryState = {
    lastReportTime: 0
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("contracts", "📋 Coding Contracts", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("📋 Coding Contracts solver initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    
    // Show immediate scan on startup
    ui.log("🔍 Starting initial network scan...", "info");
    
    while (true) {
        try {
            lastState.loopCount++;
            const solved = await solveAllContracts(ns, ui);
            
            // Report telemetry
            reportContractsTelemetry(ns);
            
            // Show session stats periodically
            if (lastState.loopCount % 10 === 0) {
                if (lastState.contractsSolved > 0) {
                    ui.log(`📊 Session stats | Solved: ${lastState.contractsSolved} | Rewards: ${formatMoney(lastState.totalRewards)}`, "success");
                }
            }
            
            await ns.sleep(30000);  // Check every 30 seconds
        } catch (e) {
            ui.log(`❌ Error: ${e.message}`, "error");
            await ns.sleep(5000);
        }
    }
}

async function solveAllContracts(ns, ui) {
    let count = 0;
    let contractsFound = 0;
    let unsupported = 0;
    let scanned = 0;
    let rooted = 0;
    let alreadyRooted = 0;
    let needsRoot = 0;
    const servers = getAllServers(ns);
    const scanDetails = [];
    
        // Debug: Show sample of servers being checked
        if (lastState.loopCount % 20 === 1) {
            const sample = servers.slice(0, 5).join(", ");
            ui.log(`🔍 Checking ${servers.length} servers (sample: ${sample}...)`, "info");
        }
    
    for (const server of servers) {
        scanned++;
        
        // Try to root the server if we can
        if (!ns.hasRootAccess(server)) {
            needsRoot++;
            try {
                const portsNeeded = ns.getServerNumPortsRequired(server);
                let portsOpened = 0;
                
                if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(server); portsOpened++; }
                if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(server); portsOpened++; }
                if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(server); portsOpened++; }
                if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(server); portsOpened++; }
                if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(server); portsOpened++; }
                
                if (portsOpened >= portsNeeded) {
                    ns.nuke(server);
                    rooted++;
                    ui.log(`🔓 Rooted: ${server}`, "success");
                }
            } catch {
                // Can't root this server yet
            }
        } else {
            alreadyRooted++;
        }
        
        try {
            const contracts = ns.ls(server, ".cct");
            const contractTypes = contracts.map(name => ns.codingcontract.getContractType(name, server));
            const info = ns.getServer(server);
            const files = ns.ls(server).sort();
            scanDetails.push({
                server,
                rooted: ns.hasRootAccess(server),
                contracts,
                contractTypes,
                files,
                hasBackdoor: info.backdoorInstalled,
                requiredHack: info.requiredHackingSkill,
                portsRequired: info.numOpenPortsRequired,
                openPorts: info.openPortCount,
                moneyAvailable: info.moneyAvailable,
                moneyMax: info.moneyMax,
                ramUsed: info.ramUsed,
                maxRam: info.maxRam,
                purchasedByPlayer: info.purchasedByPlayer,
            });
            
            for (const contractName of contracts) {
                contractsFound++;
                const contractType = ns.codingcontract.getContractType(contractName, server);
                const contractData = ns.codingcontract.getData(contractName, server);
                
                ui.log(`🔍 Found: ${contractType} on ${server}`, "info");
                
                let solution = null;
                
                // Route to appropriate solver
                switch (contractType) {
                    case "Find Largest Prime Factor":
                        solution = solveLargestPrimeFactor(contractData);
                        break;
                    case "Subarray with Maximum Sum":
                        solution = solveMaxSubarray(contractData);
                        break;
                    case "Total Ways to Sum":
                        solution = solveTotalWaysToSum(contractData);
                        break;
                    case "Total Ways to Sum II":
                        solution = solveTotalWaysSumTwo(contractData);
                        break;
                    case "Spiralize Matrix":
                        solution = solveSpiralizeMatrix(contractData);
                        break;
                    case "Array Jumping Game":
                        solution = solveArrayJumping(contractData);
                        break;
                    case "Array Jumping Game II":
                        solution = solveArrayJumpingTwo(contractData);
                        break;
                    case "Merge Overlapping Intervals":
                        solution = solveMergeIntervals(contractData);
                        break;
                    case "Generate IP Addresses":
                        solution = solveGenerateIps(contractData);
                        break;
                    case "Algorithmic Stock Trader I":
                        solution = solveBuySellOnce(contractData);
                        break;
                    case "Algorithmic Stock Trader II":
                        solution = solveBuySellMultiple(contractData);
                        break;
                    case "Algorithmic Stock Trader III":
                        solution = solveBuySellTwoTransactions(contractData);
                        break;
                    case "Algorithmic Stock Trader IV":
                        solution = solveBuySellKTransactions(contractData);
                        break;
                    case "Minimum Path Sum in a Triangle":
                        solution = solveMinPathTriangle(contractData);
                        break;
                    case "Unique Paths in a Grid I":
                        solution = solveUniquePaths(contractData);
                        break;
                    case "Unique Paths in a Grid II":
                        solution = solveUniquePathsObstacles(contractData);
                        break;
                    case "Shortest Path in a Grid":
                        solution = solveBfsGrid(contractData);
                        break;
                    case "Sanitize Parentheses in Expression":
                        solution = solveSanitizeParens(contractData);
                        break;
                    case "Find All Valid Math Expressions":
                        solution = solveMathExpressions(contractData);
                        break;
                    case "HammingCodes: Integer to Encoded Binary":
                        solution = solveHammingEncode(contractData);
                        break;
                    case "HammingCodes: Encoded Binary to Integer":
                        solution = solveHammingDecode(contractData);
                        break;
                    case "Compression I: RLE Compression":
                        solution = solveRLE(contractData);
                        break;
                    case "Compression II: LZ Decompression":
                        solution = solveLZDecompress(contractData);
                        break;
                    case "Compression III: LZ Compression":
                        solution = solveLZCompress(contractData);
                        break;
                    case "Encryption I: Caesar Cipher":
                        solution = solveCaesarCipher(contractData);
                        break;
                    case "Encryption II: Vigenère Cipher":
                        solution = solveVigenereCipher(contractData);
                        break;
                    case "Square Root":
                        solution = solveIntegerSquareRoot(contractData);
                        break;
                    default:
                        unsupported++;
                        ui.log(`⚠️ No solver implemented for: ${contractType} (${server})`, "warn");
                        break;
                }
                
                if (solution !== null && solution !== undefined) {
                    const startTime = performance.now();
                    const reward = ns.codingcontract.attempt(solution, contractName, server);
                    const executionTime = performance.now() - startTime;
                    
                    if (reward) {
                        ui.log(`✓ ${contractType} on ${server}: ${reward}`, "success");
                        lastState.contractsSolved++;
                        const moneyMatch = reward.match(/\$([\d,]+)/);
                        const rewardAmount = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, "")) : 0;
                        if (moneyMatch) {
                            lastState.totalRewards += rewardAmount;
                        }
                        count++;
                        
                        // Report solver metric to port 20
                        try {
                            ns.writePort(TELEMETRY_PORT, JSON.stringify({
                                type: 'solver_metric',
                                contractType,
                                solverName: contractType.toLowerCase().replace(/\s+/g, '_'),
                                success: 1,
                                executionTimeMs: executionTime,
                                rewardAmount,
                                timestamp: Date.now()
                            }));
                        } catch (e) {
                            // Port write failed, continue
                        }
                    } else {
                        ui.log(`❌ Failed: ${contractType} on ${server}`, "warn");
                        
                        // Report failed solver metric
                        try {
                            ns.writePort(TELEMETRY_PORT, JSON.stringify({
                                type: 'solver_metric',
                                contractType,
                                solverName: contractType.toLowerCase().replace(/\s+/g, '_'),
                                success: 0,
                                executionTimeMs: executionTime,
                                rewardAmount: 0,
                                timestamp: Date.now()
                            }));
                        } catch (e) {
                            // Port write failed, continue
                        }
                    }
                }
            }
        } catch (e) {
            const fallbackInfo = ns.getServer(server);
            scanDetails.push({
                server,
                rooted: ns.hasRootAccess(server),
                contracts: [],
                contractTypes: [],
                files: ns.ls(server).sort(),
                hasBackdoor: fallbackInfo.backdoorInstalled,
                requiredHack: fallbackInfo.requiredHackingSkill,
                portsRequired: fallbackInfo.numOpenPortsRequired,
                openPorts: fallbackInfo.openPortCount,
                moneyAvailable: fallbackInfo.moneyAvailable,
                moneyMax: fallbackInfo.moneyMax,
                ramUsed: fallbackInfo.ramUsed,
                maxRam: fallbackInfo.maxRam,
                purchasedByPlayer: fallbackInfo.purchasedByPlayer,
                error: String(e?.message || e),
            });
            // Access denied - report it once per scan cycle
            if (!ns.hasRootAccess(server) && count === 0) {
                // Don't spam, just track
            }
        }
    }

    ui.log(`🧾 Scan detail (${scanDetails.length} servers):`, "info");
    for (const detail of scanDetails) {
        if (detail.error) {
            ui.log(`• ${detail.server} | root:${detail.rooted ? "yes" : "no"} | error:${detail.error}`, "warn");
            continue;
        }

        if (detail.contracts.length === 0) {
            ui.log(`• ${detail.server} | root:${detail.rooted ? "yes" : "no"} | contracts:none`, "info");
            continue;
        }

        const listed = detail.contracts.map((name, index) => `${name} (${detail.contractTypes[index]})`).join(", ");
        ui.log(`• ${detail.server} | root:${detail.rooted ? "yes" : "no"} | contracts:${listed}`, "success");
    }

    writeLootLog(ns, scanDetails);
    
    // Report scan results
    if (contractsFound === 0 && scanned > 0) {
        const rootStatus = needsRoot > 0 
            ? `${alreadyRooted} rooted, ${needsRoot} blocked${rooted > 0 ? `, ${rooted} newly rooted` : ''}`
            : `All ${alreadyRooted} rooted`;
        ui.log(`🔍 Scanned ${scanned} servers | ${rootStatus} | No contracts found`, "info");
    } else if (contractsFound > 0) {
        const unsolved = contractsFound - count;
        ui.log(`📋 Contracts found: ${contractsFound} | Solved: ${count} | Unsolved: ${unsolved}${unsupported > 0 ? ` | Unsupported: ${unsupported}` : ""}`, "info");
    }
    
    return count;
}

function writeLootLog(ns, scanDetails) {
    const timestamp = new Date().toISOString();
    const lines = [
        `ANGEL LOOT SCAN - ${timestamp}`,
        `Servers scanned: ${scanDetails.length}`,
        "",
    ];

    for (const detail of scanDetails) {
        lines.push(`=== ${detail.server} ===`);
        lines.push(`rooted: ${detail.rooted}`);
        lines.push(`backdoor: ${detail.hasBackdoor}`);
        lines.push(`purchased: ${detail.purchasedByPlayer}`);
        lines.push(`requiredHack: ${detail.requiredHack}`);
        lines.push(`ports: ${detail.openPorts}/${detail.portsRequired}`);
        lines.push(`ram: ${detail.ramUsed}/${detail.maxRam}`);
        lines.push(`money: ${detail.moneyAvailable}/${detail.moneyMax}`);

        if (detail.contracts.length === 0) {
            lines.push("contracts: none");
        } else {
            lines.push("contracts:");
            for (let i = 0; i < detail.contracts.length; i++) {
                lines.push(`  - ${detail.contracts[i]} | ${detail.contractTypes[i]}`);
            }
        }

        if (detail.error) {
            lines.push(`scanError: ${detail.error}`);
        }

        lines.push("files:");
        if (detail.files.length === 0) {
            lines.push("  (none)");
        } else {
            for (const file of detail.files) {
                lines.push(`  - ${file}`);
            }
        }

        lines.push("");
    }

    ns.write("/angel/loot.txt", lines.join("\n"), "w");
}

// Simple solvers for common contract types
function solveLargestPrimeFactor(n) {
    let factor = 2;
    while (factor * factor <= n) {
        while (n % factor === 0) n /= factor;
        factor++;
    }
    return n > 1 ? n : factor;
}

function solveMaxSubarray(arr) {
    let maxSum = arr[0];
    let currentSum = arr[0];
    for (let i = 1; i < arr.length; i++) {
        currentSum = Math.max(arr[i], currentSum + arr[i]);
        maxSum = Math.max(maxSum, currentSum);
    }
    return maxSum;
}

function solveTotalWaysToSum(n) {
    const dp = new Array(n + 1).fill(0);
    dp[0] = 1;
    for (let i = 1; i < n; i++) {
        for (let j = i; j <= n; j++) {
            dp[j] += dp[j - i];
        }
    }
    return dp[n];
}

function solveSpiralizeMatrix(matrix) {
    const result = [];
    let top = 0, bottom = matrix.length - 1, left = 0, right = matrix[0].length - 1;
    while (top <= bottom && left <= right) {
        for (let i = left; i <= right; i++) result.push(matrix[top][i]);
        top++;
        for (let i = top; i <= bottom; i++) result.push(matrix[i][right]);
        right--;
        if (top <= bottom) for (let i = right; i >= left; i--) result.push(matrix[bottom][i]);
        bottom--;
        if (left <= right) for (let i = bottom; i >= top; i--) result.push(matrix[i][left]);
        left++;
    }
    return result;
}

function solveArrayJumping(data) {
    // Array Jumping Game: data is an array where each element is max jump from that position
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return 0;
    if (arr.length === 1) return 1;
    
    let maxReach = 0;
    for (let i = 0; i < arr.length && i <= maxReach; i++) {
        maxReach = Math.max(maxReach, i + arr[i]);
        if (maxReach >= arr.length - 1) return 1;
    }
    return 0;
}

function solveArrayJumpingTwo(data) {
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length <= 1) return 0;
    if (arr[0] === 0) return 0;

    let jumps = 0;
    let currentEnd = 0;
    let farthest = 0;

    for (let i = 0; i < arr.length - 1; i++) {
        farthest = Math.max(farthest, i + arr[i]);
        if (i === currentEnd) {
            jumps++;
            currentEnd = farthest;
            if (currentEnd >= arr.length - 1) return jumps;
            if (currentEnd <= i) return 0;
        }
    }

    return currentEnd >= arr.length - 1 ? jumps : 0;
}

function solveMergeIntervals(intervals) {
    if (!intervals.length) return [];
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        const last = merged[merged.length - 1];
        if (intervals[i][0] <= last[1]) {
            last[1] = Math.max(last[1], intervals[i][1]);
        } else {
            merged.push(intervals[i]);
        }
    }
    return merged;
}

function solveGenerateIps(s) {
    const ips = [];
    if (s.length < 4 || s.length > 12) return ips;
    const backtrack = (index, current, dots) => {
        if (dots === 4) {
            if (index === s.length) ips.push(current.slice(0, -1));
            return;
        }
        for (let i = 1; i <= 3 && index + i <= s.length; i++) {
            const part = s.substring(index, index + i);
            if ((part[0] === '0' && part.length > 1) || parseInt(part) > 255) continue;
            backtrack(index + i, current + part + ".", dots + 1);
        }
    };
    backtrack(0, "", 0);
    return ips;
}

function solveBuySellOnce(prices) {
    let maxProfit = 0;
    let minPrice = prices[0];
    for (let i = 1; i < prices.length; i++) {
        maxProfit = Math.max(maxProfit, prices[i] - minPrice);
        minPrice = Math.min(minPrice, prices[i]);
    }
    return maxProfit;
}

function solveBuySellMultiple(prices) {
    let profit = 0;
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
    }
    return profit;
}

function solveBuySellTwoTransactions(prices) {
    const n = prices.length;
    const left = new Array(n).fill(0);
    const right = new Array(n).fill(0);
    let minPrice = prices[0];
    for (let i = 1; i < n; i++) {
        left[i] = Math.max(left[i - 1], prices[i] - minPrice);
        minPrice = Math.min(minPrice, prices[i]);
    }
    let maxPrice = prices[n - 1];
    for (let i = n - 2; i >= 0; i--) {
        right[i] = Math.max(right[i + 1], maxPrice - prices[i]);
        maxPrice = Math.max(maxPrice, prices[i]);
    }
    let maxProfit = 0;
    for (let i = 0; i < n; i++) maxProfit = Math.max(maxProfit, left[i] + right[i]);
    return maxProfit;
}

function solveBuySellKTransactions([k, prices]) {
    if (k >= prices.length / 2) return solveBuySellMultiple(prices);
    const buy = new Array(k + 1).fill(-Infinity);
    const sell = new Array(k + 1).fill(0);
    for (const price of prices) {
        for (let j = k; j > 0; j--) {
            sell[j] = Math.max(sell[j], buy[j] + price);
            buy[j] = Math.max(buy[j], sell[j - 1] - price);
        }
    }
    return sell[k];
}

function solveMinPathTriangle(triangle) {
    const n = triangle.length;
    for (let i = n - 2; i >= 0; i--) {
        for (let j = 0; j <= i; j++) {
            triangle[i][j] += Math.min(triangle[i + 1][j], triangle[i + 1][j + 1]);
        }
    }
    return triangle[0][0];
}

function solveUniquePaths([m, n]) {
    const dp = Array(n).fill(1);
    for (let i = 1; i < m; i++) {
        for (let j = 1; j < n; j++) {
            dp[j] += dp[j - 1];
        }
    }
    return dp[n - 1];
}

function solveUniquePathsObstacles(grid) {
    const m = grid.length, n = grid[0].length;
    const dp = Array(n).fill(0);
    dp[0] = 1;
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (grid[i][j] === 1) dp[j] = 0;
            else if (j > 0) dp[j] += dp[j - 1];
        }
    }
    return dp[n - 1];
}

function solveBfsGrid(grid) {
    const m = grid.length, n = grid[0].length;
    if (grid[0][0] === 1) return "";
    
    const queue = [[0, 0, ""]];
    const visited = new Set(["0,0"]);
    const dirs = [[0, 1, "R"], [0, -1, "L"], [1, 0, "D"], [-1, 0, "U"]];
    
    while (queue.length) {
        const [r, c, path] = queue.shift();
        if (r === m - 1 && c === n - 1) return path;
        
        for (const [dr, dc, dir] of dirs) {
            const nr = r + dr, nc = c + dc;
            const key = `${nr},${nc}`;
            if (nr >= 0 && nr < m && nc >= 0 && nc < n && grid[nr][nc] === 0 && !visited.has(key)) {
                visited.add(key);
                queue.push([nr, nc, path + dir]);
            }
        }
    }
    return "";
}

function solveSanitizeParens(s) {
    const results = new Set();
    let maxLen = 0;
    
    function isValid(str) {
        let balance = 0;
        for (const c of str) {
            if (c === '(') balance++;
            else if (c === ')') balance--;
            if (balance < 0) return false;
        }
        return balance === 0;
    }
    
    function backtrack(index, current, removed) {
        if (index === s.length) {
            if (isValid(current)) {
                if (current.length > maxLen) {
                    maxLen = current.length;
                    results.clear();
                    results.add(current);
                } else if (current.length === maxLen) {
                    results.add(current);
                }
            }
            return;
        }
        
        const c = s[index];
        if (c === '(' || c === ')') {
            // Try removing this parenthesis
            backtrack(index + 1, current, removed + 1);
        }
        // Always try keeping the character
        backtrack(index + 1, current + c, removed);
    }
    
    backtrack(0, "", 0);
    return Array.from(results);
}

function solveMathExpressions([numStr, target]) {
    const results = [];
    const str = String(numStr);
    
    function evaluate(expr) {
        const nums = [];
        const ops = [];
        let num = 0;
        let lastOp = '+';
        
        for (let i = 0; i < expr.length; i++) {
            const c = expr[i];
            if (c >= '0' && c <= '9') {
                num = num * 10 + parseInt(c);
            }
            if ((c < '0' || c > '9') || i === expr.length - 1) {
                if (lastOp === '+') nums.push(num);
                else if (lastOp === '-') nums.push(-num);
                else if (lastOp === '*') nums[nums.length - 1] *= num;
                
                if (i < expr.length - 1) lastOp = c;
                num = 0;
            }
        }
        return nums.reduce((a, b) => a + b, 0);
    }
    
    function backtrack(index, expr) {
        if (index === str.length) {
            if (evaluate(expr) === target) {
                results.push(expr);
            }
            return;
        }
        
        for (const op of (index === 0 ? [''] : ['', '+', '-', '*'])) {
            backtrack(index + 1, expr + (op === '' ? '' : op) + str[index]);
        }
    }
    
    backtrack(0, "");
    return results;
}

function solveHammingEncode(num) {
    const bin = num.toString(2);
    const data = bin.split('').map(Number);
    let m = data.length;
    let r = 0;
    while ((1 << r) < m + r + 1) r++;
    
    const encoded = new Array(m + r).fill(0);
    let dataIndex = 0;
    
    for (let i = 1; i <= encoded.length; i++) {
        if ((i & (i - 1)) !== 0) {
            encoded[i - 1] = data[dataIndex++];
        }
    }
    
    for (let i = 0; i < r; i++) {
        const parityPos = (1 << i) - 1;
        let parity = 0;
        for (let j = 0; j < encoded.length; j++) {
            if (((j + 1) & (1 << i)) !== 0) {
                parity ^= encoded[j];
            }
        }
        encoded[parityPos] = parity;
    }
    
    return encoded.join('');
}

function solveHammingDecode(str) {
    const bits = str.split('').map(Number);
    const n = bits.length;
    let errorPos = 0;
    
    const r = Math.floor(Math.log2(n)) + 1;
    for (let i = 0; i < r; i++) {
        const parityPos = (1 << i);
        let parity = 0;
        for (let j = 1; j <= n; j++) {
            if ((j & parityPos) !== 0) {
                parity ^= bits[j - 1];
            }
        }
        if (parity !== 0) {
            errorPos += parityPos;
        }
    }
    
    if (errorPos > 0 && errorPos <= n) {
        bits[errorPos - 1] ^= 1;
    }
    
    const dataBits = [];
    for (let i = 1; i <= n; i++) {
        if ((i & (i - 1)) !== 0) {
            dataBits.push(bits[i - 1]);
        }
    }
    
    return parseInt(dataBits.join(''), 2);
}

function solveRLE(s) {
    let result = "";
    let i = 0;
    while (i < s.length) {
        let count = 1;
        while (i + count < s.length && s[i] === s[i + count] && count < 9) {
            count++;
        }
        result += count + s[i];
        i += count;
    }
    return result;
}

function solveLZDecompress(compressed) {
    let result = "";
    for (let i = 0; i < compressed.length;) {
        const literal = compressed[i];
        const refLength = compressed.charCodeAt(i + 1) || 0;
        
        if (refLength === 0) {
            result += literal;
            i += 2;
        } else {
            const refOffset = compressed.charCodeAt(i + 2) || 0;
            result += literal;
            const startPos = result.length - refOffset;
            for (let j = 0; j < refLength; j++) {
                result += result[startPos + j];
            }
            i += 3;
        }
    }
    return result;
}

function solveLZCompress(input) {
    const s = String(input ?? "");
    const n = s.length;
    if (n === 0) return "";

    const makeKey = (i, type) => `${i}|${type}`;
    const parseKey = (key) => {
        const [i, type] = key.split("|");
        return [Number(i), Number(type)];
    };

    const bestLen = new Map();
    const bestStr = new Map();
    const queue = [{ i: 0, type: 0, encoded: "" }];
    const startKey = makeKey(0, 0);
    bestLen.set(startKey, 0);
    bestStr.set(startKey, "");

    const better = (candidate, current) => {
        if (current === undefined) return true;
        if (candidate.length !== current.length) return candidate.length < current.length;
        return candidate < current;
    };

    const pushState = (i, type, encoded) => {
        const key = makeKey(i, type);
        const current = bestStr.get(key);
        if (!better(encoded, current)) return;
        bestLen.set(key, encoded.length);
        bestStr.set(key, encoded);
        queue.push({ i, type, encoded });
    };

    const canBackref = (pos, offset, length) => {
        if (offset < 1 || offset > 9 || pos - offset < 0) return false;
        if (length < 1 || length > 9 || pos + length > n) return false;
        for (let k = 0; k < length; k++) {
            if (s[pos + k] !== s[pos - offset + k]) return false;
        }
        return true;
    };

    while (queue.length > 0) {
        let bestIndex = 0;
        for (let i = 1; i < queue.length; i++) {
            const a = queue[i];
            const b = queue[bestIndex];
            if (a.encoded.length < b.encoded.length || (a.encoded.length === b.encoded.length && a.encoded < b.encoded)) {
                bestIndex = i;
            }
        }

        const state = queue.splice(bestIndex, 1)[0];
        const stateKey = makeKey(state.i, state.type);
        if (bestStr.get(stateKey) !== state.encoded) continue;

        pushState(state.i, 1 - state.type, `${state.encoded}0`);

        if (state.type === 0) {
            for (let len = 1; len <= 9 && state.i + len <= n; len++) {
                const literal = s.slice(state.i, state.i + len);
                pushState(state.i + len, 1, `${state.encoded}${len}${literal}`);
            }
        } else {
            const maxOffset = Math.min(9, state.i);
            const maxLen = Math.min(9, n - state.i);
            for (let offset = 1; offset <= maxOffset; offset++) {
                for (let len = 1; len <= maxLen; len++) {
                    if (!canBackref(state.i, offset, len)) continue;
                    pushState(state.i + len, 0, `${state.encoded}${len}${offset}`);
                }
            }
        }
    }

    const endA = bestStr.get(makeKey(n, 0));
    const endB = bestStr.get(makeKey(n, 1));
    if (endA === undefined) return endB ?? "";
    if (endB === undefined) return endA;
    return better(endA, endB) ? endA : endB;
}

function solveIntegerSquareRoot(value) {
    const raw = typeof value === "string" ? value : String(value);
    const n = BigInt(raw);
    const ZERO = BigInt(0);
    const ONE = BigInt(1);
    const TWO = BigInt(2);
    if (n < TWO) return n.toString();

    let left = ONE;
    let right = n;
    let ans = ONE;

    while (left <= right) {
        const mid = (left + right) / TWO;
        const sq = mid * mid;
        if (sq === n) return mid.toString();
        if (sq < n) {
            ans = mid;
            left = mid + ONE;
        } else {
            right = mid - ONE;
        }
    }

    return ans.toString();
}

function solveCaesarCipher([text, shift]) {
    return text.split("").map(c => {
        if (c.match(/[a-z]/i)) {
            const code = c.charCodeAt(0);
            const start = code >= 65 ? 65 : 97;
            return String.fromCharCode(start + (code - start + shift) % 26);
        }
        return c;
    }).join("");
}

function solveVigenereCipher([text, key]) {
    let result = "";
    let keyIndex = 0;
    
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (!c.match(/[A-Z]/)) {
            result += c;
        } else {
            const textCode = c.charCodeAt(0) - 65;
            const keyCode = key[keyIndex % key.length].charCodeAt(0) - 65;
            const decrypted = (textCode - keyCode + 26) % 26;
            result += String.fromCharCode(decrypted + 65);
            keyIndex++;
        }
    }
    return result;
}

function solveTotalWaysSumTwo([n, s]) {
    // Total Ways to Sum II: find ways to sum a number using coins from array s
    const target = n;
    const coins = Array.isArray(s) ? s : [s];
    const dp = new Array(target + 1).fill(0);
    dp[0] = 1;
    
    for (const coin of coins) {
        for (let i = coin; i <= target; i++) {
            dp[i] += dp[i - coin];
        }
    }
    return dp[target];
}

function getAllServers(ns, server = "home", visited = new Set()) {
    visited.add(server);
    const neighbors = ns.scan(server);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            getAllServers(ns, neighbor, visited);
        }
    }
    return Array.from(visited);
}
function reportContractsTelemetry(ns) {
    try {
        const now = Date.now();
        
        const metricsPayload = {
            contractsSolved: lastState.contractsSolved,
            totalRewards: lastState.totalRewards,
            loopCount: lastState.loopCount
        };
        
        writeContractsMetrics(ns, metricsPayload);
        telemetryState.lastReportTime = now;
    } catch (e) {
        ns.print(`❌ Contracts telemetry error: ${e}`);
    }
}

function writeContractsMetrics(ns, metricsPayload) {
    try {
        const payload = JSON.stringify({
            module: 'contracts',
            timestamp: Date.now(),
            metrics: metricsPayload,
        });
        ns.tryWritePort(TELEMETRY_PORT, payload);
    } catch (e) {
        ns.print(`❌ Failed to write contracts metrics: ${e}`);
    }
}