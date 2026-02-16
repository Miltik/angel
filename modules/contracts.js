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
                    const reward = ns.codingcontract.attempt(solution, contractName, server);
                    if (reward) {
                        ui.log(`✅ ${contractType} on ${server}: ${reward}`, "success");
                        lastState.contractsSolved++;
                        lastState.totalRewards += parseInt(reward.match(/\$[\d,]+/) ? parseInt(reward.match(/\$[\d,]+/)[0].replace(/[$,]/g, "")) : 0);
                        count++;
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

function solveArrayJumping([numLeaps, maxJump]) {
    const n = numLeaps;
    const reachable = new Array(n).fill(false);
    reachable[0] = true;
    let furthest = 0;
    for (let i = 0; i < n; i++) {
        if (!reachable[i]) break;
        furthest = Math.max(furthest, i + maxJump);
        for (let j = i + 1; j <= Math.min(furthest, n - 1); j++) {
            reachable[j] = true;
        }
        if (furthest >= n - 1) return 1;
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
    const results = new Set();
    const backtrack = (str, open, close, index) => {
        if (index === s.length) {
            if (open === 0 && close === 0) results.add(str);
            return;
        }
        if (s[index] !== '(' && s[index] !== ')') {
            backtrack(str + s[index], open, close, index + 1);
        } else {
            if (s[index] === '(' && open > 0) backtrack(str + '(', open - 1, close, index + 1);
            if (s[index] === ')' && close > 0) backtrack(str + ')', open, close - 1, index + 1);
            backtrack(str, open, close, index + 1);
        }
    };
    let open = 0, close = 0;
    for (const c of s) {
        if (c === '(') open++;
        else if (c === ')') close = Math.max(close, open) - (open > 0 ? 1 : 0);
    }
    backtrack("", open, close, 0);
    return Array.from(results);
}

function solveMathExpressions([num, target]) {
    const results = new Set();
    const backtrack = (expr, index) => {
        if (index === num.length) {
            try {
                if (eval(expr) === target) results.add(expr);
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

function solveHammingEncode(num) {
    let binary = num.toString(2);
    const result = [];
    for (let i = 0; i < binary.length; i++) result[2 ** Math.floor(Math.log2(i + 1)) - 1 + i] = binary[i];
    return result.join("") + "0";
}

function solveHammingDecode(bin) {
    const bits = bin.split("").map(Number);
    let error = 0;
    for (let i = 0; i < Math.log2(bits.length); i++) {
        let sum = 0;
        for (let j = 0; j < bits.length; j++) if ((j + 1) & (1 << i)) sum ^= bits[j];
        error |= sum << i;
    }
    if (error) bits[error - 1] ^= 1;
    return parseInt(bits.filter((_, i) => (i + 1) & ((i + 1) - 1)).join(""), 2);
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
    const dict = {};
    for (let i = 0; i < 256; i++) dict[i] = String.fromCharCode(i);
    const data = encoded.split("").map(c => c.charCodeAt(0));
    let result = dict[data[0]];
    let dictSize = 256;
    for (let i = 1; i < data.length; i++) {
        const code = data[i];
        result += (code < dictSize ? dict[code] : dict[dictSize - 1] + dict[dictSize - 1][0]);
        dict[dictSize] = result.slice(-1 * (result.length - (i === 1 ? 1 : 0)));
        dictSize++;
    }
    return result;
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
    for (let i = 0, j = 0; i < text.length; i++) {
        const c = text[i];
        if (!c.match(/[a-z]/i)) result += c;
        else {
            const code = c.charCodeAt(0);
            const shift = key[(j++) % key.length].charCodeAt(0) - 65;
            const start = code >= 65 ? 65 : 97;
            result += String.fromCharCode(start + (code - start + shift) % 26);
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
