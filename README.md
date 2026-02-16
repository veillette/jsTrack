# trackTS

A web-based video analysis and modeling software, and a fork of [JsTrack](https://github.com/lucademian/JsTrack).

Extract position data from objects in a video for motion tracking and analysis.

## Features

- **Webcam recording** — Record video directly from your webcam
- Load MP4/M4V/WebM videos and scrub frame-by-frame
- Create multiple object tracks with click-to-place position points
- Define measurement scales and coordinate axes
- View and edit data in a built-in spreadsheet
- Export data as XLSX, CSV, or TXT
- Save/load `.trackts` project files (ZIP format with embedded video)
- Google Drive integration for cloud storage
- Keyboard shortcuts and undo/redo support
- Progressive Web App (PWA) support for offline use

## Install & Build

```bash
git clone https://github.com/veillette/trackTS.git
cd trackTS
npm install
npm run build
```

## Running the Application

```bash
# Build and serve locally (recommended)
npm run start

# Or serve only (if already built)
npm run serve
```

Then open http://localhost:3000 in your browser.

Alternatively, open `index.html` directly in your browser (some features like webcam may require a server).

## Development

```bash
npm run dev
```

This runs Vite in watch mode — edit TypeScript files in `ts/` and the bundle rebuilds automatically.

## VS Code

The project includes VS Code configuration in `.vscode/`:

- **settings.json** — Biome formatter, TypeScript workspace SDK
- **extensions.json** — Recommended extensions
- **tasks.json** — Build, dev, serve, lint tasks (use `Ctrl+Shift+B`)
- **launch.json** — Debug in Chrome/Edge with F5

## Linting & Formatting

[Biome](https://biomejs.dev/) is used for linting and formatting:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format only
```

## Icon Generation

To regenerate app icons from the source SVG:

```bash
npm run generate-icons
```

This generates all manifest icons, favicons, and logo from `icons/app_icons/app_icon.svg`.

## Google Drive Integration

To use Drive features, serve the project over HTTP (e.g., `npm run serve`) and access via `http://localhost`. Set up API keys and OAuth by following the [Google Drive Picker guide](https://developers.google.com/drive/picker/guides/overview), then update `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_APP_ID` in `ts/globals.ts`.

## Project Structure

```
ts/               TypeScript source code
  classes/        Core classes (Project, Track, Timeline, Point, etc.)
  webcam.ts       Webcam recording functionality
  webcamevents.ts Webcam modal event handlers
  main.ts         Entry point
src/              Vendored external JS libraries
dist/             Build output (bundle.iife.js)
scripts/          Build scripts (icon generation)
icons/            SVG icons and app icons
.vscode/          VS Code workspace configuration
index.html        Main application page
```

## License

[GPL-3.0](LICENSE.txt)
