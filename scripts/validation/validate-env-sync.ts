#!/usr/bin/env bun
/**
 * Validates that shared env vars across multiple .env files have identical values.
 * Catches drift where JWT_SECRET in .env.local differs from apps/web/.env.production, etc.
 *
 * Run: bun run check:env-sync
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const ENV_FILES = [
	"apps/web/.env.production",
	"apps/api/.env.production",
	"apps/shell-server-go/.env.production",
	".env.local",
];

// Variables that intentionally differ across apps (not drift)
const EXPECTED_DIFFER = new Set([
	"PORT", // Each app runs on its own port
	"ALIVE_ENV", // local vs production vs staging
	"ALIVE_PASSCODE", // Dev passcode differs from production
]);

function parseEnvFile(
	filePath: string,
): Map<string, string> {
	const vars = new Map<string, string>();
	const content = readFileSync(filePath, "utf-8");

	for (const rawLine of content.split("\n")) {
		const line = rawLine.trim();

		// Skip empty lines and comments
		if (line === "" || line.startsWith("#")) continue;

		// Match KEY=VALUE, handling optional quotes around the value
		const eqIndex = line.indexOf("=");
		if (eqIndex === -1) continue;

		const key = line.slice(0, eqIndex).trim();
		let value = line.slice(eqIndex + 1).trim();

		// Strip surrounding quotes (single or double)
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		// Skip export prefix
		const cleanKey = key.startsWith("export ")
			? key.slice("export ".length).trim()
			: key;

		if (cleanKey !== "") {
			vars.set(cleanKey, value);
		}
	}

	return vars;
}

// ── Main ──

// Resolve and filter to files that exist
const resolvedFiles: Array<{ relative: string; absolute: string }> = [];
for (const rel of ENV_FILES) {
	const abs = resolve(ROOT, rel);
	if (existsSync(abs)) {
		resolvedFiles.push({ relative: rel, absolute: abs });
	}
}

if (resolvedFiles.length < 2) {
	console.log(
		`check:env-sync -- fewer than 2 env files found (${resolvedFiles.length}), nothing to compare. OK`,
	);
	process.exit(0);
}

console.log(
	`check:env-sync -- comparing ${resolvedFiles.length} env files:\n${resolvedFiles.map((f) => `  ${f.relative}`).join("\n")}\n`,
);

// Parse all files
const fileVars = new Map<string, Map<string, string>>();
for (const f of resolvedFiles) {
	fileVars.set(f.relative, parseEnvFile(f.absolute));
}

// Build a map: varName -> { file -> value }
const allVars = new Map<string, Map<string, string>>();
for (const [file, vars] of fileVars) {
	for (const [key, value] of vars) {
		if (!allVars.has(key)) {
			allVars.set(key, new Map());
		}
		allVars.get(key)!.set(file, value);
	}
}

// Check vars that appear in 2+ files
const mismatches: Array<{ key: string; files: Map<string, string> }> = [];
const redundant: Array<{ key: string; files: string[] }> = [];

for (const [key, filesWithValue] of allVars) {
	if (filesWithValue.size < 2) continue;
	if (EXPECTED_DIFFER.has(key)) continue;

	const values = new Set(filesWithValue.values());
	if (values.size === 1) {
		// Same value everywhere -- redundant duplicate (warning)
		redundant.push({ key, files: Array.from(filesWithValue.keys()) });
	} else {
		// Different values -- mismatch (error)
		mismatches.push({ key, files: filesWithValue });
	}
}

// Report redundant duplicates (warnings)
if (redundant.length > 0) {
	console.log(`Warnings (${redundant.length} redundant duplicates):`);
	for (const { key, files } of redundant.sort((a, b) =>
		a.key.localeCompare(b.key),
	)) {
		console.log(`  WARNING: ${key} -- identical value in ${files.length} files: ${files.join(", ")}`);
	}
	console.log();
}

// Report mismatches (errors)
if (mismatches.length > 0) {
	console.log(`Errors (${mismatches.length} mismatches):`);
	for (const { key, files } of mismatches.sort((a, b) =>
		a.key.localeCompare(b.key),
	)) {
		console.log(`  MISMATCH: ${key}`);

		// Group files by their value (without revealing the value)
		const groups = new Map<string, string[]>();
		for (const [file, value] of files) {
			// Use a hash-like identifier so we can show grouping without revealing secrets
			if (!groups.has(value)) {
				groups.set(value, []);
			}
			groups.get(value)!.push(file);
		}

		let groupIdx = 1;
		for (const [, groupFiles] of groups) {
			console.log(`    value #${groupIdx}: ${groupFiles.join(", ")}`);
			groupIdx++;
		}
	}
	console.log();
	console.log(
		"FAILED: env var drift detected. Fix the mismatches above so shared vars have identical values.",
	);
	process.exit(1);
}

// All good
if (redundant.length > 0) {
	console.log(
		`OK (${redundant.length} redundant duplicate(s) -- consider consolidating)`,
	);
} else {
	console.log("OK -- no shared env vars with conflicting values.");
}
process.exit(0);
