# OpenCV.js Auto-Tracking Implementation Plan

## Overview

Add automatic object tracking to trackTS using OpenCV.js. Users select a region of interest (ROI) on the current frame, configure tracking parameters, and the system automatically tracks the object across subsequent frames, creating Points via the existing `Track.addPoint()` API.

---

## 1. OpenCV.js Loading Strategy

### Approach: Lazy-load via dynamic `<script>` tag from CDN

**Why not npm (`@techstark/opencv-js`)?**
- OpenCV.js is ~8MB. Bundling it into the IIFE via Vite would bloat `dist/bundle.iife.js` from ~2MB to ~10MB, penalizing all users whether they use auto-tracking or not.
- The current build is `formats: ['iife']` with no code-splitting support. Adding dynamic imports would require changing the Vite config to a different format.

**Why CDN with lazy loading?**
- Follows the existing pattern: the project already loads external libs (CreateJS, etc.) via `<script>` tags in `index.html` from the `src/` directory.
- OpenCV.js is only loaded when the user first initiates auto-tracking, keeping initial page load fast.
- The `opencv.js` file can be placed in `src/` (vendored) or loaded from a CDN. Vendoring in `src/` is recommended for offline reliability, matching the existing pattern.

### Implementation

**New file: `ts/opencv-loader.ts`**

```typescript
let cvReady: Promise<void> | null = null;

export function loadOpenCV(): Promise<void> {
  if (cvReady) return cvReady;

  cvReady = new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof cv !== 'undefined' && cv.Mat) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'src/opencv.js'; // vendored in src/
    script.async = true;

    // OpenCV.js calls cv.onRuntimeInitialized when WASM is ready
    (window as any).Module = {
      onRuntimeInitialized: () => resolve(),
    };

    script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
    document.head.appendChild(script);
  });

  return cvReady;
}
```

**Type declarations: `ts/types/opencv.d.ts`**

Provide minimal type declarations for the OpenCV.js functions used (not the full 8000-line type file). Only declare `cv.Mat`, `cv.matchTemplate`, `cv.calcOpticalFlowPyrLK`, `cv.cvtColor`, `cv.minMaxLoc`, `cv.Rect`, and the handful of constants needed. This keeps the types maintainable and avoids pulling in a large third-party `.d.ts`.

**Vendoring:**
- Download `opencv.js` (v4.x, pre-built with WASM) and place it at `src/opencv.js`.
- This file is ~8MB but only loaded on demand.

---

## 2. New Files and Module Structure

```
ts/
├── opencv-loader.ts          # Lazy loader for OpenCV.js
├── opencv-tracking.ts        # Core tracking engine (algorithms + frame iteration)
├── autotrack-ui.ts           # ROI selection overlay + auto-track modal + button wiring
├── types/
│   └── opencv.d.ts           # Minimal OpenCV.js type declarations
```

**Why these files?**
- `opencv-loader.ts`: Single responsibility - manage the async loading of OpenCV.js.
- `opencv-tracking.ts`: Pure tracking logic. Takes video element, ROI, frame range, algorithm choice. Returns array of `{frame, x, y}` results. No UI dependencies - testable in isolation.
- `autotrack-ui.ts`: All UI concerns - the ROI selection rectangle on canvas, the configuration modal, the toolbar button handler, and wiring results into `Track.addPoint()`.

**Module load order addition in `ts/main.ts`:**
```typescript
// 9c. Auto-tracking (OpenCV) handlers
import './autotrack-ui';
```
Placed after `webcamevents` (9b), before `keycommands` (10). This follows the existing pattern of UI handler modules.

---

## 3. ROI Selection UI

### How the user draws a rectangle on the canvas

**Approach: Temporary CreateJS shape overlay on the existing stage.**

This follows the exact pattern used by the Scale tool, which lets users click two points on the canvas. The ROI selection uses the same stage event model.

**Flow:**
1. User clicks "Auto Track" button → system enters `'autotrack-roi'` mode via `master.state.mode = 'autotrack-roi'`.
2. A `createjs.Shape` rectangle overlay is added to the stage.
3. `stage.on('mousedown')` captures the start corner (converting to video coords via `master.toScaled()`).
4. `stage.on('pressmove')` updates the rectangle dimensions in real-time (yellow dashed outline).
5. `stage.on('pressup')` finalizes the ROI and opens the configuration modal.
6. If user cancels, mode returns to previous and rectangle is removed.

