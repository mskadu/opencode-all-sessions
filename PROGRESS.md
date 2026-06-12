# Progress Report

## What works

- `/all-sessions` slash command is registered and handled by the plugin (not the AI agent)
- Session list displays with index numbers, ages, and truncated paths
- Index-based selection (`/all-sessions 1`) works — launches a new terminal window
- `--id` selector works (`/all-sessions --id ses_xxxx`)
- Terminal.app and iTerm2 are both supported
- Fallback message shown if AppleScript launch fails
- Sentinel error pattern cleanly aborts agent processing (no Bun crashes)

## What's broken — session list is scoped by directory

`client.session.list()` only returns sessions whose path is under the current directory. Running `/all-sessions` from `~/Downloads` shows 2 sessions (the ones started in `~/Downloads`), not the full 109 in the database.

Root cause: the OpenCode SDK client has the current directory baked in and passes it as a filter on every API call. We tried `{ directory: "", roots: true }` but the SDK still scopes the results.

## Next steps to fix

The `serverUrl` is available in the plugin input — we can use `fetch` to call the OpenCode HTTP API directly at `{serverUrl}/session` without a directory filter. This needs verification of:
1. The `serverUrl` value (URL format, auth requirements)
2. The HTTP API's `/session` endpoint schema
3. Whether it returns all sessions unfiltered

## Plugin architecture

- Plugin lives at `~/.opencode/plugins/all-sessions.js` (auto-discovered by OpenCode, same as `graphify.js`)
- Build output is plain JS (no npm dependencies — OpenCode plugin loader doesn't resolve them for file-based plugins)
- TypeScript source at `src/index.ts`
- Tests: 23 unit + 13 plugin (vitest)
- CI: typecheck + test on push, path-filtered to `src/`, `tsconfig.json`, `vitest.config.ts`, workflow file
- GitHub repo: `mskadu/opencode-all-sessions` (public, MIT)
- Upstream feature request: `anomalyco/opencode#31932`
