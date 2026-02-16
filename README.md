# trackTS

A web-based video analysis and modeling software, and a fork of [JStrack](https://github.com/lucademian/JStrack).

Extract position data from objects in a video for motion tracking and analysis.

## Features

- Load MP4/M4V videos and scrub frame-by-frame
- Create multiple object tracks with click-to-place position points
- Define measurement scales and coordinate axes
- View and edit data in a built-in spreadsheet
- Export data as XLSX, CSV, or TXT
- Save/load `.trackts` project files (ZIP format with embedded video)
- Google Drive integration for cloud storage
- Keyboard shortcuts and undo/redo support

## Install & Build

```bash
git clone https://github.com/veillette/trackTS.git
cd trackTS
npm install
npm run build
```

Then open `index.html` in your browser. No server is required.

## Development

```bash
npm run dev
```

This runs Vite in watch mode — edit TypeScript files in `ts/` and the bundle rebuilds automatically.

## Linting & Formatting

[Biome](https://biomejs.dev/) is used for linting and formatting:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format only
```

## Google Drive Integration

To use Drive features, serve the project over HTTP (e.g., `npx http-server`) and access via `http://localhost`. Set up API keys and OAuth by following the [Google Drive Picker guide](https://developers.google.com/drive/picker/guides/overview), then update `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_APP_ID` in `ts/globals.ts`.

## Project Structure

```
ts/             TypeScript source code
  classes/      Core classes (Project, Track, Timeline, Point, etc.)
  main.ts       Entry point
src/            Vendored external JS libraries
dist/           Build output (bundle.iife.js)
index.html      Main application page
```

## License

[GPL-3.0](LICENSE.txt)
