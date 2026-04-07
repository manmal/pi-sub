import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as path from "node:path";
import {
	CACHE_PATH,
	fetchWithCache,
	getCachedData,
	onCacheSnapshot,
	onCacheUpdate,
	readCache,
	watchCacheUpdates,
} from "../src/cache.js";
import { getCacheLockPath } from "../src/paths.js";

const LOCK_PATH = getCacheLockPath();

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withCacheFiles(fn: () => Promise<void> | void): Promise<void> {
	const cacheDir = path.dirname(CACHE_PATH);
	const lockDir = path.dirname(LOCK_PATH);
	fs.mkdirSync(cacheDir, { recursive: true });
	fs.mkdirSync(lockDir, { recursive: true });

	const cacheExists = fs.existsSync(CACHE_PATH);
	const lockExists = fs.existsSync(LOCK_PATH);
	const cacheBackup = cacheExists ? fs.readFileSync(CACHE_PATH, "utf-8") : null;
	const lockBackup = lockExists ? fs.readFileSync(LOCK_PATH, "utf-8") : null;

	try {
		await fn();
	} finally {
		if (lockBackup !== null) {
			fs.writeFileSync(LOCK_PATH, lockBackup, "utf-8");
		} else if (fs.existsSync(LOCK_PATH)) {
			fs.unlinkSync(LOCK_PATH);
		}
		if (cacheBackup !== null) {
			fs.writeFileSync(CACHE_PATH, cacheBackup, "utf-8");
		} else if (fs.existsSync(CACHE_PATH)) {
			fs.unlinkSync(CACHE_PATH);
		}
	}
}

test("readCache recovers from truncated JSON", async () => {
	await withCacheFiles(() => {
		const cacheValue = {
			copilot: {
				fetchedAt: 123,
				usage: {
					provider: "copilot",
					displayName: "Copilot Plan",
					windows: [],
				},
			},
		};
		const corrupted = `${JSON.stringify(cacheValue)}garbage`;
		fs.writeFileSync(CACHE_PATH, corrupted, "utf-8");

		const cache = readCache();
		assert.equal(cache.copilot?.fetchedAt, 123);

		const repaired = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as typeof cacheValue;
		assert.ok(repaired.copilot);
	});
});

test("getCachedData returns entry when cache keys match", async () => {
	const now = Date.now();
	const entry = {
		fetchedAt: now,
		cacheKey: "codex:account:abc",
		usage: { provider: "codex" as const, displayName: "Codex", windows: [] },
	};
	const cache = { codex: entry };

	const result = await getCachedData("codex", 60_000, cache, "codex:account:abc");
	assert.equal(result, entry);
});

test("getCachedData rejects entry when cache key mismatches", async () => {
	const now = Date.now();
	const cache = {
		codex: {
			fetchedAt: now,
			cacheKey: "codex:account:old",
			usage: { provider: "codex" as const, displayName: "Codex", windows: [] },
		},
	};

	const result = await getCachedData("codex", 60_000, cache, "codex:account:new");
	assert.equal(result, null);
});

test("getCachedData rejects legacy no-key entry when expected key exists", async () => {
	const now = Date.now();
	const cache = {
		codex: {
			fetchedAt: now,
			usage: { provider: "codex" as const, displayName: "Codex", windows: [] },
		},
	};

	const result = await getCachedData("codex", 60_000, cache, "codex:account:abc");
	assert.equal(result, null);
});

test("fetchWithCache lock recheck ignores mismatched cache key", async () => {
	await withCacheFiles(async () => {
		const now = Date.now();
		const staleCache = {
			codex: {
				fetchedAt: now,
				cacheKey: "codex:account:old",
				usage: { provider: "codex", displayName: "Codex", windows: [] },
			},
		};
		fs.writeFileSync(CACHE_PATH, JSON.stringify(staleCache), "utf-8");
		fs.writeFileSync(LOCK_PATH, String(now), "utf-8");

		setTimeout(() => {
			if (fs.existsSync(LOCK_PATH)) {
				fs.unlinkSync(LOCK_PATH);
			}
		}, 50);

		let fetchCalls = 0;
		const result = await fetchWithCache(
			"codex",
			60_000,
			async () => {
				fetchCalls += 1;
				return {
					usage: {
						provider: "codex" as const,
						displayName: "Codex",
						windows: [{ label: "5h", usedPercent: 25 }],
					},
				};
			},
			{ cacheKey: "codex:account:new" },
		);

		assert.equal(fetchCalls, 1);
		assert.equal(result.usage?.windows[0]?.usedPercent, 25);
	});
});

test("watchCacheUpdates waits for lock release", async () => {
	await withCacheFiles(async () => {
		fs.writeFileSync(CACHE_PATH, "{}", "utf-8");
		fs.writeFileSync(LOCK_PATH, String(Date.now()), "utf-8");

		const snapshots: Array<Record<string, unknown>> = [];
		const updates: Array<string> = [];
		const offSnapshot = onCacheSnapshot((cache) => snapshots.push(cache));
		const offUpdate = onCacheUpdate((provider) => updates.push(provider));
		const stop = watchCacheUpdates({ debounceMs: 5, pollIntervalMs: 20, lockRetryMs: 50 });

		const cacheValue = {
			copilot: {
				fetchedAt: Date.now(),
				usage: { provider: "copilot", displayName: "Copilot", windows: [] },
			},
		};
		fs.writeFileSync(CACHE_PATH, JSON.stringify(cacheValue), "utf-8");

		await wait(40);
		assert.equal(snapshots.length, 0);

		fs.unlinkSync(LOCK_PATH);
		await wait(80);

		stop();
		offSnapshot();
		offUpdate();

		assert.ok(snapshots.length > 0);
		assert.ok(updates.includes("copilot"));
	});
});
