# Migrating Vendored Libraries to npm

The `src/` directory contains vendored (manually copied) JavaScript libraries loaded via `<script>` tags in `index.html`. This document describes how to migrate them to proper npm dependencies, following the process used for `undo-manager`.

## Completed Migrations

### undo-manager

- **Vendored file:** `src/undomanager.js` (removed)
- **npm package:** [`undo-manager`](https://www.npmjs.com/package/undo-manager)
- **Install:** `npm install undo-manager`
- **Steps taken:**
  1. Installed the package via npm.
  2. Created a TypeScript module declaration at `ts/types/undo-manager.d.ts` (the package has no built-in types).
  3. Added `import UndoManager from 'undo-manager'` in `ts/classes/project.ts`.
  4. Changed the `undoManager` property type from the global `UndoManager` to the imported `UndoManagerInstance`.
  5. Removed the global `declare class UndoManager` block from `ts/externals.d.ts`.
  6. Removed the `<script>` tag from `index.html`.
  7. Deleted `src/undomanager.js`.
  8. Verified with `npm run build` and `npm run lint`.

## Remaining Vendored Libraries

Each library below is loaded via a `<script>` tag in `index.html` and exposes globals consumed by TypeScript code (typed in `ts/externals.d.ts`).

### createjs (EaselJS)

- **Vendored file:** `src/createjs.min.js`
- **npm package:** [`@aspect/easeljs`](https://www.npmjs.com/package/@aspect/easeljs) or [`@nicholasgasior/easeljs`](https://www.npmjs.com/package/@nicholasgasior/easeljs)
- **Globals used:** `createjs.Stage`, `createjs.Shape`, `createjs.Bitmap`, `createjs.Container`, `createjs.Text`, `createjs.Ticker`, etc.
- **Notes:** EaselJS is part of the CreateJS suite. The official package is unmaintained; community forks exist. This is the most heavily used library in the codebase, so migration carries higher risk. The `createjs` namespace is referenced in nearly every file.

### Handsontable

- **Vendored files:** `src/handsontable.min.js`, `src/handsontable.full.css`, `src/handsontable.css`
- **npm package:** [`handsontable`](https://www.npmjs.com/package/handsontable)
- **Globals used:** `Handsontable` class
- **Notes:** Handsontable changed to a non-commercial license (requires a paid license for commercial use). The vendored version may be an older MIT-licensed release. Verify license compatibility before upgrading. CSS files would need to be imported via Vite's CSS handling or kept as external stylesheets.

### JSZip

- **Vendored files:** `src/jszip.min.js`, `src/jszip.js`, `src/jszip-utils.min.js`, `src/jszip-utils-ie.min.js`
- **npm package:** [`jszip`](https://www.npmjs.com/package/jszip)
- **Globals used:** `JSZip`, `JSZipUtils`
- **Notes:** JSZip has good npm support with built-in TypeScript types. `jszip-utils` is a separate package ([`jszip-utils`](https://www.npmjs.com/package/jszip-utils)). The IE-specific utils file can likely be dropped.

### FileSaver

- **Vendored file:** `src/FileSaver.js`
- **npm package:** [`file-saver`](https://www.npmjs.com/package/file-saver)
- **Types:** [`@types/file-saver`](https://www.npmjs.com/package/@types/file-saver)
- **Globals used:** `saveAs()`
- **Notes:** Straightforward migration. The npm package has community-maintained types.

### SheetJS (XLSX)

- **Vendored file:** `src/xlsx.min.js`
- **npm package:** [`xlsx`](https://www.npmjs.com/package/xlsx)
- **Globals used:** `XLSX.utils`, `XLSX.writeFile()`
- **Notes:** SheetJS changed its license model. The "community edition" is available via npm. Verify license terms.

### interact.js

- **Vendored file:** `src/interact.min.js`
- **npm package:** [`interactjs`](https://www.npmjs.com/package/interactjs)
- **Globals used:** `interact()`
- **Notes:** Good npm support with built-in TypeScript types. Straightforward migration.

### Dragula

- **Vendored files:** `src/dragula.min.js`, `src/dragula.min.css`
- **npm package:** [`dragula`](https://www.npmjs.com/package/dragula)
- **Types:** [`@types/dragula`](https://www.npmjs.com/package/@types/dragula)
- **Globals used:** `dragula()`
- **Notes:** CSS would need to be imported separately. The npm package is well-maintained.

### keyboardJS

- **Vendored file:** `src/keyboard.min.js`
- **npm package:** [`keyboardjs`](https://www.npmjs.com/package/keyboardjs)
- **Globals used:** `keyboardJS.on()`, `keyboardJS.pause()`, `keyboardJS.resume()`
- **Notes:** The npm package includes TypeScript types.

### Color Picker (CP)

- **Vendored files:** `src/colorpicker/color-picker.min.js`, `src/colorpicker/color-picker.min.css`
- **npm package:** [`@aspect/color-picker`](https://www.npmjs.com/package/@aspect/color-picker) or similar — check the original source
- **Globals used:** `CP` class
- **Notes:** Identify the exact library/version before migrating. CSS would need separate handling.

### math.js

- **Vendored file:** `src/math.min.js`
- **npm package:** [`mathjs`](https://www.npmjs.com/package/mathjs)
- **Globals used:** `math.unit()`, `math.multiply()`, `math.divide()`, `math.format()`
- **Notes:** Full npm support with built-in TypeScript types. Note: the full mathjs package is large (~700KB). If only unit conversion is used, consider importing selectively or using a lighter alternative.

### Platform.js

- **Vendored file:** `src/platform.js`
- **npm package:** [`platform`](https://www.npmjs.com/package/platform)
- **Globals used:** `platform.name`, `platform.version`, `platform.os`
- **Notes:** Simple migration. Small library.

### jQuery

- **Vendored file:** `src/jquery-3.3.1.min.js`
- **npm package:** [`jquery`](https://www.npmjs.com/package/jquery)
- **Notes:** Check if jQuery is still actively used in the codebase. It may have been replaced by native DOM APIs during the TypeScript port. If unused, it can simply be removed.

### ffmpeg

- **Vendored file:** `src/ffmpeg-worker-mp4.js`
- **npm package:** [`@ffmpeg/ffmpeg`](https://www.npmjs.com/package/@ffmpeg/ffmpeg)
- **Notes:** This is a Web Worker build. The modern `@ffmpeg/ffmpeg` package uses WebAssembly and has a different API. Migration would require rewriting the integration code.

## General Migration Steps

For each library:

1. **Install via npm:** `npm install <package-name>`
2. **Add types:** If the package lacks built-in types, either install `@types/<package-name>` or create a declaration file in `ts/types/<package-name>.d.ts`.
3. **Import in TypeScript:** Add `import` statements in the files that use the library.
4. **Remove global type declaration:** Delete the corresponding `declare` block from `ts/externals.d.ts`.
5. **Remove script tag:** Delete the `<script>` tag from `index.html`.
6. **Handle CSS:** For libraries with CSS, either:
   - Import in TypeScript: `import '<package>/dist/style.css'` (Vite handles this), or
   - Keep as a `<link>` tag in `index.html` pointing to `node_modules/`.
7. **Delete vendored file:** Remove the old file from `src/`.
8. **Build and test:** Run `npm run build` and `npm run lint` to verify.

## Priority Recommendations

Libraries with the best npm support and lowest migration risk:

1. **JSZip** — built-in types, widely used, stable API
2. **FileSaver** — tiny library, community types available
3. **interact.js** — built-in types, active maintenance
4. **Dragula** — community types, stable API
5. **keyboardJS** — built-in types
6. **Platform.js** — small and simple

Higher risk (license changes, large API surface, or major version differences):

7. **Handsontable** — license change to non-commercial
8. **SheetJS (XLSX)** — license model change
9. **math.js** — large bundle size consideration
10. **CreateJS** — unmaintained, most pervasive in codebase
11. **ffmpeg** — completely different modern API
