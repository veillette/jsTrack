/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { master, stage } from './globals';
import { frameArrows, scrubberLine, updateScrubber } from './scrubber';

const posText =
	(stage.children.find((c) => c instanceof createjs.Text) as createjs.Text) || new createjs.Text('', '', '');

master.on('deleteTrack', () => {
	if (Object.keys(master.trackList).length === 0) {
		const el = document.getElementById('tracks');
		if (el) el.classList.add('hidden');
	}
});

master.on('undeleteTrack', () => {
	if (Object.keys(master.trackList).length > 0) {
		const el = document.getElementById('tracks');
		if (el) el.classList.remove('hidden');
	}
});

master.on('newScale', () => {
	const el = document.getElementById('scale-button');
	if (el) el.title = 'Edit Scale';
});

master.on('newTrack', () => {
	const tracks = document.getElementById('tracks');
	if (tracks) tracks.classList.remove('hidden');
	const exportBtn = document.getElementById('export-button');
	if (exportBtn) exportBtn.classList.remove('disabled');
});

master.on('newpoint', () => {
	const el = document.getElementById('graphs');
	if (el) el.classList.remove('hidden');
});

master.on('created', function (this: typeof master) {
	scrubberLine.startMarker.x =
		this.timeline.startFrame * (scrubberLine.rect.w / this.timeline.frameCount) + scrubberLine.rect.x;
	scrubberLine.endMarker.x =
		this.timeline.endFrame * (scrubberLine.rect.w / this.timeline.frameCount) + scrubberLine.rect.x;

	updateScrubber(master.timeline.currentTime, master.timeline.duration);
	this.updateVisiblePoints();
	frameArrows.update();
});

let secondVidTimeout: ReturnType<typeof setTimeout> | null = null;
master.timeline.on('seek, timingUpdate', function (this: typeof master.timeline) {
	this.project.updateVisiblePoints();
	frameArrows.update();
	posText.text = `Frame: ${master.timeline.currentFrame}, X: ${stage.mouseX}, Y: ${stage.mouseY}`;
	if (this.project.track != null) {
		this.project.track.unemphasizeAll();
		if (this.project.track.points[this.project.timeline.currentFrame] !== undefined) {
			this.project.track.points[this.project.timeline.currentFrame].emphasize();
		}
	}
	updateScrubber(master.timeline.currentTime, master.timeline.duration);
	const video2 = document.getElementById('video-clone') as HTMLVideoElement;
	if (secondVidTimeout !== null) clearTimeout(secondVidTimeout);
	secondVidTimeout = setTimeout(() => {
		video2.currentTime = master.timeline.currentTime;
	}, 100);
});

master.timeline.on('play', () => {
	const el = document.getElementById('video-clone') as HTMLVideoElement | null;
	if (el) el.style.opacity = '0';
});

master.timeline.on('pause', () => {
	const el = document.getElementById('video-clone') as HTMLVideoElement | null;
	if (el) el.style.opacity = '1';
});
