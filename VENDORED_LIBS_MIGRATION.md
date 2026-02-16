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

