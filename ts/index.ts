/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { CANVAS_BOTTOM_OFFSET_PX, SIDEBAR_BREAKPOINT_PX } from './constants';
import { hideLoader } from './functions';
import {
	background,
	background2,
	canvas,
	master,
	posText,
	posTextBackground,
	posTextBackgroundCommand,
	sidebar,
	stage,
	video,
	videoContainer,
} from './globals';
import { frameArrows, scrubber, scrubberCanv, scrubberLine, updateScrubber } from './scrubber';

export function drawGraphics(_initialDraw = false): void {
	if (window.innerWidth < SIDEBAR_BREAKPOINT_PX) {
		if (!sidebar.classList.contains('changed')) {
			sidebar.classList.remove('normal');
			sidebar.classList.add('hidden');
			const sidebarVis = document.getElementById('sidebar-visibility');
			if (sidebarVis) {
				sidebarVis.classList.add('show');
				sidebarVis.classList.remove('hide');
			}
		}
	} else {
		if (!sidebar.classList.contains('changed')) {
			sidebar.classList.add('normal');
			sidebar.classList.remove('hidden');
			const sidebarVis = document.getElementById('sidebar-visibility');
			if (sidebarVis) {
				sidebarVis.classList.add('hide');
				sidebarVis.classList.remove('show');
			}
		}
	}

	const width = window.innerWidth - sidebar.offsetWidth;
	const height = window.innerHeight - CANVAS_BOTTOM_OFFSET_PX;

	const sidebarVis = document.getElementById('sidebar-visibility');
	if (sidebarVis) sidebarVis.style.right = `${sidebar.offsetWidth}px`;

	videoContainer.style.width = `${width}px`;
	videoContainer.style.height = `${height}px`;

	const scale = Math.min(width / master.timeline.video.videoWidth, height / master.timeline.video.videoHeight);

	canvas.height = height;
	canvas.width = width;

	if (master.positioning.autoZoom) {
		master.backgroundScale = scale;
		background.scale = master.backgroundScale * master.positioning.zoom;
	}

	const bg = master.background as createjs.Bitmap & { w: number; h: number };
	bg.w = background.scale * master.timeline.video.videoWidth;
	bg.h = background.scale * master.timeline.video.videoHeight;

	if (bg.w <= canvas.width) {
		master.positioning.x = (canvas.width - background.scale * master.timeline.video.videoWidth) / 2;
	} else {
		if (master.positioning.x + bg.w < canvas.width) {
			master.positioning.x = canvas.width - bg.w;
		}
		if (master.positioning.x > 0 && bg.w > canvas.width) {
			master.positioning.x = 0;
		}
	}
	if (bg.h <= canvas.height) {
		master.positioning.y = (canvas.height - background.scale * master.timeline.video.videoHeight) / 2;
	} else {
		if (master.positioning.y + bg.h < canvas.height) {
			master.positioning.y = canvas.height - bg.h;
		}
		if (master.positioning.y > 0 && bg.h > canvas.height) {
			master.positioning.y = 0;
		}
	}

	background2.scale = background.scale;
	background2.x = background.x;
	background2.y = background.y;

	scrubberCanv.width = canvas.width;
	scrubberCanv.height = 50;
	scrubberLine.rect.w = scrubberCanv.width / stage.scaleX - 100;
	scrubberLine.rect.h = 10;
	scrubberLine.rect.y = (scrubberCanv.height - 10) / 2;
	scrubberLine.rect.x = 15;

	scrubberLine.thumb.y = scrubberLine.rect.y;
	scrubberLine.thumb.x = scrubberLine.rect.x;
	scrubberLine.thumb.rect.h = scrubberLine.rect.h + 10;

	frameArrows.forward.sprite.x = scrubberCanv.width - 30;
	frameArrows.forward.sprite.y = (scrubberCanv.height - 20) / 2;

	frameArrows.back.sprite.x = scrubberCanv.width - 60;
	frameArrows.back.sprite.y = (scrubberCanv.height - 20) / 2;

	posText.x = 10;
	posText.regY = 20;
	posText.y = stage.globalToLocal(0, canvas.height).y;

	posTextBackground.regY = posTextBackgroundCommand.h;
	posTextBackground.y = stage.globalToLocal(0, canvas.height).y;

	scrubberLine.startMarker.x =
		(master.timeline.startFrame / master.timeline.frameCount) * scrubberLine.rect.w + scrubberLine.rect.x;
	scrubberLine.endMarker.x =
		(master.timeline.endFrame / master.timeline.frameCount) * scrubberLine.rect.w + scrubberLine.rect.x;
	scrubberLine.startMarker.y = scrubberLine.rect.y + scrubberLine.rect.h + 6;
	scrubberLine.endMarker.y = scrubberLine.rect.y + scrubberLine.rect.h + 6;

	master.handsOnTable.render();

	updateScrubber(master.timeline.currentTime, master.timeline.duration);
	stage.update();
	master.updateScale();
	scrubber.update();
	frameArrows.update();
}

video.addEventListener('playing', () => {
	video.pause();
	video.currentTime = 0;
	background.image = video;
	master.updateVisiblePoints();
	drawGraphics(true);
	video.style.display = 'none';
});

video.addEventListener('error', () => {
	const error = video.error;
	const message = error ? `Video failed to load: ${error.message}` : 'Video failed to load.';
	console.error(message);
	const dropText = document.getElementById('file-drop-area')?.querySelector('.text');
	if (dropText) dropText.textContent = message;
	hideLoader();
});

stage.on('stagemousemove', (e: createjs.MouseEvent) => {
	const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);

	if (master.state.mode !== 'newScale') {
		posText.text = `Frame: ${master.timeline.currentFrame}, X: ${Math.round(coords.x)}, Y: ${Math.round(coords.y)}`;
	}

	stage.update();
});

stage.on('click', (e: createjs.MouseEvent) => {
	if (master.track != null) {
		if (master.track.state.mode === 'add') {
			const frame = master.timeline.current();
			if (frame === false) return;
			const scaled = master.toScaled(e.stageX, e.stageY);
			master.track.addPoint(frame, scaled.x, scaled.y);

			const nextFrame = master.timeline.next();
			if (nextFrame === false) return;
			master.timeline.setFrame(nextFrame.number);

			if (master.track.points[nextFrame.number] !== undefined)
				master.track.points[nextFrame.number].show().emphasize();
		}
	}
});
