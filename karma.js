/**
 * karma.js
 * Simple Bitburner script to display your karma level
 * @param {NS} ns
 */
export async function main(ns) {
	// Retrieve the player's karma
	const karma = ns.heart.break();
	ns.tprint(`Your karma level is: ${karma}`);
}