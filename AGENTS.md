# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A single-page web app showing when Claude's 2× usage rate promotion is active. Displays a 24-hour SVG clock with peak (1×, 8AM–2PM ET weekdays) and off-peak (2×) zones, adapted to the user's timezone. Includes a CLI script (`cli.sh`) for terminal usage.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck with `tsc` then bundle with Vite
- `npm run preview` — preview production build

## Architecture

Vanilla TypeScript + Vite, no framework. Four source modules in `src/`:

- **`time.ts`** — all time logic: peak window detection, timezone conversion, countdown math. Peak hours are defined as constants (`PEAK_START_HOUR=8`, `PEAK_END_HOUR=14` in `America/New_York`). Promotion dates are hardcoded.
- **`clock.ts`** — builds and updates the 24-hour SVG clock. Uses raw DOM SVG element creation (no library). The clock is rebuilt on peak/off-peak transitions and timezone changes; only the hand/dot positions update each second.
- **`ui.ts`** — manages all non-clock DOM: status badge, countdown, progress bar, timeline bar, timezone selector. Reads from `time.ts` functions.
- **`main.ts`** — wires everything together. Holds app state (just `timezone`), sets up a 1-second interval for updates, and rebuilds the clock on state transitions.

`cli.sh` is a standalone bash script (no Node dependency) that shows the same peak/off-peak status in the terminal.

## TypeScript Config

Strict mode with `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedIndexedAccess` enabled.
