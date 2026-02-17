/**
 * Auto-tracking UI module.
 * Handles the ROI selection overlay, auto-track modal wiring,
 * and orchestrating the tracking engine with the Track/Point system.
 */

import type { ModalExportData } from './classes/modal';
import { alertModal, confirmModal, Modal } from './classes/modal';
import { Point } from './classes/point';
import { autoTrackModal, master, stage } from './globals';
import { loadOpenCV } from './opencv-loader';
import { type ROI, type TrackingConfig, type TrackingResult, trackObject } from './opencv-tracking';

// ─── Button enable/disable ───

const autoTrackButton = document.getElementById('auto-track-button');

master.on('created', () => {
	if (autoTrackButton) autoTrackButton.classList.remove('disabled');
});

// ─── ROI selection state ───

let roiRect: createjs.Shape | null = null;
let currentROI: ROI | null = null;

/**
 * Enter ROI selection mode: user draws a rectangle on the canvas
 * to define the region of interest for auto-tracking.
 */
function startROISelection(): void {
	master.state.mode = 'autotrack-roi';
	stage.cursor = 'crosshair';
	stage.addChild(master.addBackground);

	roiRect = new createjs.Shape();
	stage.addChild(roiRect);

	let startX = 0;
	let startY = 0;
	let startStageX = 0;
	let startStageY = 0;
	let drawing = false;

	const onMouseDown = (e: createjs.MouseEvent) => {
		drawing = true;
		const coords = master.toScaled(e.stageX, e.stageY);
		startX = coords.x;
		startY = coords.y;
		startStageX = e.stageX;
		startStageY = e.stageY;
	};

	const onPressMove = (e: createjs.MouseEvent) => {
		if (!drawing || !roiRect) return;

		// Draw rectangle in stage coordinates for visual display
		const currentStageX = e.stageX;
		const currentStageY = e.stageY;
		const rx = Math.min(startStageX, currentStageX);
		const ry = Math.min(startStageY, currentStageY);
		const rw = Math.abs(currentStageX - startStageX);
		const rh = Math.abs(currentStageY - startStageY);

		roiRect.graphics.clear();
		roiRect.graphics
			.setStrokeStyle(2)
			.beginStroke('#FFFF00')
			.setStrokeDash([6, 4])
			.beginFill('rgba(255, 255, 0, 0.15)')
			.drawRect(rx, ry, rw, rh);
		stage.update();
	};

	const onPressUp = (e: createjs.MouseEvent) => {
		if (!drawing) return;
		drawing = false;

		// Calculate ROI in video pixel coordinates
		const endCoords = master.toScaled(e.stageX, e.stageY);
		const x = Math.min(startX, endCoords.x);
		const y = Math.min(startY, endCoords.y);
		const width = Math.abs(endCoords.x - startX);
		const height = Math.abs(endCoords.y - startY);

		// Require a minimum size
		if (width < 5 || height < 5) {
			cleanupROISelection();
			alertModal('Please draw a larger region to track.', 'Auto Track');
			return;
		}

		currentROI = { x, y, width, height };

		// Remove listeners
		stage.removeEventListener('mousedown', onMouseDown);
		stage.removeEventListener('pressmove', onPressMove);
		stage.removeEventListener('pressup', onPressUp);

		// Restore cursor and mode, then show config modal
		stage.cursor = 'default';
		master.state.default();

		// Pre-fill modal with current frame range
		autoTrackModal.push({
			startFrame: String(master.timeline.currentFrame),
			endFrame: String(master.timeline.endFrame),
		});
		autoTrackModal.show();
	};

	stage.on('mousedown', onMouseDown);
	stage.on('pressmove', onPressMove);
	stage.on('pressup', onPressUp);
}

/** Remove ROI rectangle from stage and reset state. */
function cleanupROISelection(): void {
	if (roiRect) {
		stage.removeChild(roiRect);
		roiRect = null;
	}
	currentROI = null;
	stage.cursor = 'default';
	stage.removeChild(master.addBackground);
	master.state.default();
}

// ─── Re-track from here ───

let retrackCounter = 0;

/**
 * Show a dialog offering the user a choice to re-track from the last good
 * position after tracking was lost.
 * Returns true if the user wants to re-track, false otherwise.
 */
