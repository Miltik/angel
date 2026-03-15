/**
 * Contracts Worker - Full logic for Coding Contracts
	let count = 0;
	let contractsFound = 0;
	let unsupported = 0;
	let scanned = 0;
	let rooted = 0;
	let alreadyRooted = 0;
	let needsRoot = 0;
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
		case "Proper 2-Coloring of a Graph":
			solution = solveProper2Coloring(contractData);
			break;
		default:
			unsupported++;
			ui.log(`No solver implemented for: ${contractType} (${server})`, "warn");
			break;
	}
}

// Solver for Proper 2-Coloring of a Graph
function solveProper2Coloring([n, edges]) {
	// n: number of nodes, edges: array of [u, v] pairs (0-indexed)
	// Returns: array of 0/1 colors if possible, or [] if not possible
	const adj = Array.from({ length: n }, () => []);
	for (const [u, v] of edges) {
		adj[u].push(v);
		adj[v].push(u);
	}
	const color = Array(n).fill(-1);
	for (let start = 0; start < n; start++) {
		if (color[start] !== -1) continue;
		const queue = [start];
		color[start] = 0;
		while (queue.length) {
			const u = queue.shift();
			for (const v of adj[u]) {
				if (color[v] === -1) {
					color[v] = 1 - color[u];
					queue.push(v);
				} else if (color[v] === color[u]) {
					return [];
				}
			}
		}
	}
	return color;
}

// Solver for HammingCodes: Encoded Binary to Integer
function solveHammingDecode(data) {
	// Handles both space-separated blocks and single bitstring
	if (typeof data !== 'string') return 0;
	data = data.trim();
	let blocks = data.includes(' ') ? data.split(/\s+/) : [data];
	let decodedBits = [];
	for (let block of blocks) {
		const bits = block.split('').map(Number);
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
		// Extract data bits (positions that are not powers of 2)
		for (let i = 1; i <= n; i++) {
			if ((i & (i - 1)) !== 0) {
				decodedBits.push(bits[i - 1]);
			}
		}
	}
	return parseInt(decodedBits.join(''), 2);
}
