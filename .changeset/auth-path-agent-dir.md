---
"@marckrenn/pi-sub-core": patch
---

Resolve `auth.json` from the active agent directory (default `~/.pi/agent`) instead of hardcoding `~/.pi/agent/auth.json`. This makes provider credential lookup respect `PI_CODING_AGENT_DIR` overrides.
