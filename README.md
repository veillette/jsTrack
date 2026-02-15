# trackTS

A web-based version of the [Tracker](https://physlets.org/tracker/) physics video analysis software and a fork of https://github.com/lucademian/trackTS. 

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

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (for building from source)

### Install & Build

```bash
git clone https://github.com/veillette/trackTS.git
cd trackTS
npm install
npm run build
```

Then open `index.html` in your browser. No server is required.

### Development

```bash
npm run dev
```

This runs Vite in watch mode — edit TypeScript files in `ts/` and the bundle rebuilds automatically.

### Google Drive Integration

To use Drive features, serve the project over HTTP (e.g., `npx http-server`) and access via `http://localhost`. Set up API keys by following the [Google Drive API quickstart](https://developers.google.com/drive/api/v3/quickstart/js), then update the keys in `ts/drive.ts` and `index.html`.

## Project Structure

```
ts/             TypeScript source code
  classes/      Core classes (Project, Track, Timeline, Point, etc.)
  main.ts       Entry point
src/            Vendored external JS libraries
dist/           Build output (bundle.js)
index.html      Main application page
```

## License

[GPL-3.0](LICENSE.txt)
