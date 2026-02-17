/**
 * Lazy loader for OpenCV.js.
 * Loads the vendored OpenCV.js from src/ only when auto-tracking is first initiated.
 */

let cvReady: Promise<void> | null = null;

export function loadOpenCV(): Promise<void> {
	if (cvReady) return cvReady;

	cvReady = new Promise<void>((resolve, reject) => {
		// Check if already loaded
		if (typeof cv !== 'undefined' && cv.Mat) {
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = 'src/opencv.js';
		script.async = true;

		// OpenCV.js calls Module.onRuntimeInitialized when WASM is ready
		(window as Record<string, unknown>).Module = {
			onRuntimeInitialized: () => resolve(),
		};

		script.onerror = () => {
			cvReady = null;
			reject(new Error('Failed to load OpenCV.js'));
		};

		document.head.appendChild(script);
	});

	return cvReady;
}