function offerRetrack(message: string): Promise<boolean> {
	return new Promise((resolve) => {
		const id = `retrack-modal-${++retrackCounter}`;
		const modal = new Modal({
			name: 'Tracking Lost',
			id,
			fields: {},
			buttons: {
				done: { label: 'Done' },
				retrack: { label: 'Re-track from here' },
			},
			text: [message],
		});
		modal.on('done', () => {
			modal.hide();
			modal.element?.remove();
			resolve(false);
		});
		modal.on('retrack', () => {
			modal.hide();
			modal.element?.remove();
			resolve(true);
		});
		modal.show();
	});
}

// ─── Initiate auto-track (shared by button and keyboard shortcut) ───

/**
 * Initiate the auto-track workflow: validate preconditions, load OpenCV,
 * then enter ROI selection mode. Can be called from the button or Ctrl+T.
 */
export async function initiateAutoTrack(): Promise<void> {
	if (autoTrackButton?.classList.contains('disabled')) return;

	if (!master.track) {
		await alertModal('Please create a track first.', 'Auto Track');
		return;
	}

	if (!master.created) {
		await alertModal('Please create a project first.', 'Auto Track');
		return;
	}

	try {
		await loadOpenCV();
	} catch {
		await alertModal(
			'Auto-tracking requires OpenCV.js, which failed to load. Check your internet connection and try again.',
			'Auto Track',
		);
		return;
	}

	startROISelection();
}

// ─── Button click handler ───

autoTrackButton?.addEventListener('click', () => {
	initiateAutoTrack();
});

// ─── Modal event handlers ───

autoTrackModal.on('cancel', function (this: Modal) {
	this.hide().clear();
	cleanupROISelection();
});

