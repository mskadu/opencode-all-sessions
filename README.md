# opencode-all-sessions

OpenCode TUI plugin — list and jump to sessions across all projects from anywhere.

## Problem

OpenCode's built-in `/sessions` command is scoped to the current project. If you're in `~/Downloads` or need to find a session from another repo, there's no way to discover or resume it without navigating there first.

`/all-sessions` lists every session across all projects, then opens a new terminal in the correct directory with one selection.

## Install

Add the plugin to your OpenCode config:

```json
{
  "plugin": ["mskadu/opencode-all-sessions"]
}
```

Or install from the OpenCode command palette (`Ctrl+P` → Install Plugin → `opencode-all-sessions`).

## Usage

| Command | Description |
|---|---|
| `/all-sessions` | List all sessions across projects, most recent first |
| `/all-sessions 3` | Resume the 3rd session in the list |
| `/all-sessions --id <sessionID>` | Resume a specific session by ID |

On selection, a new terminal window opens running `opencode <session.directory>`, and the current TUI session exits.

A new terminal is necessary because OpenCode does not expose an API to change its working directory at runtime (see [#6697](https://github.com/anomalyco/opencode/issues/6697), [#1143](https://github.com/anomalyco/opencode/issues/1143)). Without that, the only way to resume a session in a different project is to spawn a fresh process in that directory.

A feature request for native cross-project session support -- including a runtime directory API -- has been filed at
[anomalyco/opencode#31932](https://github.com/anomalyco/opencode/issues/31932). If that lands, this plugin's workaround becomes unnecessary for the directory-switching piece.
