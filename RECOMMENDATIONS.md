# Remaining Recommendations

Code quality improvements identified for trackTS that have not yet been implemented.

## Already Completed

1. Replaced native prototype extensions with utility functions
2. Broke up the Project class into smaller modules (CoordinateMapper, ProjectSerializer)
3. Replaced `Math.random()` UID with `crypto.randomUUID()`
4. Consolidated custom event system into shared EventEmitter base class
5. Added listener cleanup (`off`/`offModeChange`) in point/track deletion paths
6. Eliminated `window` cast hack for cross-module communication
7. Tightened Biome lint rules (`noExplicitAny`, `noNonNullAssertion`, `noParameterAssign`)

---

## Outstanding Recommendations

### 1. Replace callback pyramids with async/await

**Files:** `backup.ts`, `load.ts`, `modalevents.ts`

Deep callback nesting (3–5 levels) with `JSZipUtils.getBinaryContent` → `JSZip.loadAsync` → `.file().async()` → `FileReader` makes the code hard to follow. Error handling is inconsistent — many callbacks log errors with `console.log` but don't propagate them.

```typescript
// Before (backup.ts:62–176):
JSZipUtils.getBinaryContent(fileUrl, (err, videoFile) => {
  if (err) console.log(err);
  // ... 3 more nested levels
});

// After:
async function projectBackup(): Promise<void> {
  if (!master.videoFile) return;
  const fileUrl = URL.createObjectURL(master.videoFile);
  try {
    const videoFile = await fetchBinaryContent(fileUrl);
    const zip = await JSZip.loadAsync(videoFile);
    // flat, readable flow
  } catch (err) {
    updateBackup(false);
  }
}
```

### 2. Extract magic numbers into named constants

**Files:** `index.ts`, `keycommands.ts`, `dom.ts`, `viewport.ts`, `timeline.ts`, `modalevents.ts`

Numeric literals are scattered throughout the codebase without explanation:

| Value | Location | Meaning |
|-------|----------|---------|
| `1000` | `index.ts:22` | Sidebar responsive breakpoint (px) |
| `50` | `index.ts:45` | Canvas bottom offset (px) |
| `20` | `keycommands.ts:56–65` | Arrow key movement step (px) |
| `200` | `modalevents.ts:248` | Scale edit focus delay (ms) |
| `250` | `dom.ts:85` | Resize debounce (ms) |
| `1/240` | `timeline.ts:70` | Framerate detection resolution |
| `25` | `viewport.ts:58` | Zoom sensitivity divisor |
| `400` | `modalevents.ts:89` | gapi polling interval (ms) |

Create a `ts/constants.ts` file to give these values descriptive names.

### 3. Add a test suite

**Impact: Critical**

There are no test files (`*.test.ts`, `*.spec.ts`) in the project. Core logic — coordinate mapping, serialization, unit conversion, axes rotation math — has zero test coverage.

Vitest integrates naturally with the existing Vite build. Priority targets:

- `CoordinateMapper.toScaled` / `toUnscaled` — coordinate transforms with zoom/pan
- `ProjectSerializer.save` / `load` — round-trip fidelity
- `Axes.convert` — trigonometric coordinate rotation
- `Scale.processValue` — unit string parsing
- Utility functions in `functions.ts` — `roundTo`, `roundSig`, `cot`, etc.

### 4. Remove `console.log` debugging from production code

**Files:** `backup.ts` (6 instances), `modalevents.ts` (5 instances), `timeline.ts` (2 instances)

Replace raw `console.log(err)` calls with either:
- `console.error()` for actual errors (more semantically correct)
- Silent removal for debug messages like `'Detecting Framerate...'`
- A lightweight logger that can be disabled in production

### 5. Replace `alert()`/`confirm()` with proper modals

**Files:** `backup.ts` (5 calls), `handlefiles.ts` (3 calls)

Browser `alert()` and `confirm()` block the main thread, are inaccessible to screen readers, and can't be styled. The codebase already has a `Modal` class — use it for user-facing confirmations like backup recovery and file format errors.

### 6. Guard against unbounded `setInterval` polling

**File:** `modalevents.ts:89–162`

The `setInterval` that polls for `gapi` availability runs indefinitely if the Google API never loads. Add a timeout:

```typescript
const GAPI_TIMEOUT_MS = 10000;
const start = Date.now();
const checkLoaded = setInterval(() => {
  if (Date.now() - start > GAPI_TIMEOUT_MS) {
    clearInterval(checkLoaded);
    console.error('Google API failed to load within timeout');
    return;
  }
  // ... existing check logic
}, 400);
```

### 7. Clean up remaining unsafe type casts

**Files:** `drive.ts`, `scale.ts:366`, `modalevents.ts:137`

Several `as unknown as` double-casts bypass type safety:

- `drive.ts:80–83` — Google Picker API enum casts → add proper type definitions
- `scale.ts:366` — `math.multiply(…) as number) as unknown as string` → use `String()` conversion
- `modalevents.ts:137` — `reader.result as unknown as ArrayBuffer` → use proper `FileReader` result narrowing

### 8. Standardize null/undefined checks

**Files:** Throughout the codebase

The codebase mixes several styles for nullish checks:

```typescript
// Style A: explicit double check (most common)
if (x !== null && x !== undefined) { ... }

// Style B: loose equality
if (x != null) { ... }

// Style C: truthiness
if (x) { ... }
```

Pick one style (recommended: `if (x != null)` for null/undefined, `if (x)` when falsy values like `0`/`''` should also be excluded) and apply it consistently.

### 9. Add video load error handling

**Files:** `index.ts:132–139`, `globals.ts:74`

No fallback if the video element fails to load. The `Bitmap` is created from the video element without verifying it exists or has a valid source. Add an `error` event listener on the video element to display a user-facing message.

### 10. Fix duplicate color in Modal default palette

**File:** `modal.ts:80–81`

`'#CC00FF'` appears twice in the `defaultColors` array. Remove the duplicate.

### 11. Clean up event listeners in `detectFrameRate`

**File:** `timeline.ts:91–117`

The `timeupdate` listener added to `tempVideo` is never removed after framerate detection completes. This can leak if the temporary video element isn't garbage collected. Remove the listener after the final frame comparison.

### 12. Add JSDoc to coordinate/math-heavy methods

**Files:** `coordinate-mapper.ts`, `axes.ts:226–270`, `scale.ts:250–300`

The coordinate transformation and trigonometric code is non-obvious. Document:
- What coordinate system each method expects and produces
- The math behind the axes rotation in `Axes.convert`
- How scale unit parsing works in `Scale.processValue`

### 13. Validate form inputs before parsing

**File:** `modalevents.ts:29–38`

`parseInt()` and `parseFloat()` on modal data are called without checking for `NaN`. Invalid user input (empty fields, non-numeric text) would silently produce `NaN` values that propagate through the application. Add validation after parsing.
