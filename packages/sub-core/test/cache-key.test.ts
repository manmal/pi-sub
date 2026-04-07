import test from "node:test";
import assert from "node:assert/strict";
import { getProviderCacheKey } from "../src/providers/cache-key.js";
import { createDeps } from "./helpers.js";

test("codex cache key prefers account identity", () => {
	const { deps } = createDeps({
		env: {
			OPENAI_CODEX_OAUTH_TOKEN: "token-123",
			OPENAI_CODEX_ACCOUNT_ID: "acct_abc",
		},
	});

	const cacheKey = getProviderCacheKey("codex", deps);
	assert.equal(cacheKey, "codex:account:acct_abc");
});

test("codex cache key falls back to hashed token identity", () => {
	const { deps } = createDeps({
		env: {
			OPENAI_CODEX_OAUTH_TOKEN: "token-xyz",
		},
	});

	const cacheKey = getProviderCacheKey("codex", deps);
	assert.ok(cacheKey?.startsWith("codex:token:"));
	assert.notEqual(cacheKey, "codex:token:token-xyz");
	assert.equal(cacheKey, getProviderCacheKey("codex", deps));
});

test("codex cache key resolves account from active auth.json", () => {
	const { deps, files } = createDeps();
	files.set(
		deps.getAuthPath(),
		JSON.stringify({
			"openai-codex": {
				access: "auth-token",
				accountId: "acct_from_auth",
			},
		}),
	);

	const cacheKey = getProviderCacheKey("codex", deps);
	assert.equal(cacheKey, "codex:account:acct_from_auth");
});

test("codex cache key ignores malformed account ids and falls back to token hash", () => {
	const { deps, files } = createDeps();
	files.set(
		deps.getAuthPath(),
		JSON.stringify({
			"openai-codex": {
				access: "auth-token",
				accountId: { bad: true },
			},
		}),
	);

	const cacheKey = getProviderCacheKey("codex", deps);
	assert.ok(cacheKey?.startsWith("codex:token:"));
});

test("codex cache key marks missing credentials explicitly", () => {
	const { deps } = createDeps();
	assert.equal(getProviderCacheKey("codex", deps), "codex:missing");
});

test("non-codex providers do not use cache keys yet", () => {
	const { deps } = createDeps({
		env: { OPENAI_CODEX_OAUTH_TOKEN: "token-xyz" },
	});
	assert.equal(getProviderCacheKey("anthropic", deps), undefined);
	assert.equal(getProviderCacheKey("copilot", deps), undefined);
});
