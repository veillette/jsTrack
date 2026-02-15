/**
 * Named constants extracted from throughout the codebase.
 */

/** Sidebar responsive breakpoint in pixels. Below this width, the sidebar collapses. */
export const SIDEBAR_BREAKPOINT_PX = 1000;

/** Canvas bottom offset in pixels, reserved for the scrubber bar. */
export const CANVAS_BOTTOM_OFFSET_PX = 50;

/** Arrow key movement step in pixels when panning the viewport. */
export const ARROW_KEY_STEP_PX = 20;

/** Delay in milliseconds before focusing the scale text input after creation. */
export const SCALE_EDIT_FOCUS_DELAY_MS = 200;

/** Debounce delay in milliseconds for window resize events. */
export const RESIZE_DEBOUNCE_MS = 250;

/** Framerate detection resolution (1/240 second per step). */
export const FRAMERATE_DETECTION_STEP = 1 / 240;

/** Divisor applied to wheel deltaY for zoom sensitivity. */
export const ZOOM_SENSITIVITY_DIVISOR = 25;

/** Polling interval in milliseconds for checking if the Google API has loaded. */
export const GAPI_POLL_INTERVAL_MS = 400;

/** Maximum time in milliseconds to wait for the Google API to load before giving up. */
export const GAPI_TIMEOUT_MS = 10_000;
