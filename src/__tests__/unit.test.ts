import { describe, it, expect } from "vitest"
import { relativeAge, truncatePath, formatLine, getSessions } from "../index"

describe("relativeAge", () => {
  const now = Date.now()

  it("returns seconds for < 60s", () => {
    expect(relativeAge(now - 30_000)).toBe("30s")
  })

  it("returns minutes for < 60m", () => {
    expect(relativeAge(now - 120_000)).toBe("2m")
  })

  it("returns hours for < 24h", () => {
    expect(relativeAge(now - 3_600_000 * 5)).toBe("5h")
  })

  it("returns days for >= 24h", () => {
    expect(relativeAge(now - 86_400_000 * 3)).toBe("3d")
  })

  it("handles boundary at 60s", () => {
    expect(relativeAge(now - 59_000)).toBe("59s")
    expect(relativeAge(now - 60_000)).toBe("1m")
  })

  it("handles boundary at 60m", () => {
    expect(relativeAge(now - 3_599_000)).toBe("59m")
    expect(relativeAge(now - 3_600_000)).toBe("1h")
  })

  it("handles boundary at 24h", () => {
    expect(relativeAge(now - 86_399_000)).toBe("23h")
    expect(relativeAge(now - 86_400_000)).toBe("1d")
  })
})

describe("truncatePath", () => {
  it("returns short paths unchanged", () => {
    expect(truncatePath("/tmp/x", 45)).toBe("/tmp/x")
  })

  it("replaces /Users/xxx with ~", () => {
    expect(truncatePath("/Users/alice/projects/foo", 45)).toBe(
      "~/projects/foo",
    )
  })

  it("truncates long paths to last 3 segments", () => {
    const long =
      "/Users/bob/projects/opencode/packages/plugin/src/index.ts"
    expect(truncatePath(long, 20)).toMatch(/^\.\.\.\//)
    expect(truncatePath(long, 20)).toContain("plugin/src/index.ts")
  })

  it("handles empty path", () => {
    expect(truncatePath("", 45)).toBe("")
  })

  it("handles path exactly at maxLen", () => {
    expect(truncatePath("/a/b/c", 6)).toBe("/a/b/c")
  })
})

describe("getSessions", () => {
  it("returns array as-is", () => {
    const arr = [{ id: "1" }, { id: "2" }]
    expect(getSessions(arr)).toBe(arr)
  })

  it("extracts from { data: [...] }", () => {
    const data = [{ id: "1" }]
    expect(getSessions({ data })).toBe(data)
  })

  it("returns empty array for null", () => {
    expect(getSessions(null)).toEqual([])
  })

  it("returns empty array for { data: null }", () => {
    expect(getSessions({ data: null })).toEqual([])
  })

  it("returns empty array for undefined", () => {
    expect(getSessions(undefined)).toEqual([])
  })

  it("returns empty array for empty object", () => {
    expect(getSessions({})).toEqual([])
  })
})

describe("formatLine", () => {
  it("formats a full session entry", () => {
    const line = formatLine(1, {
      id: "abc12345",
      title: "Fix login bug",
      directory: "/Users/me/proj",
      time_created: Date.now() - 3600_000,
    })
    expect(line).toContain("1.")
    expect(line).toContain("abc12345")
    expect(line).toContain("Fix login bug")
    expect(line).toContain("~/proj")
    expect(line).toContain("1h")
  })

  it("falls back to slug when title is missing", () => {
    const line = formatLine(2, {
      id: "xyz",
      slug: "my-slug",
      directory: "/tmp",
      time_created: Date.now() - 60_000,
    })
    expect(line).toContain("my-slug")
  })

  it('falls back to "(untitled)" when title and slug missing', () => {
    const line = formatLine(3, {
      id: "zzz",
      directory: "/tmp",
      time_created: Date.now() - 60_000,
    })
    expect(line).toContain("(untitled)")
  })

  it("handles missing directory and time", () => {
    const line = formatLine(1, { id: "a" })
    expect(line).toContain("(untitled)")
  })

  it("handles path instead of directory", () => {
    const line = formatLine(1, {
      id: "a",
      title: "test",
      path: "/Users/me/some/path",
    })
    expect(line).toContain("~/some/path")
  })
})
