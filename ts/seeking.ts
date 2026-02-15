/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { master } from './globals';
import { frameArrows, scrubberLine } from './scrubber';

frameArrows.forward.sprite.on('click', () => {
	if (frameArrows.forward.enabled === true) {
		const frame = master.timeline.next();

		if (frame !== false && frame.number <= master.timeline.endFrame) {
			if (master.timeline.setFrame(frame.number) !== false) {
				if (master.track !== null) {
					master.track.unselectAll();
					master.track.unemphasizeAll();
					if (master.track.points[frame.number] !== undefined) {
						master.track.points[frame.number].show().emphasize();
					}
				}
			}
		}
	}
});

frameArrows.back.sprite.on('click', () => {
	if (frameArrows.back.enabled === true) {
		const frame = master.timeline.prev();

		if (frame !== false && frame.number >= master.timeline.startFrame) {
			if (master.timeline.setFrame(frame.number) !== false) {
				if (master.track !== null) {
					master.track.unselectAll();
					master.track.unemphasizeAll();
					if (master.track.points[frame.number] !== undefined) {
						master.track.points[frame.number].show().emphasize();
					}
				}
			}
		}
	}
});

scrubberLine.thumb.on('pressmove', (e: createjs.MouseEvent) => {
	const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);

	if (coords.x >= scrubberLine.rect.x && coords.x <= scrubberLine.rect.w + scrubberLine.rect.x) {
		const closestFrame = Math.round(
			(((coords.x - scrubberLine.rect.x) / scrubberLine.rect.w) * master.timeline.duration) /
				master.timeline.frameTime,
		);
		if (closestFrame <= master.timeline.endFrame && closestFrame >= master.timeline.startFrame) {
			scrubberLine.thumb.x =
				closestFrame * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
			master.timeline.seek(closestFrame);
		} else if (closestFrame < master.timeline.startFrame) {
			master.timeline.seek(master.timeline.startFrame);
		} else if (closestFrame > master.timeline.endFrame) {
			master.timeline.seek(master.timeline.endFrame);
		}
	} else if (
		coords.x <
		(scrubberLine.rect.w / master.timeline.frameCount) * master.timeline.startFrame + scrubberLine.rect.x
	) {
		master.timeline.seek(master.timeline.startFrame);
	} else if (
		coords.x >
		(scrubberLine.rect.w / master.timeline.frameCount) * master.timeline.endFrame + scrubberLine.rect.x
	) {
		master.timeline.seek(master.timeline.endFrame);
	}
});

let startMarkerStuck = false;
const startFrames: number[] = [];

scrubberLine.startMarker.on('mousedown', () => {
	if (startFrames.length === 0) {
		startFrames.push(master.timeline.startFrame);
	}
});
scrubberLine.startMarker.on('pressmove', (e: createjs.MouseEvent) => {
	const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);
	const closestFrame = master.timeline.getClosestFrame(
		((coords.x - scrubberLine.rect.x) / scrubberLine.rect.w) * master.timeline.duration,
	);
	if (closestFrame <= master.timeline.frameCount && closestFrame < master.timeline.endFrame && closestFrame >= 0) {
		scrubberLine.startMarker.x =
			closestFrame * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
		master.timeline.startFrame = closestFrame;
		if (master.timeline.currentFrame <= master.timeline.startFrame) {
			startMarkerStuck = true;
		}
		master.update();
	} else if (closestFrame < 0) {
		scrubberLine.startMarker.x = scrubberLine.rect.x;
		master.timeline.startFrame = 0;
		if (master.timeline.currentFrame <= master.timeline.startFrame) {
			startMarkerStuck = true;
		}
		master.update();
	}

	if (startMarkerStuck) {
		master.timeline.seek(master.timeline.startFrame);
	}

	frameArrows.update();
});
scrubberLine.startMarker.on('pressup', () => {
	const lastVal = startFrames[startFrames.length - 1];
	if (master.timeline.startFrame !== lastVal) {
		const last = lastVal;
		const current = master.timeline.startFrame;
		const stuck = startMarkerStuck;
		const index = startFrames.length;
		if (startFrames.length >= 1) {
			master.change({
				undo: () => {
					startFrames.splice(index, 1);
					scrubberLine.startMarker.x =
						last * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
					master.timeline.startFrame = last;
					if (stuck) {
						master.timeline.seek(master.timeline.startFrame);
					}
					master.update();
				},
				redo: () => {
					startFrames.push(current);
					scrubberLine.startMarker.x =
						current * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
					master.timeline.startFrame = current;
					if (stuck) {
						master.timeline.seek(master.timeline.startFrame);
					}
					master.update();
				},
			});
		}
	}

	startFrames.push(master.timeline.startFrame);
	startMarkerStuck = false;
});

let endMarkerStuck = false;
const endFrames: number[] = [];

scrubberLine.endMarker.on('mousedown', () => {
	if (endFrames.length === 0) {
		endFrames.push(master.timeline.endFrame);
	}
});
scrubberLine.endMarker.on('pressmove', (e: createjs.MouseEvent) => {
	const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);
	const closestFrame = master.timeline.getClosestFrame(
		((coords.x - scrubberLine.rect.x) / scrubberLine.rect.w) * master.timeline.duration,
	);
	if (closestFrame <= master.timeline.frameCount && closestFrame > master.timeline.startFrame) {
		scrubberLine.endMarker.x =
			closestFrame * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
		master.timeline.endFrame = closestFrame;
		if (master.timeline.currentFrame > master.timeline.endFrame) {
			endMarkerStuck = true;
		}
		master.update();
	} else if (closestFrame > master.timeline.frameCount) {
		scrubberLine.endMarker.x =
			master.timeline.frameCount * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
		master.timeline.endFrame = master.timeline.frameCount;
		if (master.timeline.currentFrame >= master.timeline.endFrame) {
			endMarkerStuck = true;
		}
		master.update();
	}

	if (endMarkerStuck) {
		master.timeline.seek(master.timeline.endFrame);
	}
	frameArrows.update();
});

scrubberLine.endMarker.on('pressup', () => {
	const lastVal = endFrames[endFrames.length - 1];
	if (master.timeline.endFrame !== lastVal) {
		const last = lastVal;
		const current = master.timeline.endFrame;
		const stuck = endMarkerStuck;
		const index = endFrames.length;
		if (endFrames.length >= 1) {
			master.change({
				undo: () => {
					endFrames.splice(index, 1);
					scrubberLine.endMarker.x =
						last * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
					master.timeline.endFrame = last;
					if (stuck) {
						master.timeline.seek(master.timeline.endFrame);
					}
					master.update();
				},
				redo: () => {
					endFrames.push(current);
					scrubberLine.endMarker.x =
						current * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
					master.timeline.endFrame = current;
					if (stuck) {
						master.timeline.seek(master.timeline.endFrame);
					}
					master.update();
				},
			});
		}
	}

	endFrames.push(master.timeline.endFrame);
	endMarkerStuck = false;
});
