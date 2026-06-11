import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { AllSessionsPlugin } from "../index"

function makeClient(sessions: any[]) {
  return {
    session: { list: vi.fn().mockResolvedValue(sessions) },
  }
}

function make$(value?: string) {
  return vi.fn().mockResolvedValue(value ?? "")
}

function makeInput(overrides?: Record<string, unknown>) {
  return {
    command: "all-sessions",
    arguments: "",
    ...overrides,
  } as any
}

function makeOutput() {
  return { parts: [] as any[] }
}

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
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("ignores non-matching commands", async () => {
    const plugin = await AllSessionsPlugin({
      client: makeClient([]),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](
      { command: "other-cmd", arguments: "" } as any,
      output,
    )
    expect(output.parts).toEqual([])
  })

  it("lists sessions when no args given", async () => {
    const sessions = [
      { id: "a", title: "Session A", directory: "/p1" },
      { id: "b", title: "Session B", directory: "/p2" },
    ]
    const plugin = await AllSessionsPlugin({
      client: makeClient(sessions),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](makeInput(), output)
    expect(output.parts).toHaveLength(1)
    expect(output.parts[0].text).toContain("Sessions (2 total)")
    expect(output.parts[0].text).toContain("Session A")
    expect(output.parts[0].text).toContain("Session B")
  })

  it("sorts sessions by time_created descending", async () => {
    const sessions = [
      { id: "old", title: "Old", time_created: 100 },
      { id: "new", title: "New", time_created: 200 },
    ]
    const plugin = await AllSessionsPlugin({
      client: makeClient(sessions),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](makeInput(), output)
    const newIdx = output.parts[0].text.indexOf("New")
    const oldIdx = output.parts[0].text.indexOf("Old")
    expect(newIdx).toBeLessThan(oldIdx)
  })

  it("handles client failure gracefully", async () => {
    const client = {
      session: {
        list: vi.fn().mockRejectedValue(new Error("network error")),
      },
    }
    const plugin = await AllSessionsPlugin({ client, $: make$() })
    const output = makeOutput()
    await plugin["command.execute.before"](makeInput(), output)
    expect(output.parts[0].text).toBe("Failed to list sessions.")
  })

  it("reports empty session list", async () => {
    const plugin = await AllSessionsPlugin({
      client: makeClient([]),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](makeInput(), output)
    expect(output.parts[0].text).toBe("No sessions found.")
  })

  it("selects session by numeric index", async () => {
    const sessions = [
      { id: "a", title: "First", directory: "/p1" },
      { id: "b", title: "Second", directory: "/p2" },
    ]
    const plugin = await AllSessionsPlugin({
      client: makeClient(sessions),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](makeInput({ arguments: "2" }), output)
    expect(output.parts[0].text).toContain("Second")
  })

  it("selects session by --id", async () => {
    const sessions = [
      { id: "abc-123", title: "Target", directory: "/p1" },
    ]
    const plugin = await AllSessionsPlugin({
      client: makeClient(sessions),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](
      makeInput({ arguments: "--id abc-123" }),
      output,
    )
    expect(output.parts[0].text).toContain("Target")
  })

  it("rejects out-of-range index", async () => {
    const sessions = [{ id: "a", title: "Only" }]
    const plugin = await AllSessionsPlugin({
      client: makeClient(sessions),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](
      makeInput({ arguments: "5" }),
      output,
    )
    expect(output.parts[0].text).toContain("out of range")
  })

  it("rejects unmatched --id", async () => {
    const sessions = [{ id: "real-id", title: "Real" }]
    const plugin = await AllSessionsPlugin({
      client: makeClient(sessions),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](
      makeInput({ arguments: "--id missing-id" }),
      output,
    )
    expect(output.parts[0].text).toContain("not found")
  })

  it("shows error when session has no directory", async () => {
    const sessions = [
      { id: "a", title: "Dirless", directory: "", path: "" },
    ]
    const plugin = await AllSessionsPlugin({
      client: makeClient(sessions),
      $: make$(),
    })
    const output = makeOutput()
    await plugin["command.execute.before"](makeInput({ arguments: "1" }), output)
    expect(output.parts[0].text).toContain("has no directory")
  })

  describe("terminal launch", () => {
    it("launches iTerm when TERM_PROGRAM=iTerm.app and exits", async () => {
      vi.stubEnv("TERM_PROGRAM", "iTerm.app")
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)
      const mock$ = vi.fn().mockResolvedValue("")
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const plugin = await AllSessionsPlugin({
        client: makeClient(sessions),
        $: mock$,
      })
      const output = makeOutput()
      await plugin["command.execute.before"](
        makeInput({ arguments: "1" }),
        output,
      )
      expect(mock$).toHaveBeenCalled()
      expect(output.parts[0].text).toContain("Proj")
      vi.advanceTimersByTime(500)
      expect(exitSpy).toHaveBeenCalledWith(0)
      exitSpy.mockRestore()
      vi.unstubAllEnvs()
    })

    it("launches Terminal when TERM_PROGRAM is empty", async () => {
      vi.stubEnv("TERM_PROGRAM", "")
      const mock$ = vi.fn().mockResolvedValue("")
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const plugin = await AllSessionsPlugin({
        client: makeClient(sessions),
        $: mock$,
      })
      const output = makeOutput()
      await plugin["command.execute.before"](
        makeInput({ arguments: "1" }),
        output,
      )
      expect(mock$).toHaveBeenCalled()
      vi.unstubAllEnvs()
    })

    it("launches Terminal when TERM_PROGRAM is tmux", async () => {
      vi.stubEnv("TERM_PROGRAM", "tmux")
      const mock$ = vi.fn().mockResolvedValue("")
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const plugin = await AllSessionsPlugin({
        client: makeClient(sessions),
        $: mock$,
      })
      const output = makeOutput()
      await plugin["command.execute.before"](
        makeInput({ arguments: "1" }),
        output,
      )
      expect(mock$).toHaveBeenCalled()
      vi.unstubAllEnvs()
    })

    it("shows fallback message when AppleScript fails", async () => {
      vi.stubEnv("TERM_PROGRAM", "iTerm.app")
      const mock$ = vi.fn().mockRejectedValue(new Error("osascript failed"))
      const sessions = [
        { id: "a", title: "Proj", directory: "/Users/me/proj" },
      ]
      const plugin = await AllSessionsPlugin({
        client: makeClient(sessions),
        $: mock$,
      })
      const output = makeOutput()
      await plugin["command.execute.before"](
        makeInput({ arguments: "1" }),
        output,
      )
      expect(output.parts[0].text).toContain("Could not auto-launch")
      expect(output.parts[0].text).toContain("opencode /Users/me/proj")
      vi.unstubAllEnvs()
    })
  })
})