**Coordinate handling:**
- Mouse events give `stageX`/`stageY` (canvas coords).
- Convert to video pixel coords with `master.toScaled(stageX, stageY)` for storing the ROI.
- Draw the visual rectangle using `master.toUnscaled()` to display it correctly at any zoom level.
- The ROI stored is in video pixel coordinates, which is what OpenCV needs.

**Visual style:**
- Yellow dashed rectangle (2px stroke, matching the app's accent colors).
- Semi-transparent fill (`rgba(255, 255, 0, 0.15)`) so user can see what's inside.
- Removed from stage once tracking begins or is cancelled.

---

## 4. Auto-Tracking Configuration Modal

### Modal definition (added to `ts/globals.ts`)

```typescript
export const autoTrackModal = new Modal({
  name: 'Auto Track',
  id: 'auto-track-modal',
  fields: {
    algorithm: {
      label: 'Algorithm',
      type: 'text',
      required: true,
      initVal: 'template',
    },
    startFrame: {
      label: 'Start Frame',
      type: 'number',
      required: true,
    },
    endFrame: {
      label: 'End Frame',
      type: 'number',
      required: true,
    },
    searchMargin: {
      label: 'Search Region Margin (px)',
      type: 'number',
      required: true,
      initVal: 50,
    },
  },
  buttons: {
    cancel: { label: 'Cancel' },
    submit: { label: 'Track' },
  },
});
```

**Field explanations:**

| Field | Purpose | Default |
|-------|---------|---------|
| `algorithm` | `"template"` (Template Matching) or `"optical-flow"` (Lucas-Kanade). See note below on replacing with a `<select>`. | `"template"` |
| `startFrame` | First frame to process. Pre-filled with current frame number. | Current frame |
| `endFrame` | Last frame to process. Pre-filled with timeline end frame. | Timeline end frame |
| `searchMargin` | Extra pixels around previous match position to search in. Larger = more robust but slower. | `50` |

**Algorithm selector note:** The Modal class currently only supports `<input>` elements. For the algorithm choice, the simplest approach is to use a text field accepting `"template"` or `"optical-flow"`. A better UX would be to extend the Modal class to support `type: 'select'` with an `options` array, but that's a separate enhancement. For the initial implementation, use text input with validation.

**When modal opens:**
- Pre-fill `startFrame` with `master.timeline.currentFrame`.
- Pre-fill `endFrame` with `master.timeline.endFrame`.
- The ROI rectangle remains visible on the canvas as a reference.

---

## 5. Core Tracking Engine

### File: `ts/opencv-tracking.ts`

This module exports a single async generator function that yields tracking results frame by frame.

```typescript
export interface TrackingConfig {
  video: HTMLVideoElement;
  roi: { x: number; y: number; width: number; height: number }; // video pixel coords
  startFrame: number;
  endFrame: number;
  algorithm: 'template' | 'optical-flow';
  searchMargin: number;
  timeline: Timeline; // needed for frame time mapping
}

export interface TrackingResult {
  frameNumber: number;
  x: number;       // video pixel coords (center of matched region)
  y: number;       // video pixel coords (center of matched region)
  confidence: number; // 0-1, how confident the match is
}

export async function* trackObject(
  config: TrackingConfig
): AsyncGenerator<TrackingResult | { type: 'progress'; frame: number; total: number }> {
  // ...
}
```

### Algorithm: Template Matching (default, recommended)

**Why template matching as default?**
Physics experiments typically track rigid objects (balls, carts, pendulums) that don't deform much. Template matching works well for this: it's conceptually simple, robust for rigid objects, and the match quality metric lets us detect when tracking is lost.

**Implementation steps for each frame:**

1. **Extract template** (once, from the start frame):
   ```
   - Seek video to start frame time
   - Wait for 'seeked' event
   - Draw video to offscreen canvas → getImageData()
   - Create cv.Mat from ImageData
   - Crop ROI region → this is the template Mat
   - Convert to grayscale (cv.cvtColor, COLOR_RGBA2GRAY)
   ```

2. **For each subsequent frame** (startFrame+1 to endFrame):
   ```
   - Seek video to frame time, wait for 'seeked' event
   - Draw frame to offscreen canvas → ImageData → cv.Mat → grayscale
   - Define search region: expand previous match position by searchMargin
     (clamped to video bounds)
   - Crop search region from frame
   - Run cv.matchTemplate(searchRegion, template, result, cv.TM_CCOEFF_NORMED)
   - cv.minMaxLoc(result) → get maxLoc (best match position within search region)
   - Convert maxLoc back to full-frame coordinates
   - Compute center point: x = matchX + template.width/2, y = matchY + template.height/2
   - Yield {frameNumber, x, y, confidence: maxVal}
   - Update search center to new match position for next frame
   - Delete temporary Mats
   ```

3. **Adaptive template update (optional enhancement):**
   If confidence drops below a threshold (e.g., 0.7) but stays above a minimum (e.g., 0.4), update the template from the last high-confidence match. This handles gradual appearance changes (rotation, lighting).

### Algorithm: Lucas-Kanade Optical Flow (alternative)

**When to use:** Better for tracking a specific point (e.g., corner of an object) rather than a region. Good when the object is small or when template matching fails due to rotation/deformation.

**Implementation:**
1. On the start frame, extract the center point of the ROI as the feature point.
2. Optionally use `cv.goodFeaturesToTrack()` within the ROI to find a better feature point.
3. For each subsequent frame:
   ```
   - Convert previous and current frame to grayscale Mats
   - cv.calcOpticalFlowPyrLK(prevGray, currGray, prevPts, nextPts, status, err)
   - If status[0] == 1, the point was tracked → yield the new position
   - If status[0] == 0, tracking lost → yield with confidence 0
   - prevGray = currGray for next iteration
   ```

### Frame seeking strategy

Video seeking is the performance bottleneck. The approach:

```typescript
function seekToFrame(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.001) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}
```

**Important:** Use a **cloned video element** (`document.getElementById('video-clone')`) for tracking operations so the main video display doesn't jump around during processing. The clone is already created in `globals.ts` (`background2` uses `video-clone`). Alternatively, create a new temporary `<video>` element with the same `src` - this avoids any interference with the main timeline.

### Memory management

Every `cv.Mat` created must be explicitly freed with `mat.delete()`. The tracking function uses try/finally blocks to ensure cleanup:

```typescript
const frame = new cv.Mat();
try {
  // ... use frame
} finally {
  frame.delete();
}
```

The template Mat is kept alive across frames and deleted at the end of tracking.

---

## 6. Integration with Track/Point System

### Adding tracked points

The UI module (`autotrack-ui.ts`) consumes the async generator and calls `Track.addPoint()` for each result:

```typescript
for await (const result of trackObject(config)) {
  if ('type' in result) {
    // Update progress indicator
    updateProgress(result.frame, result.total);
    continue;
  }

  if (result.confidence < confidenceThreshold) {
    // Tracking lost - stop or skip this frame
    break; // or continue, depending on user preference
  }

  const frame = master.timeline.frames[result.frameNumber];
  if (frame) {
    track.addPoint(frame, result.x, result.y);
  }
}
```

### Undo/Redo for batch operations

The existing `addPoint()` registers individual undo/redo actions for each point. For a batch of auto-tracked points (potentially hundreds), this creates a poor UX: the user would need to press undo hundreds of times.

**Solution: Register a single compound undo/redo action.**

Instead of calling `track.addPoint()` directly (which registers individual undo actions), the auto-track UI will:

1. Collect all tracking results first.
2. Add all points in a loop using a lower-level approach that skips individual undo registration.
3. Register one compound undo/redo action that removes/restores all points at once.

```typescript
// After all tracking results are collected:
const addedPoints: Point[] = [];

for (const result of results) {
  const frame = master.timeline.frames[result.frameNumber];
  if (!frame) continue;

  // Create point directly (bypass addPoint's individual undo registration)
  const point = new Point(track, frame, result.x, result.y);
  track.points[frame.number] = point;
  frame.points.push(point);
  master.timeline.activeFrames.push(frame);

  const pointData = point.export();
  if (pointData) {
    track.table.addRow({ t: pointData.t, x: pointData.scaled.x, y: pointData.scaled.y }, true);
  }

  addedPoints.push(point);
}

// Single undo/redo for the entire batch
master.change({
  undo: () => {
    for (const point of addedPoints) {
      point.remove();
    }
    master.update();
  },
  redo: () => {
    for (const point of addedPoints) {
      point.unRemove();
    }
    master.update();
  },
});

master.trigger('newpoint');
master.updateVisiblePoints();
master.update();
```

**Note:** This requires that `Point` constructor, `remove()`, and `unRemove()` can be used independently of `Track.addPoint()`. Reading the existing code confirms this: `Point` constructor adds the shape to stage, `remove()` removes it, and `unRemove()` restores it. The key parts that `addPoint()` does beyond constructing a Point are: updating `track.points`, `frame.points`, `timeline.activeFrames`, the table, and registering undo. We replicate all of these except the per-point undo.

### Table update

After all points are added, call `track.table.update()` to refresh the Handsontable display with all new rows at once, rather than row-by-row during tracking (which would be slow).

### Restoring timeline position

After tracking completes, seek back to the frame where the user started:
```typescript
master.timeline.seek(originalFrame);
master.timeline.update();
```

---

## 7. Progress Feedback

### Approach: Text overlay on the canvas + modal text update

**Why not a separate progress bar element?**
The app's UI is tightly built around the canvas and sidebar. Adding a floating progress bar would require new CSS and DOM structure. Instead, use two lightweight approaches:

1. **Modal text update:** Keep the auto-track modal visible during processing, updating its text content with progress:
   ```typescript
   autoTrackModal.setText([
     `Tracking: frame ${current} of ${total}`,
     `${Math.round((current / total) * 100)}% complete`,
   ]);
   ```
   The Modal class already has a `setText()` method.

2. **Disable modal buttons** during processing to prevent double-submission. Change the "Track" button text to "Tracking..." and disable it.

3. **Allow cancellation:** Add an abort mechanism. While tracking is in progress, the "Cancel" button on the modal calls `abortController.abort()`, which the tracking generator checks between frames:

   ```typescript
   // In trackObject():
   if (signal.aborted) return;
   ```

   Pass an `AbortSignal` to the tracking config.

### Yielding control to the browser

The tracking loop must not block the main thread. Since `seekToFrame()` is already async (waits for the `seeked` event), the browser gets repaint opportunities between frames naturally. However, the OpenCV processing for each frame is synchronous. For videos with large frames, add an explicit yield:

```typescript
// After each frame's OpenCV processing:
await new Promise(resolve => setTimeout(resolve, 0));
```

This ensures the UI updates and the cancel button remains responsive.

---

## 8. Error Handling

### Tracking lost (confidence too low)

When `cv.matchTemplate` returns a `maxVal` below a configurable threshold (default: 0.5):

1. **Stop tracking** at that frame.
2. **Show a message** in the modal: `"Tracking lost at frame N (confidence: X%). Points were added for frames M through N-1."`
3. The user can then manually adjust the point at frame N and re-run auto-tracking from that frame.

### OpenCV.js fails to load

- Show an `alertModal()` (existing utility in `modal.ts`): "Auto-tracking requires OpenCV.js, which failed to load. Check your internet connection and try again."
- Do not proceed with tracking. The button remains functional for retry.

### Video seek timeout

If a `seeked` event doesn't fire within 5 seconds (possible with corrupted video):
- Reject the seek promise.
- Stop tracking and report the frame where it failed.

### No active track

- If `master.track` is null when user clicks "Auto Track", show `alertModal("Please create a track first.")`.

### ROI out of bounds

- Clamp the ROI to video dimensions during selection.
- If the search region goes out of bounds during tracking (object near edge), clamp the search region to video bounds. If the template can't fit in the remaining search area, stop tracking.

### Existing points in range

- If the track already has points in the frame range to be auto-tracked, warn the user: "The selected frame range contains N existing points. Auto-tracking will overwrite them. Continue?"
- Use `confirmModal()` (existing utility) for this.

---

## 9. File Modifications Needed

### Existing files to modify:

| File | Change |
|------|--------|
| `ts/globals.ts` | Add `autoTrackModal` export (new Modal definition). |
| `ts/main.ts` | Add `import './autotrack-ui';` after line 33 (webcamevents import). |
| `index.html` | Add auto-track button to `#toolbox`: `<div class="option button disabled" title="Auto Track" id="auto-track-button"></div>`. Place after the play button (line 39). |
| `style.css` | Add icon style for `#auto-track-button` (CSS background-image for a crosshair/target icon). |
| `ts/classes/project.ts` | No changes needed. The `change()`, `toScaled()`, `toUnscaled()`, `update()`, and `updateVisiblePoints()` methods are used as-is. |
| `ts/classes/track.ts` | No changes to `addPoint()`. The auto-track module directly constructs Points for batch operations, or optionally a new `addPoints(batch)` method could be added for clarity, but it's not strictly necessary. |
| `ts/classes/timeline.ts` | No changes needed. The `setFrame()`, `seek()`, `frames[]`, and `currentFrame` properties are used as-is. |

### New files to create:

| File | Purpose |
|------|---------|
| `ts/opencv-loader.ts` | Lazy-load OpenCV.js, expose `loadOpenCV(): Promise<void>` |
| `ts/opencv-tracking.ts` | Core tracking algorithms (template matching, optical flow) |
| `ts/autotrack-ui.ts` | ROI selection, modal wiring, button handler, point creation |
| `ts/types/opencv.d.ts` | Minimal TypeScript declarations for OpenCV.js API surface used |
| `src/opencv.js` | Vendored OpenCV.js 4.x build (downloaded, not hand-written) |

---

## 10. Implementation Order (Phased Approach)

### Phase 1: Foundation (OpenCV.js loading + type declarations)

**Files:** `ts/opencv-loader.ts`, `ts/types/opencv.d.ts`, `src/opencv.js` (vendored)

**What to build:**
- Download and vendor OpenCV.js 4.x.
- Write the lazy loader with proper error handling.
- Write minimal type declarations for used APIs.
- Test: call `loadOpenCV()` from browser console, verify `cv.Mat` is available.

**Why first:** Everything else depends on OpenCV.js being loadable.

### Phase 2: Core tracking engine (template matching only)

**Files:** `ts/opencv-tracking.ts`

**What to build:**
- `seekToFrame()` helper.
- `extractFrameData()` helper (video → canvas → ImageData → cv.Mat → grayscale).
- `trackObject()` async generator with template matching algorithm.
- Frame-to-frame iteration with search region restriction.
- Confidence reporting and abort signal support.

**Why second:** This is the core logic and can be tested independently by calling it from the console with a video element and ROI coordinates.

**Skip for Phase 2:** Lucas-Kanade optical flow. Template matching covers the primary use case. Optical flow can be added later as a second algorithm option.

### Phase 3: ROI selection UI

**Files:** `ts/autotrack-ui.ts` (partial), `index.html` (button), `style.css` (button icon)

**What to build:**
- Add "Auto Track" button to toolbar in `index.html`.
- Button click handler: check for active track, load OpenCV, enter ROI selection mode.
- CreateJS shape for rubber-band rectangle on `stage`.
- Mouse event handlers (mousedown/pressmove/pressup) for drawing the rectangle.
- Coordinate conversion between canvas and video pixels.
- On completion, store the ROI and transition to configuration.

**Why third:** Requires visual testing in the browser. The rectangle interaction is the most user-facing part and may need iteration.

### Phase 4: Configuration modal + orchestration

**Files:** `ts/globals.ts` (modal), `ts/autotrack-ui.ts` (completion), `ts/main.ts` (import)

**What to build:**
- Add `autoTrackModal` to `globals.ts`.
- Wire modal submit to tracking engine.
- Pre-fill start/end frame fields.
- Existing-points conflict detection and confirmation.
- Call `trackObject()`, consume results, create Points in batch.
- Single compound undo/redo registration.
- Progress display via modal text update.
- Cancellation via modal cancel button + AbortController.
- Restore timeline position after tracking.
- Enable/disable button based on project state (`master.on('created', ...)`).

**Why last:** This ties everything together. Each prior phase can be validated independently before integration.

### Phase 5 (future): Enhancements

- Add Lucas-Kanade optical flow as alternative algorithm.
- Extend Modal class to support `<select>` fields for algorithm choice.
- Add template update strategy for long tracking sequences.
- Add a "re-track from here" option that reuses the ROI from the failed point.
- Keyboard shortcut for initiating auto-track (e.g., `Ctrl+T`).

---

## Summary of Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Vendor OpenCV.js in `src/`, lazy-load via `<script>` | Matches existing external lib pattern; avoids bloating bundle; keeps initial load fast |
| Template matching as default algorithm | Best fit for rigid objects in physics experiments; simple; confidence metric for loss detection |
| Use cloned/temporary video element for seeking | Avoids disrupting the main video display during tracking |
| Batch point creation with single undo action | Prevents hundreds of individual undo steps for one auto-track operation |
| CreateJS shape overlay for ROI selection | Follows Scale tool pattern; works with existing zoom/pan; no new DOM elements needed |
| Async generator for tracking results | Enables progress reporting, cancellation, and non-blocking UI during long operations |
| Minimal OpenCV type declarations | Avoids large third-party `.d.ts` maintenance burden; only declare what we use |
