---
"@marckrenn/pi-sub-core": patch
---

Resolve `auth.json` from the active agent directory (default `~/.pi/agent`) instead of hardcoding `~/.pi/agent/auth.json`, so credential lookup respects `PI_CODING_AGENT_DIR` overrides. Also scope Codex cache entries to credential identity (`accountId`/token hash) so stale cache from another account is ignored.
