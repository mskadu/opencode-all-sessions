import type { Plugin } from "@opencode-ai/plugin"

export function text(text: string): any {
  return { type: "text" as const, text }
}

export function relativeAge(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function truncatePath(p: string, maxLen: number): string {
  const cleaned = p.replace(/^\/Users\/[^/]+/, "~")
  if (cleaned.length <= maxLen) return cleaned
  const parts = cleaned.split("/")
  return `.../${parts.slice(-3).join("/")}`
}

export function formatLine(idx: number, session: any): string {
  const title = session.title || session.slug || "(untitled)"
  const dir = truncatePath(session.directory || session.path || "", 45)
  const age = session.time_created ? relativeAge(session.time_created) : ""
  const shortId = session.id ? session.id.slice(0, 8) : ""
  return [
    `  ${String(idx).padStart(3)}. ${shortId.padEnd(9)} ${title}`,
    `       ${dir.padEnd(45)} ${age}`,
  ].join("\n")
}

export function getSessions(resp: any): any[] {
  if (Array.isArray(resp)) return resp
  if (resp?.data && Array.isArray(resp.data)) return resp.data
  return []
}

export const AllSessionsPlugin: Plugin = async ({ client, $ }) => {
  return {
    async config(config) {
      config.command ??= {}
      config.command["all-sessions"] = {
        template: "$ARGUMENTS",
        description:
          "List all sessions across projects. Usage: /all-sessions, /all-sessions <n>, /all-sessions --id <sessionID>",
      }
    },

    async "command.execute.before"(input, output) {
      if (input.command !== "all-sessions") return
      const args = (input.arguments || "").trim()

      let sessions: any[]
      try {
        const resp = await client.session.list()
        sessions = getSessions(resp)
      } catch {
        output.parts = [text("Failed to list sessions.")]
        return
      }

      if (!sessions || sessions.length === 0) {
        output.parts = [text("No sessions found.")]
        return
      }

      sessions.sort(
        (a: any, b: any) => (b.time_created ?? 0) - (a.time_created ?? 0),
      )

      const idMatch = args.match(/^--id\s+(\S+)/)
      const numMatch = args.match(/^(\d+)$/)

      let selectedSession: any = null

      if (idMatch) {
        const sid = idMatch[1]
        selectedSession = sessions.find((s: any) => s.id === sid)
        if (!selectedSession) {
          output.parts = [text(`Session "${sid}" not found.`)]
          return
        }
      } else if (numMatch) {
        const idx = parseInt(numMatch[1], 10)
        if (idx < 1 || idx > sessions.length) {
          output.parts = [text(`Index out of range. Use 1-${sessions.length}.`)]
          return
        }
        selectedSession = sessions[idx - 1]
      }

      if (selectedSession) {
        const dir =
          selectedSession.directory || selectedSession.path || ""
        const title = selectedSession.title || selectedSession.slug || "session"

        if (!dir) {
          output.parts = [text(`Session "${title}" has no directory — cannot launch.`)]
          return
        }

        const termProgram = process.env.TERM_PROGRAM || ""
        const escapedDir = dir.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        let launched = false

        try {
          if (termProgram === "iTerm.app") {
            const script = [
              `tell application "iTerm"`,
              `  create window with default profile`,
              `  tell current session of current window`,
              `    write text "opencode ${escapedDir}"`,
              `  end tell`,
              `end tell`,
            ].join("\n")
            await $`osascript -e ${script}`
            launched = true
          } else if (
            termProgram === "tmux" ||
            termProgram === "WezTerm" ||
            !termProgram
          ) {
            await $`osascript -e 'tell application "Terminal" to do script "opencode ${escapedDir}"'`
            launched = true
          } else {
            await $`osascript -e 'tell application "Terminal" to do script "opencode ${escapedDir}"'`
            launched = true
          }
        } catch {
          output.parts = [
              text([
                `Switch to session "${title}":`,
                `  opencode ${dir}`,
                ``,
                `Could not auto-launch a new terminal window. Run the command above manually.`,
              ].join("\n")),
            ]
          return
        }

        if (launched) {
          output.parts = [text(`Switched to "${title}" in ${dir}.`)]
          setTimeout(() => process.exit(0), 500)
        }
        return
      }

      const lines: string[] = [
        `Sessions (${sessions.length} total):`,
        "",
      ]

      sessions.forEach((s: any, i: number) => {
        lines.push(formatLine(i + 1, s))
      })

      lines.push(
        "",
        `Resume: /all-sessions <number> or /all-sessions --id <sessionID>`,
      )

      output.parts = [text(lines.join("\n"))]
    },
  }
}

export default {
  id: "opencode-all-sessions",
  server: AllSessionsPlugin,
}
