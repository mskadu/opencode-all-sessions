// opencode-all-sessions plugin
// Lists all sessions across projects and opens a new terminal on selection.

const SENTINEL = "__ALL_SESSIONS_COMMAND_HANDLED__"

function text(text) {
  return { type: "text", text }
}

function relativeAge(ms) {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function truncatePath(p, maxLen) {
  const cleaned = p.replace(/^\/Users\/[^/]+/, "~")
  if (cleaned.length <= maxLen) return cleaned
  const parts = cleaned.split("/")
  return `.../${parts.slice(-3).join("/")}`
}

function formatLine(idx, session) {
  const title = session.title || session.slug || "(untitled)"
  const dir = truncatePath(session.directory || session.path || "", 45)
  const age = session.time_created ? relativeAge(session.time_created) : ""
  const shortId = session.id ? session.id.slice(0, 8) : ""
  return [
    `  ${String(idx).padStart(3)}. ${shortId.padEnd(9)} ${title}`,
    `       ${dir.padEnd(45)} ${age}`,
  ].join("\n")
}

function getSessions(resp) {
  if (Array.isArray(resp)) return resp
  if (resp?.data && Array.isArray(resp.data)) return resp.data
  return []
}

async function sendResponse(client, sessionID, message) {
  await client.session.prompt({
    path: { id: sessionID },
    body: {
      noReply: true,
      parts: [text(message)],
    },
  })
}

const AllSessionsPlugin = async ({ client, $ }) => {
  return {
    async config(config) {
      config.command ??= {}
      config.command["all-sessions"] = {
        template: "$ARGUMENTS",
        description:
          "List all sessions across projects. Usage: /all-sessions, /all-sessions <n>, /all-sessions --id <sessionID>",
      }
    },

    async "command.execute.before"(input) {
      if (input.command !== "all-sessions") return
      const args = (input.arguments || "").trim()
      const sessionID = input.sessionID

      let sessions
      try {
        const resp = await client.session.list({
          directory: "",
          roots: true,
        })
        sessions = getSessions(resp)
      } catch (e) {
        try {
          const resp = await client.session.list()
          sessions = getSessions(resp)
        } catch (e2) {
          await sendResponse(client, sessionID, `Failed to list sessions: ${e2.message}`)
          throw new Error(SENTINEL)
        }
      }

      if (!sessions || sessions.length === 0) {
        await sendResponse(client, sessionID, "No sessions found.")
        throw new Error(SENTINEL)
      }

      sessions.sort(
        (a, b) => (b.time_created ?? 0) - (a.time_created ?? 0),
      )

      const idMatch = args.match(/^--id\s+(\S+)/)
      const numMatch = args.match(/^(\d+)$/)

      let selectedSession = null

      if (idMatch) {
        const sid = idMatch[1]
        selectedSession = sessions.find((s) => s.id === sid)
        if (!selectedSession) {
          await sendResponse(client, sessionID, `Session "${sid}" not found.`)
          throw new Error(SENTINEL)
        }
      } else if (numMatch) {
        const idx = parseInt(numMatch[1], 10)
        if (idx < 1 || idx > sessions.length) {
          await sendResponse(client, sessionID, `Index out of range. Use 1-${sessions.length}.`)
          throw new Error(SENTINEL)
        }
        selectedSession = sessions[idx - 1]
      }

      if (selectedSession) {
        const title = selectedSession.title || selectedSession.slug || "session"
        const dir = selectedSession.directory || selectedSession.path || ""

        if (!dir) {
          await sendResponse(client, sessionID, `Session "${title}" has no directory — launch not possible.`)
          throw new Error(SENTINEL)
        }

        const escapedDir = dir.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        let launched = false

        try {
          const termProgram = process.env.TERM_PROGRAM || ""
          if (termProgram === "iTerm.app") {
            await $`osascript -e 'tell application "iTerm" to create window with default profile command "opencode ${escapedDir}"'`
          } else {
            await $`osascript -e 'tell application "Terminal" to do script "cd ${escapedDir} && opencode"'`
          }
          launched = true
        } catch (e) {
          const msg = `Session: "${title}" (${selectedSession.id})\nDirectory: ${dir}\n\nCould not auto-launch a new terminal. Run \`opencode ${dir}\` manually.`
          await sendResponse(client, sessionID, msg)
          throw new Error(SENTINEL)
        }

        if (launched) {
          const termName = (process.env.TERM_PROGRAM || "Terminal").includes("iTerm") ? "iTerm" : "Terminal"
          await sendResponse(client, sessionID, `Launched "${title}" in a new ${termName} window (${dir}).\nClose this session when ready.`)
        }
        throw new Error(SENTINEL)
      }

      const lines = [
        `Sessions (${sessions.length} total):`,
        "",
      ]

      sessions.forEach((s, i) => {
        lines.push(formatLine(i + 1, s))
      })

      lines.push(
        "",
        `Resume: /all-sessions <number> or /all-sessions --id <sessionID>`,
      )

      await sendResponse(client, sessionID, lines.join("\n"))
      throw new Error(SENTINEL)
    },
  }
}

export { AllSessionsPlugin }
export default AllSessionsPlugin
