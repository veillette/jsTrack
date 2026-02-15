# CLAUDE.md

This file provides guidance to Claude Code when working with the trackTS codebase.

## Project Overview

trackTS is a web-based video tracking application — a TypeScript port of the physics education software [Tracker](https://physlets.org/tracker/). It allows users to extract position data from objects in videos for motion analysis.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build
```

The build compiles TypeScript from `ts/` and bundles into `dist/bundle.iife.js` via Vite.

## Running the Application

Open `index.html` directly in a browser. No server is required unless using Google Drive integration, in which case serve over `http://localhost` with any static file server.

## Architecture

### Tech Stack

- **TypeScript** (strict mode) compiled with Vite
- **CreateJS (EaselJS)** for canvas rendering
- **Handsontable** for data tables
- **math.js** for unit conversion
- External JS libraries live in `src/` and are loaded via `<script>` tags in `index.html`

### Directory Structure

- `ts/` — TypeScript source (entry point: `ts/main.ts`)
  - `ts/classes/` — Core classes: `Project`, `Track`, `Timeline`, `Point`, `Frame`, `Scale`, `Axes`, `Table`, `Modal`
  - `ts/globals.ts` — Shared global state (master Project, Stage, DOM refs)
  - `ts/index.ts` — Main render loop and canvas drawing
  - `ts/functions.ts` — Utility functions
- `src/` — Vendored external JS libraries and CSS
- `dist/` — Build output (`bundle.iife.js`)
- `index.html` — Main HTML entry point

### Key Patterns

- **Global state**: A single `master` Project instance in `globals.ts` holds all application state.
- **Event-driven**: Classes use custom `trigger()`/`on()` callback methods for event propagation.
- **Module initialization order** matters — see `ts/main.ts` for the import sequence.
- **Canvas rendering**: CreateJS Stage manages overlays (points, tracks, axes, scale) on top of video frames.

### Data Model

```
Project
├── Timeline (video + frame management)
├── Track[] (each tracked object)
│   ├── Point[] (position per frame)
│   └── Table (data grid)
├── Scale (pixel-to-unit mapping)
└── Axes (coordinate system)
```

### File Formats

- `.trackts` — ZIP containing JSON project data + embedded video
- Export formats: XLSX, CSV, TXT

## TypeScript Configuration

- Target: ES2017, Module: ES2020
- All strict checks enabled (`strict: true`, `noImplicitAny`, `strictNullChecks`, etc.)
- Path alias: `@/*` maps to `ts/*`
- Source maps enabled

## Linting & Formatting

[Biome](https://biomejs.dev/) is used for linting and formatting. Configuration is in `biome.json`.

```bash
# Check for lint and format issues
npm run lint

# Auto-fix lint and format issues
npm run lint:fix

# Format only
npm run format
```

## Notes

- The `dist/bundle.iife.js` is generated — do not edit it directly.
- External libraries in `src/` are vendored and should not be modified.
