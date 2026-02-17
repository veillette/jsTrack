/**
 * Core tracking engine using OpenCV.js.
 * Provides template matching and optical flow algorithms for automatic object tracking.
 */

import type { Timeline } from './classes/timeline';

export interface ROI {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface TrackingConfig {
	video: HTMLVideoElement;
	roi: ROI;
	startFrame: number;
	endFrame: number;
	algorithm: 'template' | 'optical-flow';
	searchMargin: number;
	timeline: Timeline;
	templateUpdateInterval: number;
}

export interface TrackingResult {
	frameNumber: number;
	x: number;
	y: number;
	confidence: number;
}

export interface TrackingProgress {
	type: 'progress';
	frame: number;
	total: number;
}

/** Seek a video element to a specific time and wait for the seek to complete. */
function seekToFrame(video: HTMLVideoElement, time: number): Promise<void> {
	return new Promise((resolve, reject) => {
		if (Math.abs(video.currentTime - time) < 0.001) {
			resolve();
			return;
		}

		const timeoutId = setTimeout(() => {
			video.removeEventListener('seeked', onSeeked);
			reject(new Error(`Seek timed out at time=${time}`));
		}, 5000);

		const onSeeked = () => {
			clearTimeout(timeoutId);
			video.removeEventListener('seeked', onSeeked);
			resolve();
		};

		video.addEventListener('seeked', onSeeked);
		video.currentTime = time;
	});
}

/** Draw the current video frame to an offscreen canvas and return the ImageData. */
function extractFrameImageData(video: HTMLVideoElement): ImageData {
	const canvas = document.createElement('canvas');
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Failed to get 2d canvas context');
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Convert ImageData to a grayscale cv.Mat. Caller must delete the returned Mat. */
function imageDataToGray(imageData: ImageData): cv.Mat {
	const rgba = cv.matFromImageData(imageData);
	const gray = new cv.Mat();
	cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
	rgba.delete();
	return gray;
}

/** Clamp a value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** Minimum confidence required before updating the template to avoid drift. */
const TEMPLATE_UPDATE_CONFIDENCE = 0.8;

/**
 * Track an object across frames using template matching.
 * Supports periodic template updates for long tracking sequences where the
 * object's appearance may change due to rotation, scale, or lighting shifts.
 * Yields TrackingResult for each frame, or TrackingProgress for UI updates.
 */
async function* templateMatchTrack(
	config: TrackingConfig,
	signal: AbortSignal,
): AsyncGenerator<TrackingResult | TrackingProgress> {
	const { video, roi, startFrame, endFrame, searchMargin, timeline, templateUpdateInterval } = config;
	const videoWidth = video.videoWidth;
	const videoHeight = video.videoHeight;
	const totalFrames = endFrame - startFrame;

	// Seek to start frame and extract the template
	const startTime = timeline.getFrameStart(startFrame);
	await seekToFrame(video, startTime);
	const startImageData = extractFrameImageData(video);
	const startGray = imageDataToGray(startImageData);

	// Crop the ROI to get the template
	const roiRect = new cv.Rect(
		clamp(Math.round(roi.x), 0, videoWidth - 1),
		clamp(Math.round(roi.y), 0, videoHeight - 1),
		clamp(Math.round(roi.width), 1, videoWidth),
		clamp(Math.round(roi.height), 1, videoHeight),
	);
	// Ensure ROI doesn't go out of bounds
	roiRect.width = Math.min(roiRect.width, videoWidth - roiRect.x);
	roiRect.height = Math.min(roiRect.height, videoHeight - roiRect.y);

	let template = startGray.roi(roiRect);
	startGray.delete();

	// Current match center (in video coords) starts at center of initial ROI
	let matchCenterX = roiRect.x + roiRect.width / 2;
	let matchCenterY = roiRect.y + roiRect.height / 2;

	const templateW = template.cols;
	const templateH = template.rows;
	let framesSinceUpdate = 0;

	try {
		for (let frameNum = startFrame + 1; frameNum <= endFrame; frameNum++) {
			if (signal.aborted) return;

			// Yield progress
			yield { type: 'progress', frame: frameNum - startFrame, total: totalFrames };

			// Seek to the frame
			const frameTime = timeline.getFrameStart(frameNum);
			await seekToFrame(video, frameTime);

			// Extract frame data
			const frameImageData = extractFrameImageData(video);
			const frameGray = imageDataToGray(frameImageData);

			// Define search region around previous match
			const searchX = clamp(Math.round(matchCenterX - templateW / 2 - searchMargin), 0, videoWidth - 1);
			const searchY = clamp(Math.round(matchCenterY - templateH / 2 - searchMargin), 0, videoHeight - 1);
			let searchW = Math.round(templateW + 2 * searchMargin);
			let searchH = Math.round(templateH + 2 * searchMargin);

			// Clamp search region to video bounds
			searchW = Math.min(searchW, videoWidth - searchX);
			searchH = Math.min(searchH, videoHeight - searchY);

			// Check if template can fit in search region
			if (searchW < templateW || searchH < templateH) {
				frameGray.delete();
				// Tracking lost - template can't fit in remaining search area
				yield {
					frameNumber: frameNum,
					x: matchCenterX,
					y: matchCenterY,
					confidence: 0,
				};
				return;
			}

			const searchRect = new cv.Rect(searchX, searchY, searchW, searchH);
			const searchRegion = frameGray.roi(searchRect);

			// Run template matching
			const result = new cv.Mat();
			cv.matchTemplate(searchRegion, template, result, cv.TM_CCOEFF_NORMED);
			const minMax = cv.minMaxLoc(result);

			// Convert match position back to full-frame coordinates
			const matchX = searchX + minMax.maxLoc.x;
			const matchY = searchY + minMax.maxLoc.y;
			matchCenterX = matchX + templateW / 2;
			matchCenterY = matchY + templateH / 2;
			const confidence = minMax.maxVal;

			// Cleanup match results
			result.delete();
			searchRegion.delete();

			// Template update strategy: periodically refresh the template from the
			// current match location to adapt to gradual appearance changes.
			// Only update when confidence is high to avoid drifting onto background.
			framesSinceUpdate++;
			if (
				templateUpdateInterval > 0 &&
				framesSinceUpdate >= templateUpdateInterval &&
				confidence >= TEMPLATE_UPDATE_CONFIDENCE
			) {
				const updateX = clamp(Math.round(matchCenterX - templateW / 2), 0, videoWidth - templateW);
				const updateY = clamp(Math.round(matchCenterY - templateH / 2), 0, videoHeight - templateH);
				const updateRect = new cv.Rect(updateX, updateY, templateW, templateH);
				const newTemplate = frameGray.roi(updateRect);
				template.delete();
				template = newTemplate;
				framesSinceUpdate = 0;
			}

			frameGray.delete();

			yield {
				frameNumber: frameNum,
				x: matchCenterX,
				y: matchCenterY,
				confidence,
			};

			// Yield control to the browser between frames
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	} finally {
		template.delete();
	}
}

/** Maximum number of feature points to track for optical flow. */
const MAX_FEATURES = 20;
/** Minimum quality level for goodFeaturesToTrack. */
const FEATURE_QUALITY = 0.01;
/** Minimum distance between detected features. */
const FEATURE_MIN_DISTANCE = 5;
/** Minimum fraction of features that must survive to report tracking as valid. */
const MIN_INLIER_RATIO = 0.25;

/** Compute the median of a numeric array. Returns 0 for empty arrays. */
function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Track an object across frames using Lucas-Kanade optical flow with
 * multi-feature tracking for robustness.
 *
 * Instead of tracking a single point, this finds strong features within the
 * ROI using goodFeaturesToTrack and tracks them all via calcOpticalFlowPyrLK.
 * The tracked position is the median of all successfully tracked features,
 * making it robust to individual feature failures and outliers.
 *
 * Yields TrackingResult for each frame, or TrackingProgress for UI updates.
 */
async function* opticalFlowTrack(
	config: TrackingConfig,
	signal: AbortSignal,
): AsyncGenerator<TrackingResult | TrackingProgress> {
	const { video, roi, startFrame, endFrame, timeline } = config;
	const videoWidth = video.videoWidth;
	const videoHeight = video.videoHeight;
	const totalFrames = endFrame - startFrame;

	// Seek to start frame
	const startTime = timeline.getFrameStart(startFrame);
	await seekToFrame(video, startTime);
	const startImageData = extractFrameImageData(video);
	let prevGray = imageDataToGray(startImageData);

	// Find strong features within the ROI for robust multi-point tracking
	const roiX = clamp(Math.round(roi.x), 0, videoWidth - 1);
	const roiY = clamp(Math.round(roi.y), 0, videoHeight - 1);
	const roiW = Math.min(clamp(Math.round(roi.width), 1, videoWidth), videoWidth - roiX);
	const roiH = Math.min(clamp(Math.round(roi.height), 1, videoHeight), videoHeight - roiY);
	const roiRect = new cv.Rect(roiX, roiY, roiW, roiH);
	const roiGray = prevGray.roi(roiRect);

	const corners = new cv.Mat();
	cv.goodFeaturesToTrack(roiGray, corners, MAX_FEATURES, FEATURE_QUALITY, FEATURE_MIN_DISTANCE);
	roiGray.delete();

	const numFeatures = corners.rows;
	if (numFeatures === 0) {
		// No features found; fall back to ROI center as single feature
		corners.delete();
	}

	// Build initial points matrix (N points, CV_32FC2)
	const pointCount = numFeatures > 0 ? numFeatures : 1;
	let prevPts = new cv.Mat(pointCount, 1, cv.CV_32FC2);

	if (numFeatures > 0) {
		// Offset ROI-relative corners to full-image coordinates
		for (let i = 0; i < numFeatures; i++) {
			prevPts.data32F[i * 2] = corners.data32F[i * 2] + roiX;
			prevPts.data32F[i * 2 + 1] = corners.data32F[i * 2 + 1] + roiY;
		}
		corners.delete();
	} else {
		// Fallback: single point at ROI center
		prevPts.data32F[0] = roi.x + roi.width / 2;
		prevPts.data32F[1] = roi.y + roi.height / 2;
	}

	const winSize = new cv.Size(21, 21);

	try {
		for (let frameNum = startFrame + 1; frameNum <= endFrame; frameNum++) {
			if (signal.aborted) {
				return;
			}

			yield { type: 'progress', frame: frameNum - startFrame, total: totalFrames };

			const frameTime = timeline.getFrameStart(frameNum);
			await seekToFrame(video, frameTime);
			const frameImageData = extractFrameImageData(video);
			const currGray = imageDataToGray(frameImageData);

			const nextPts = new cv.Mat();
			const status = new cv.Mat();
			const err = new cv.Mat();

			cv.calcOpticalFlowPyrLK(prevGray, currGray, prevPts, nextPts, status, err, winSize, 3);

			// Collect positions of successfully tracked features
			const trackedX: number[] = [];
			const trackedY: number[] = [];
			const totalPts = prevPts.rows;

			for (let i = 0; i < totalPts; i++) {
				if (status.data[i] === 1) {
					trackedX.push(nextPts.data32F[i * 2]);
					trackedY.push(nextPts.data32F[i * 2 + 1]);
				}
			}

			const inlierRatio = totalPts > 0 ? trackedX.length / totalPts : 0;

			// Cleanup previous frame data
			prevGray.delete();
			prevPts.delete();
			status.delete();
			err.delete();

			if (trackedX.length > 0 && inlierRatio >= MIN_INLIER_RATIO) {
				// Use median position for robustness against outliers
				const newX = median(trackedX);
				const newY = median(trackedY);

				// Build new prevPts from only the surviving features
				prevPts = new cv.Mat(trackedX.length, 1, cv.CV_32FC2);
				for (let i = 0; i < trackedX.length; i++) {
					prevPts.data32F[i * 2] = trackedX[i];
					prevPts.data32F[i * 2 + 1] = trackedY[i];
				}
				prevGray = currGray;

				yield {
					frameNumber: frameNum,
					x: newX,
					y: newY,
					confidence: inlierRatio,
				};
			} else {
				// Too few features survived — tracking lost
				currGray.delete();
				nextPts.delete();
				const fallbackX = trackedX.length > 0 ? median(trackedX) : 0;
				const fallbackY = trackedY.length > 0 ? median(trackedY) : 0;

				// Create dummy mats so the finally block can safely delete
				prevGray = new cv.Mat();
				prevPts = new cv.Mat();

				yield {
					frameNumber: frameNum,
					x: fallbackX,
					y: fallbackY,
					confidence: 0,
				};
				return;
			}

			nextPts.delete();
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	} finally {
		prevGray.delete();
		prevPts.delete();
	}
}

/**
 * Main entry point: track an object across video frames using the configured algorithm.
 * Returns an async generator that yields tracking results and progress updates.
 */
export async function* trackObject(
	config: TrackingConfig,
	signal: AbortSignal,
): AsyncGenerator<TrackingResult | TrackingProgress> {
	if (config.algorithm === 'optical-flow') {
		yield* opticalFlowTrack(config, signal);
	} else {
		yield* templateMatchTrack(config, signal);
	}
}
