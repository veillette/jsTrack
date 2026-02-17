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

/**
 * Track an object across frames using template matching.
 * Yields TrackingResult for each frame, or TrackingProgress for UI updates.
 */
async function* templateMatchTrack(
	config: TrackingConfig,
	signal: AbortSignal,
): AsyncGenerator<TrackingResult | TrackingProgress> {
	const { video, roi, startFrame, endFrame, searchMargin, timeline } = config;
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

	const template = startGray.roi(roiRect);
	startGray.delete();

	// Current match center (in video coords) starts at center of initial ROI
	let matchCenterX = roiRect.x + roiRect.width / 2;
	let matchCenterY = roiRect.y + roiRect.height / 2;

	const templateW = template.cols;
	const templateH = template.rows;

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

			// Cleanup
			result.delete();
			searchRegion.delete();
			frameGray.delete();

			yield {
				frameNumber: frameNum,
				x: matchCenterX,
				y: matchCenterY,
				confidence: minMax.maxVal,
			};

			// Yield control to the browser between frames
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	} finally {
		template.delete();
	}
}

/**
 * Track an object across frames using Lucas-Kanade optical flow.
 * Yields TrackingResult for each frame, or TrackingProgress for UI updates.
 */
async function* opticalFlowTrack(
	config: TrackingConfig,
	signal: AbortSignal,
): AsyncGenerator<TrackingResult | TrackingProgress> {
	const { video, roi, startFrame, endFrame, timeline } = config;
	const totalFrames = endFrame - startFrame;

	// Seek to start frame
	const startTime = timeline.getFrameStart(startFrame);
	await seekToFrame(video, startTime);
	const startImageData = extractFrameImageData(video);
	let prevGray = imageDataToGray(startImageData);

	// Initial point: center of ROI
	const pointX = roi.x + roi.width / 2;
	const pointY = roi.y + roi.height / 2;

	// Create initial points matrix (1 point, 2 channels: x, y)
	let prevPts = cv.matFromImageData(
		new ImageData(new Uint8ClampedArray(4), 1, 1), // dummy, overwritten below
	);
	prevPts.delete();
	prevPts = new cv.Mat(1, 1, cv.CV_32FC2);
	prevPts.data32F[0] = pointX;
	prevPts.data32F[1] = pointY;

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

			const tracked = status.data[0] === 1;
			const newX = nextPts.data32F[0];
			const newY = nextPts.data32F[1];

			// Cleanup previous frame data
			prevGray.delete();
			prevPts.delete();
			status.delete();
			err.delete();

			if (tracked) {
				prevGray = currGray;
				prevPts = nextPts;

				yield {
					frameNumber: frameNum,
					x: newX,
					y: newY,
					confidence: 1,
				};
			} else {
				currGray.delete();
				nextPts.delete();

				yield {
					frameNumber: frameNum,
					x: newX,
					y: newY,
					confidence: 0,
				};
				return;
			}

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