autoTrackModal.on('submit', async function (this: Modal, data: ModalExportData) {
	if (!data || !currentROI || !master.track) return;

	const algorithm = data.algorithm as 'template' | 'optical-flow';
	if (algorithm !== 'template' && algorithm !== 'optical-flow') {
		await alertModal('Please select a valid algorithm.', 'Auto Track');
		return;
	}

	const startFrame = Number.parseInt(data.startFrame, 10);
	const endFrame = Number.parseInt(data.endFrame, 10);
	const searchMargin = Number.parseInt(data.searchMargin, 10);
	const templateUpdateInterval = Number.parseInt(data.templateUpdateInterval, 10);

	if (
		Number.isNaN(startFrame) ||
		Number.isNaN(endFrame) ||
		Number.isNaN(searchMargin) ||
		Number.isNaN(templateUpdateInterval)
	) {
		await alertModal('Please enter valid numbers for all fields.', 'Auto Track');
		return;
	}

	if (startFrame >= endFrame) {
		await alertModal('End frame must be greater than start frame.', 'Auto Track');
		return;
	}

	if (startFrame < 0 || endFrame > master.timeline.frameCount) {
		await alertModal(`Frame range must be between 0 and ${master.timeline.frameCount}.`, 'Auto Track');
		return;
	}

	const track = master.track;

	// Check for existing points in the frame range
	let existingCount = 0;
	for (let f = startFrame + 1; f <= endFrame; f++) {
		if (track.points[f] !== undefined) existingCount++;
	}
	if (existingCount > 0) {
		const confirmed = await confirmModal(
			`The selected frame range contains ${existingCount} existing points. Auto-tracking will overwrite them. Continue?`,
			'Auto Track',
		);
		if (!confirmed) return;
	}

	// Save the original frame position to restore later
	const originalFrame = master.timeline.currentFrame;
	// Save original endFrame and ROI dimensions for potential re-track
	const originalEndFrame = endFrame;
	const originalROIWidth = currentROI.width;
	const originalROIHeight = currentROI.height;

	// Create a temporary video element for tracking (avoid disrupting main display)
	const trackingVideo = document.createElement('video');
	trackingVideo.src = master.timeline.video.src;
	trackingVideo.muted = true;
	trackingVideo.preload = 'auto';

	// Wait for the video to be ready
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Tracking video failed to load')), 10000);
		trackingVideo.addEventListener(
			'loadeddata',
			() => {
				clearTimeout(timeout);
				resolve();
			},
			{ once: true },
		);
		trackingVideo.addEventListener(
			'error',
			() => {
				clearTimeout(timeout);
				reject(new Error('Tracking video failed to load'));
			},
			{ once: true },
		);
		trackingVideo.load();
	});

	const config: TrackingConfig = {
		video: trackingVideo,
		roi: currentROI,
		startFrame,
		endFrame,
		algorithm,
		searchMargin,
		templateUpdateInterval,
		timeline: master.timeline,
	};

	// Disable modal buttons during tracking
	const submitButton = document.getElementById(`${autoTrackModal.id}_button-submit`) as HTMLButtonElement | null;
	const cancelButton = document.getElementById(`${autoTrackModal.id}_button-cancel`) as HTMLButtonElement | null;
	if (submitButton) {
		submitButton.disabled = true;
		submitButton.innerText = 'Tracking...';
	}

	// Set up abort controller
	const abortController = new AbortController();
	let aborted = false;

	// Temporary cancel handler during tracking
	const cancelTracking = () => {
		aborted = true;
		abortController.abort();
	};
	if (cancelButton) {
		cancelButton.addEventListener('click', cancelTracking, { once: true });
	}

	// Run tracking and collect results
	const results: TrackingResult[] = [];
	const confidenceThreshold = 0.5;
	let trackingLostFrame = -1;
	let lastGoodResult: TrackingResult | null = null;

	try {
		for await (const item of trackObject(config, abortController.signal)) {
			if ('type' in item) {
				// Progress update
				autoTrackModal.setText([
					`Tracking: frame ${item.frame} of ${item.total}`,
					`${Math.round((item.frame / item.total) * 100)}% complete`,
				]);
				continue;
			}

			if (item.confidence < confidenceThreshold) {
				trackingLostFrame = item.frameNumber;
				break;
			}

			results.push(item);
			lastGoodResult = item;
		}
	} catch (err) {
		if (!aborted) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			await alertModal(`Tracking failed: ${message}`, 'Auto Track Error');
		}
	}

	// Remove cancel listener
	if (cancelButton) {
		cancelButton.removeEventListener('click', cancelTracking);
	}

	// Add tracked points in batch
	if (results.length > 0) {
		const addedPoints: Point[] = [];

		for (const result of results) {
			const frame = master.timeline.frames[result.frameNumber];
			if (!frame) continue;

			// If there's an existing point at this frame, remove it first
			if (track.points[frame.number] !== undefined) {
				const existing = track.points[frame.number];
				existing.remove();
			}

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

		// Register a single compound undo/redo action for the entire batch
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
	}

	// Restore timeline position
	master.timeline.seek(originalFrame);
	master.timeline.update();

	// Clean up tracking video
	trackingVideo.src = '';
	trackingVideo.remove();

	// Reset modal UI
	if (submitButton) {
		submitButton.disabled = false;
		submitButton.innerText = 'Track';
	}
	autoTrackModal.setText([]);
	autoTrackModal.hide().clear();
	cleanupROISelection();

	// Show completion message with re-track option if tracking was lost
	if (trackingLostFrame > 0 && lastGoodResult && !aborted) {
		const message =
			`Tracking lost at frame ${trackingLostFrame}. ` +
			`${results.length} points were added for frames ${startFrame + 1} through ${lastGoodResult.frameNumber}.`;

		const wantsRetrack = await offerRetrack(message);

		if (wantsRetrack && lastGoodResult.frameNumber < originalEndFrame) {
			// Build a new ROI centered on the last good tracked position
			currentROI = {
				x: lastGoodResult.x - originalROIWidth / 2,
				y: lastGoodResult.y - originalROIHeight / 2,
				width: originalROIWidth,
				height: originalROIHeight,
			};

			// Seek to the last good frame so the user sees where tracking stopped
			master.timeline.seek(lastGoodResult.frameNumber);
			master.timeline.update();

			// Pre-fill the modal to continue from where tracking left off
			autoTrackModal.push({
				startFrame: String(lastGoodResult.frameNumber),
				endFrame: String(originalEndFrame),
			});
			autoTrackModal.show();
		}
	} else if (results.length > 0 && !aborted) {
		await alertModal(`Successfully tracked ${results.length} frames.`, 'Auto Track Complete');
	} else if (aborted) {
		await alertModal(
			`Tracking was cancelled. ${results.length} points were added before cancellation.`,
			'Auto Track',
		);
	}
});
