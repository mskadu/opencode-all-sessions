import { describe, it, expect, vi, afterEach } from "vitest"
import { AllSessionsPlugin } from "../index"

function makeClient(sessions: any[]) {
  return {
    session: {
      list: vi.fn().mockResolvedValue(sessions),
      prompt: vi.fn().mockResolvedValue({}),
    },
  }
}

function make$(value?: string) {
  return vi.fn().mockResolvedValue(value ?? "")
}

function makeInput(overrides?: Record<string, unknown>) {
  return {
    command: "all-sessions",
    arguments: "",
    sessionID: "ses_test",
    ...overrides,
  } as any
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("config hook", () => {
  it("registers the all-sessions command", async () => {
    const plugin = await AllSessionsPlugin({
      client: makeClient([]),
      $: make$(),
    })
    const config: Record<string, any> = {}
    await plugin.config(config)
    expect(config.command["all-sessions"]).toBeDefined()
    expect(config.command["all-sessions"].template).toBe("$ARGUMENTS")
    expect(config.command["all-sessions"].description).toContain(
      "List all sessions",
    )
  })
})

describe("command.execute.before", () => {
  it("ignores non-matching commands", async () => {
    const plugin = await AllSessionsPlugin({
      client: makeClient([]),
      $: make$(),
    })
    await expect(
      plugin["command.execute.before"]({ command: "other-cmd", arguments: "" } as any),
    ).resolves.toBeUndefined()
  })

  it("lists sessions when no args given", async () => {
    const sessions = [
      { id: "a", title: "Session A", directory: "/p1" },
      { id: "b", title: "Session B", directory: "/p2" },
    ]
    const client = makeClient(sessions)
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    await expect(
      plugin["command.execute.before"](makeInput()),
    ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
    const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
    expect(text).toContain("Sessions (2 total)")
    expect(text).toContain("Session A")
    expect(text).toContain("Session B")
  })

  it("sorts sessions by time_created descending", async () => {
    const sessions = [
      { id: "old", title: "Old", time_created: 100 },
      { id: "new", title: "New", time_created: 200 },
    ]
    const client = makeClient(sessions)
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    await expect(
      plugin["command.execute.before"](makeInput()),
    ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
    const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
    expect(text.indexOf("New")).toBeLessThan(text.indexOf("Old"))
  })

  it("handles client failure gracefully", async () => {
    const client = {
      session: {
        list: vi.fn().mockRejectedValue(new Error("network error")),
        prompt: vi.fn().mockResolvedValue({}),
      },
    }
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    await expect(
      plugin["command.execute.before"](makeInput()),
    ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
    const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
    expect(text).toContain("network error")
  })

  it("reports empty session list", async () => {
    const client = makeClient([])
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    await expect(
      plugin["command.execute.before"](makeInput()),
    ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
    const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
    expect(text).toBe("No sessions found.")
  })

  it("rejects out-of-range index", async () => {
    const sessions = [{ id: "a", title: "Only" }]
    const client = makeClient(sessions)
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    await expect(
      plugin["command.execute.before"](makeInput({ arguments: "5" })),
    ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
    const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
    expect(text).toContain("out of range")
  })

  it("rejects unmatched --id", async () => {
    const sessions = [{ id: "real-id", title: "Real" }]
    const client = makeClient(sessions)
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    await expect(
      plugin["command.execute.before"](makeInput({ arguments: "--id missing-id" })),
    ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
    const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
    expect(text).toContain("not found")
  })

  it("shows error when session has no directory", async () => {
    const sessions = [
      { id: "a", title: "Dirless", directory: "", path: "" },
    ]
    const client = makeClient(sessions)
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    await expect(
      plugin["command.execute.before"](makeInput({ arguments: "1" })),
    ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
    const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
    expect(text).toContain("no directory")
  })

  describe("terminal launch", () => {
    it("launches iTerm when TERM_PROGRAM=iTerm.app", async () => {
      vi.stubEnv("TERM_PROGRAM", "iTerm.app")
      const mock$ = vi.fn().mockResolvedValue("")
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const client = makeClient(sessions)
      const plugin = await AllSessionsPlugin({ client, $: mock$ })
      await expect(
        plugin["command.execute.before"](makeInput({ arguments: "1" })),
      ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
      expect(mock$).toHaveBeenCalled()
      const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
      expect(text).toContain("Launched")
      expect(text).toContain("iTerm")
    })

    it("launches Terminal when TERM_PROGRAM is empty", async () => {
      vi.stubEnv("TERM_PROGRAM", "")
      const mock$ = vi.fn().mockResolvedValue("")
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const client = makeClient(sessions)
      const plugin = await AllSessionsPlugin({ client, $: mock$ })
      await expect(
        plugin["command.execute.before"](makeInput({ arguments: "1" })),
      ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
      expect(mock$).toHaveBeenCalled()
      const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
      expect(text).toContain("Launched")
      expect(text).toContain("Terminal")
    })

    it("launches Terminal when TERM_PROGRAM is tmux", async () => {
      vi.stubEnv("TERM_PROGRAM", "tmux")
      const mock$ = vi.fn().mockResolvedValue("")
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const client = makeClient(sessions)
      const plugin = await AllSessionsPlugin({ client, $: mock$ })
      await expect(
        plugin["command.execute.before"](makeInput({ arguments: "1" })),
      ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
      expect(mock$).toHaveBeenCalled()
      const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
      expect(text).toContain("Terminal")
    })

    it("shows fallback message when AppleScript fails", async () => {
      vi.stubEnv("TERM_PROGRAM", "iTerm.app")
      const mock$ = vi.fn().mockRejectedValue(new Error("osascript failed"))
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const client = makeClient(sessions)
      const plugin = await AllSessionsPlugin({ client, $: mock$ })
      await expect(
        plugin["command.execute.before"](makeInput({ arguments: "1" })),
      ).rejects.toThrow("__ALL_SESSIONS_COMMAND_HANDLED__")
      const text = client.session.prompt.mock.lastCall?.[0]?.body?.parts?.[0]?.text ?? ""
      expect(text).toContain("Could not auto-launch")
      expect(text).toContain("opencode /Users/me/proj")
    })
  })
})
