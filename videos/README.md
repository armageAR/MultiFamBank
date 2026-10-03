# Demo videos (Remotion)

Workspace for demo videos of FamBank made with [Remotion](https://www.remotion.dev/), following
[Create a video with Claude Code and Remotion](https://www.claud.dev/articles/create-video-with-claude-code-and-remotion).

- **Not deployed.** No Railway service builds this folder (none of the watch patterns include it), so
  it never runs in staging or production.
- **Not part of the pnpm workspace** (`pnpm-workspace.yaml` lists `apps/*` and `packages/*`), so the
  root `pnpm build`, `lint` and `typecheck` and CI ignore it. Dependencies are installed with npm
  inside this folder.
- `CLAUDE.md` holds the Remotion instructions for Claude Code. It lives here, not at the repository
  root, so it only applies when working on the videos.
- Record the apps from staging (`*.dev.fambank.armage.tech`), never with real production data.

## Videos

| Composition    | Format            | Length | Content                                                        |
| -------------- | ----------------- | ------ | -------------------------------------------------------------- |
| `QueEsFamBank` | 1920x1080 (16:9)  | 53 s   | What FamBank is, for the public page                           |
| `ComoPide`     | 1080x1920 (9:16)  | 26 s   | A member deposits dollars and asks for money for an expense    |
| `ComoAprueba`  | 1080x1920 (9:16)  | 26 s   | The bank reviews and confirms a request, then the month report |

## Usage

```sh
cd videos
npm install
npx remotion studio                 # preview with hot reload (npm start)
npx remotion render src/index.ts QueEsFamBank out/QueEsFamBank.mp4
npx remotion render src/index.ts ComoPide out/ComoPide.mp4
npx remotion render src/index.ts ComoAprueba out/ComoAprueba.mp4
```

Rendered files go to `out/` (git-ignored).

## Layout

- `src/Root.tsx` registers the three compositions; each video lives in `src/videos/`.
- `src/components/Phone.tsx`: phone frame, captured screens, taps and highlights. Overlays use the
  390x844 CSS-pixel space of the captures.
- `src/components/Brand.tsx`: backgrounds, logo, captions (`**text**` gets the accent color), push
  banner and desktop browser window.
- `public/shots/`: screenshots from staging (Pepe Luis Bank, Jacinta Luis), at 2x.
- `public/brand/`: production app icons, built from `packages/ui/branding/bank.svg`.

## Recapturing screens

`scripts/capture.mjs` logs into staging with Playwright (Chromium, mobile 390x844 and desktop
1280x800), hides the staging-only markers and swaps in the production icon. Credentials come only
from environment variables; never write them to a file.

```sh
npx playwright install chromium
export BANK_EMAIL=… BANK_PASS=… JACINTA_EMAIL=… JACINTA_PASS=…
node scripts/capture.mjs static   # read-only screens: home, dashboard, report
node scripts/capture.mjs client   # WRITES to staging: a USD 50 deposit and a $30.000 expense request
node scripts/capture.mjs bank     # WRITES to staging: confirms the pending expense
```

The `client` and `bank` phases create data, so run them only when you need new request screens.
Overlay coordinates in `src/videos/` match the current captures; check them with
`npx remotion still` after recapturing.
