import { describe, expect, test } from "bun:test"
import { Worktree, defaultNewSessionWorktree } from "./worktree"
import { ServerScope } from "./server-scope"

const dir = (name: string) => `/tmp/opencode-worktree-${name}-${crypto.randomUUID()}`

describe("Worktree", () => {
  const scope = ServerScope.local
  test("normalizes trailing slashes", () => {
    const key = dir("normalize")
    Worktree.ready(scope, `${key}/`)

    expect(Worktree.get(scope, key)).toEqual({ status: "ready" })
  })

  test("pending does not overwrite a terminal state", () => {
    const key = dir("pending")
    Worktree.failed(scope, key, "boom")
    Worktree.pending(scope, key)

    expect(Worktree.get(scope, key)).toEqual({ status: "failed", message: "boom" })
  })

  test("wait resolves shared pending waiter when ready", async () => {
    const key = dir("wait-ready")
    Worktree.pending(scope, key)

    const a = Worktree.wait(scope, key)
    const b = Worktree.wait(scope, `${key}/`)

    expect(a).toBe(b)

    Worktree.ready(scope, key)

    expect(await a).toEqual({ status: "ready" })
    expect(await b).toEqual({ status: "ready" })
  })

  test("wait resolves with failure message", async () => {
    const key = dir("wait-failed")
    const waiting = Worktree.wait(scope, key)

    Worktree.failed(scope, key, "permission denied")

    expect(await waiting).toEqual({ status: "failed", message: "permission denied" })
    expect(await Worktree.wait(scope, key)).toEqual({ status: "failed", message: "permission denied" })
  })

  test("isolates identical directories by server scope", () => {
    const key = dir("scope")
    const remote = "https://debian.example" as ServerScope
    Worktree.ready(scope, key)
    Worktree.failed(remote, key, "remote failed")

    expect(Worktree.get(scope, key)).toEqual({ status: "ready" })
    expect(Worktree.get(remote, key)).toEqual({ status: "failed", message: "remote failed" })
  })
})

describe("defaultNewSessionWorktree", () => {
  test("returns create for git project roots without stored selection", () => {
    expect(
      defaultNewSessionWorktree({
        directory: "/repo/main",
        projectWorktree: "/repo/main",
        stored: undefined,
        vcs: "git",
      }),
    ).toBe("create")
  })

  test("returns main outside git projects", () => {
    expect(
      defaultNewSessionWorktree({
        directory: "/repo/main",
        projectWorktree: "/repo/main",
        stored: undefined,
        vcs: undefined,
      }),
    ).toBe("main")
  })

  test("keeps the current directory when already in a worktree", () => {
    expect(
      defaultNewSessionWorktree({
        directory: "/repo/worktree-a",
        projectWorktree: "/repo/main",
        stored: undefined,
        vcs: "git",
      }),
    ).toBe("/repo/worktree-a")
  })

  test("honors stored selections", () => {
    expect(
      defaultNewSessionWorktree({
        directory: "/repo/main",
        projectWorktree: "/repo/main",
        stored: "/repo/worktree-a",
        vcs: "git",
      }),
    ).toBe("/repo/worktree-a")
  })
})
