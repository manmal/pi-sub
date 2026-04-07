import path from "node:path";
import type { Dependencies } from "../src/types.js";

export type FetchResponse<T> = {
	ok: boolean;
	status: number;
	json: () => Promise<T>;
};

export function createJsonResponse<T>(data: T, init?: { ok?: boolean; status?: number }): FetchResponse<T> {
	return {
		ok: init?.ok ?? true,
		status: init?.status ?? 200,
		json: async () => data,
	};
}

export function createDeps(options?: {
	files?: Record<string, string>;
	fetch?: Dependencies["fetch"];
	execFileSync?: Dependencies["execFileSync"];
	env?: NodeJS.ProcessEnv;
	homedir?: string;
	authPath?: string;
}): { deps: Dependencies; files: Map<string, string> } {
	const files = new Map<string, string>(Object.entries(options?.files ?? {}));
	const homedir = options?.homedir ?? "/home/test";
	const env = options?.env ?? {};
	const defaultAgentDir = env.PI_CODING_AGENT_DIR ?? path.join(homedir, ".pi", "agent");
	const authPath = options?.authPath ?? path.join(defaultAgentDir, "auth.json");

	const deps: Dependencies = {
		fetch: options?.fetch
			?? (async () => {
				throw new Error("fetch not mocked");
			}),
		readFile: (filePath: string) => files.get(filePath),
		fileExists: (filePath: string) => files.has(filePath),
		execFileSync: options?.execFileSync
			?? (() => {
				throw new Error("execFileSync not mocked");
			}),
		homedir: () => homedir,
		getAuthPath: () => authPath,
		env,
	};

	return { deps, files };
}
