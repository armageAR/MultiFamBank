# Demo videos (Remotion)

Workspace for demo videos of FamBank made with [Remotion](https://www.remotion.dev/), following
[Create a video with Claude Code and Remotion](https://www.claud.dev/articles/create-video-with-claude-code-and-remotion).

- **Not deployed.** No Railway service builds this folder (none of the watch patterns include it), so
  it never runs in staging or production.
- **Not part of the pnpm workspace** (`pnpm-workspace.yaml` lists `apps/*` and `packages/*`), so the
  root `pnpm build`, `lint` and `typecheck` and CI ignore it. Scaffold the Remotion project here and
  install its dependencies inside this folder.
- `CLAUDE.md` holds the Remotion instructions for Claude Code. It lives here, not at the repository
  root, so it only applies when working on the videos.
- Record the apps from staging (`*.dev.fambank.armage.tech`), never with real production data.
