/**
 * Provider-specific cache key resolution.
 *
 * Cache keys identify which credentials/account produced a cache entry.
 */

import { createHash } from "node:crypto";
import type { Dependencies, ProviderName } from "../types.js";
import { loadCodexCredentials } from "./impl/codex-auth.js";

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

function getCodexCacheKey(deps: Dependencies): string {
	const { accessToken, accountId } = loadCodexCredentials(deps);
	if (!accessToken) return "codex:missing";
	if (accountId) return `codex:account:${accountId}`;
	return `codex:token:${hashToken(accessToken)}`;
}

export function getProviderCacheKey(provider: ProviderName, deps: Dependencies): string | undefined {
	switch (provider) {
		case "codex":
			return getCodexCacheKey(deps);
		default:
			return undefined;
	}
}
