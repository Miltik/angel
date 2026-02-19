/**
 * Coding Contracts Solver - Automatically solve contracts for money/rep
 * Handles: data compression, hamming codes, merging arrays, etc.
 * 
 * @param {NS} ns
 */
import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney } from "/angel/utils.js";

let lastState = {
    contractsSolved: 0,
    totalRewards: 0,
    loopCount: 0
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("contracts", "📋 Coding Contracts", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("📋 Coding Contracts solver initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Best-effort guard: avoid running multiple instances on the same host
    try {
        const procs = ns.ps("home") || [];
        const same = procs.filter(p => p.filename && (p.filename.endsWith("/modules/contracts.js") || p.filename.endsWith("modules/contracts.js") || p.filename.endsWith("contracts.js")));
        if (same.length > 1) {
            ui.log(`⚠️ Another contracts instance detected on home (${same.length}). Exiting to avoid conflicts.`, "warn");
            return;
        }
    } catch (e) {
        // ignore — this is a best-effort guard
    }
    while (true) {
        try {
            lastState.loopCount++;
            const solved = await solveAllContracts(ns, ui);
            
            // Log periodically
            if (lastState.loopCount % 10 === 0) {
                ui.log(`✅ Contracts solved: ${lastState.contractsSolved} | Rewards: ${formatMoney(lastState.totalRewards)}`, "info");
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
    const servers = getAllServers(ns);
    
    for (const server of servers) {
        try {
            const contracts = ns.codingcontract.listContracts(server);
            
            for (const contractName of contracts) {
                const contractType = ns.codingcontract.getContractType(contractName, server);
                const contractData = ns.codingcontract.getData(contractName, server);
                
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
                    case "Spiralize Matrix":
                        solution = solveSpiralizeMatrix(contractData);
                        break;
                    case "Array Jumping Game":
                        solution = solveArrayJumping(contractData);
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
                    case "Encryption I: Caesar Cipher":
                        solution = solveCaesarCipher(contractData);
                        break;
                    case "Encryption II: Vigenère Cipher":
                        solution = solveVigenereCipher(contractData);
                        break;
                }
                
                if (solution !== null && solution !== undefined) {
                    try {
                        const attemptResult = ns.codingcontract.attempt(solution, contractName, server);
                        if (attemptResult) {
                            // Normalize reward to a number (some builds return a number, others a string)
                            let rewardMoney = 0;
                            if (typeof attemptResult === 'number') {
                                rewardMoney = attemptResult;
                            } else if (typeof attemptResult === 'string') {
                                const m = attemptResult.match(/\$?([\d,]+)/);
                                if (m) rewardMoney = parseInt(m[1].replace(/,/g, ''));
                            }

                            ui.log(`✅ ${contractType} on ${server}: ${rewardMoney ? rewardMoney : attemptResult}`, "success");
                            lastState.contractsSolved++;
                            lastState.totalRewards += Number.isFinite(rewardMoney) ? rewardMoney : 0;
                            count++;
                        }
                    } catch (e) {
                        // Don't let a single failed attempt crash the whole solver
                        ui.log(`❌ Attempt error for ${contractType} on ${server}: ${e}`, "error");
                    }
                }
            }
        } catch (e) {
            // Silently skip servers with no contracts or access issues
        }
    }
    
    return count;
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

function solveArrayJumping(arr) {
    // arr is an array where each value is max jump length from that index
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    let furthest = 0;
    for (let i = 0; i < arr.length; i++) {
        if (i > furthest) return 0;
        furthest = Math.max(furthest, i + Number(arr[i] || 0));
        if (furthest >= arr.length - 1) return 1;
    }
    return 0;
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
    const queue = [[0, 0]];
    const visited = [[0, 0]];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (queue.length) {
        const [r, c] = queue.shift();
        if (r === m - 1 && c === n - 1) return 1;
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < m && nc >= 0 && nc < n && grid[nr][nc] === 0) {
                queue.push([nr, nc]);
                visited.push([nr, nc]);
            }
        }
    }
    return 0;
}

function solveSanitizeParens(s) {
    // Remove the minimum number of invalid parentheses using BFS
    const isValid = (str) => {
        let bal = 0;
        for (const ch of str) {
            if (ch === '(') bal++;
            else if (ch === ')') {
                if (bal === 0) return false;
                bal--;
            }
        }
        return bal === 0;
    };

    const res = new Set();
    const visited = new Set();
    const queue = [s];
    visited.add(s);
    let found = false;

    while (queue.length) {
        const cur = queue.shift();
        if (isValid(cur)) {
            res.add(cur);
            found = true;
        }
        if (found) continue;
        for (let i = 0; i < cur.length; i++) {
            if (cur[i] !== '(' && cur[i] !== ')') continue;
            const next = cur.slice(0, i) + cur.slice(i + 1);
            if (!visited.has(next)) {
                visited.add(next);
                queue.push(next);
            }
        }
    }

    return Array.from(res);
}

function solveMathExpressions([num, target]) {
    const results = new Set();
    const backtrack = (expr, index) => {
        if (index === num.length) {
            try {
                const val = evaluateExpression(expr);
                if (!Number.isNaN(val) && val === target) results.add(expr);
            } catch (e) { }
            return;
        }
        for (const op of ['', '+', '-', '*']) {
            backtrack(expr + op + num[index], index + 1);
        }
    };
    backtrack("", 0);
    return Array.from(results);
}

function evaluateExpression(expr) {
    // Shunting-yard algorithm to safely evaluate +, -, * and parentheses
    if (typeof expr !== 'string' || expr.length === 0) return NaN;
    const precedence = (op) => (op === '*' ? 2 : (op === '+' || op === '-') ? 1 : 0);
    const applyOp = (ops, vals) => {
        const op = ops.pop();
        const b = vals.pop();
        const a = vals.pop();
        switch (op) {
            case '+': vals.push(a + b); break;
            case '-': vals.push(a - b); break;
            case '*': vals.push(a * b); break;
            default: vals.push(NaN);
        }
    };

    const ops = [];
    const vals = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];
        if (ch === ' ') { i++; continue; }
        // number (may be multi-digit)
        if (ch >= '0' && ch <= '9') {
            let j = i;
            while (j < expr.length && expr[j] >= '0' && expr[j] <= '9') j++;
            vals.push(Number(expr.slice(i, j)));
            i = j;
            continue;
        }
        if (ch === '(') { ops.push(ch); i++; continue; }
        if (ch === ')') {
            while (ops.length && ops[ops.length - 1] !== '(') applyOp(ops, vals);
            ops.pop(); i++; continue;
        }
        // operator: handle unary minus
        if ((ch === '+' || ch === '-' || ch === '*')) {
            // unary minus if at start or after another operator or after '('
            if (ch === '-' && (i === 0 || ['+', '-', '*', '('].includes(expr[i - 1]))) {
                // parse negative number
                let j = i + 1;
                while (j < expr.length && expr[j] >= '0' && expr[j] <= '9') j++;
                const num = Number(expr.slice(i, j));
                if (!Number.isNaN(num)) {
                    vals.push(num);
                    i = j; continue;
                }
            }
            while (ops.length && precedence(ops[ops.length - 1]) >= precedence(ch)) applyOp(ops, vals);
            ops.push(ch);
            i++; continue;
        }
        // unknown char
        return NaN;
    }
    while (ops.length) applyOp(ops, vals);
    return vals.length ? vals[vals.length - 1] : NaN;
}

function solveHammingEncode(num) {
    // Encode integer to Hamming (parity) encoded binary string
    let data = Number(num).toString(2);
    // Insert parity bits at positions 1,2,4,8,... (1-based)
    const res = [];
    let dataIdx = 0;
    let totalLen = data.length;
    // Determine number of parity bits needed
    let r = 0;
    while ((1 << r) < (totalLen + r + 1)) r++;
    const outLen = totalLen + r;
    for (let i = 1; i <= outLen; i++) {
        if ((i & (i - 1)) === 0) {
            res[i - 1] = '0'; // placeholder for parity
        } else {
            res[i - 1] = data[dataIdx++] || '0';
        }
    }
    // Compute parity bits
    for (let i = 0; i < r; i++) {
        const pos = 1 << i;
        let parity = 0;
        for (let j = pos; j <= outLen; j += pos * 2) {
            for (let k = j; k < j + pos && k <= outLen; k++) {
                if (k === pos) continue;
                if (res[k - 1] === '1') parity ^= 1;
            }
        }
        res[pos - 1] = parity ? '1' : '0';
    }
    return res.join('');
}

function solveHammingDecode(bin) {
    // Decode Hamming encoded binary string back to integer
    const bits = bin.split("").map(b => (b === '1' ? 1 : 0));
    const n = bits.length;
    // find number of parity bits r
    let r = 0;
    while ((1 << r) <= n) r++;
    // detect error
    let errorPos = 0;
    for (let i = 0; i < r; i++) {
        let parity = 0;
        const pos = 1 << i;
        for (let j = 1; j <= n; j++) {
            if (j & pos) parity ^= bits[j - 1];
        }
        if (parity) errorPos |= pos;
    }
    if (errorPos) {
        bits[errorPos - 1] = bits[errorPos - 1] ^ 1;
    }
    // extract data bits (positions that are not powers of two)
    const dataBits = [];
    for (let i = 1; i <= n; i++) {
        if ((i & (i - 1)) !== 0) dataBits.push(bits[i - 1]);
    }
    return parseInt(dataBits.join(''), 2) || 0;
}

function solveRLE(s) {
    let result = "";
    for (let i = 0; i < s.length; i++) {
        let count = 1;
        while (i + count < s.length && s[i] === s[i + count]) count++;
        result += count + s[i];
        i += count - 1;
    }
    return result;
}

function solveLZDecompress(encoded) {
    // Try to handle the common contract format: array of [index, char] pairs
    try {
        if (typeof encoded === 'string') return encoded;
        if (Array.isArray(encoded)) {
            const dict = [''];
            let out = '';
            for (const pair of encoded) {
                if (!Array.isArray(pair) || pair.length < 2) continue;
                const idx = Number(pair[0]);
                const ch = String(pair[1]);
                const entry = (idx === 0 ? '' : dict[idx]) + ch;
                out += entry;
                dict.push(entry);
            }
            return out;
        }
    } catch (e) {
        return '';
    }
    return '';
}

function solveCaesarCipher([text, shift]) {
    shift = ((shift % 26) + 26) % 26;
    const out = [];
    for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (code >= 65 && code <= 90) {
            out.push(String.fromCharCode(65 + (code - 65 + shift) % 26));
        } else if (code >= 97 && code <= 122) {
            out.push(String.fromCharCode(97 + (code - 97 + shift) % 26));
        } else {
            out.push(ch);
        }
    }
    return out.join('');
}

function solveVigenereCipher([text, key]) {
    let result = "";
    for (let i = 0, j = 0; i < text.length; i++) {
        const c = text[i];
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
            const shift = key[(j++) % key.length].toUpperCase().charCodeAt(0) - 65;
            result += String.fromCharCode(65 + (code - 65 + shift) % 26);
        } else if (code >= 97 && code <= 122) {
            const shift = key[(j++) % key.length].toLowerCase().charCodeAt(0) - 97;
            result += String.fromCharCode(97 + (code - 97 + shift) % 26);
        } else {
            result += c;
        }
    }
    return result;
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
