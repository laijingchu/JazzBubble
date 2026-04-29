# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Documentation

- [docs/overview.md](docs/overview.md) is the canonical high-level description of the codebase (stack, file map, architecture, bootstrap).
- **Always update [docs/overview.md](docs/overview.md) after every material change** to the codebase — e.g. adding/removing files, new shader components, changes to the config schema, new dependencies, restructured UI, or any change that makes the current overview inaccurate.
- Cosmetic-only edits (typos, CSS tweaks that don't change structure) do not require an update.
- Keep the file map, architecture diagram, and code links in sync with reality. Verify line-number anchors still point at the right code after edits.

## Key Learnings

A running log of decisions, conventions, and gotchas landed throughout the project that should persist across sessions. Append a new bullet whenever a non-obvious choice is made or a lesson is learned. Keep entries short and dated; remove or update entries that become stale.

Format: `- YYYY-MM-DD — <decision/learning>. Why: <reason>.`

<!-- Add entries below -->

## Project

Vite + vanilla JS app ("Shaders Blob Mixer"). See [docs/overview.md](docs/overview.md) for details.

Run locally:

```bash
npm install
npm run dev
```
