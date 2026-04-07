/**
 * Shared Codex credential loading.
 */

import * as path from "node:path";
import type { Dependencies } from "../../types.js";

export interface CodexCredentials {
	accessToken?: string;
	accountId?: string;
}

function toNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

/**
 * Load Codex credentials from environment, Pi auth.json, then legacy Codex auth.
 */
export function loadCodexCredentials(deps: Dependencies): CodexCredentials {
	const envAccessToken = (
		deps.env.OPENAI_CODEX_OAUTH_TOKEN ||
		deps.env.OPENAI_CODEX_ACCESS_TOKEN ||
		deps.env.CODEX_OAUTH_TOKEN ||
		deps.env.CODEX_ACCESS_TOKEN
	)?.trim();
	const envAccountId = (deps.env.OPENAI_CODEX_ACCOUNT_ID || deps.env.CHATGPT_ACCOUNT_ID)?.trim();
	if (envAccessToken) {
		return { accessToken: envAccessToken, accountId: envAccountId || undefined };
	}

	const piAuthPath = deps.getAuthPath();
	try {
		if (deps.fileExists(piAuthPath)) {
			const data = JSON.parse(deps.readFile(piAuthPath) ?? "{}");
			const codex = data["openai-codex"];
			const accessToken = toNonEmptyString(codex?.access);
			if (accessToken) {
				return {
					accessToken,
					accountId: toNonEmptyString(codex?.accountId),
				};
			}
		}
	} catch {
		// Ignore parse errors, try legacy location
	}

	const codexHome = deps.env.CODEX_HOME || path.join(deps.homedir(), ".codex");
	const authPath = path.join(codexHome, "auth.json");
	try {
		if (deps.fileExists(authPath)) {
			const data = JSON.parse(deps.readFile(authPath) ?? "{}");
			const apiKey = toNonEmptyString(data.OPENAI_API_KEY);
			if (apiKey) {
				return { accessToken: apiKey };
			}
			const accessToken = toNonEmptyString(data.tokens?.access_token);
			if (accessToken) {
				return {
					accessToken,
					accountId: toNonEmptyString(data.tokens?.account_id),
				};
			}
		}
	} catch {
		// Ignore parse errors
	}

	return {};
}
