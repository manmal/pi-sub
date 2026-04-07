import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { createDefaultDependencies } from "../src/dependencies.js";

function withEnvVar(name: string, value: string | undefined, run: () => void): void {
	const previous = process.env[name];
	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
	try {
		run();
	} finally {
		if (previous === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = previous;
		}
	}
}

test("createDefaultDependencies resolves auth path from PI_CODING_AGENT_DIR", () => {
	withEnvVar("PI_CODING_AGENT_DIR", "/tmp/pi-sub-custom-agent", () => {
		const deps = createDefaultDependencies();
		assert.equal(deps.getAuthPath(), "/tmp/pi-sub-custom-agent/auth.json");
	});
});

test("createDefaultDependencies falls back to default agent directory", () => {
	withEnvVar("PI_CODING_AGENT_DIR", undefined, () => {
		const deps = createDefaultDependencies();
		assert.equal(deps.getAuthPath(), path.join(os.homedir(), ".pi", "agent", "auth.json"));
	});
});
