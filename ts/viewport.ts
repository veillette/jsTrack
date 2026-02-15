/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { ZOOM_SENSITIVITY_DIVISOR } from './constants';
import { background2, canvas, master } from './globals';

let originalCoords = { x: 0, y: 0 };
let originalPosition = { x: master.positioning.x, y: master.positioning.y };
let backgroundDimensions = {
	w: (master.background as createjs.Bitmap & { w: number }).w,
	h: (master.background as createjs.Bitmap & { h: number }).h,
};

master.addBackground.on('mousedown', (e: createjs.MouseEvent) => {
	originalCoords = { x: e.stageX, y: e.stageY };
	originalPosition = { x: master.positioning.x, y: master.positioning.y };
	backgroundDimensions = {
		w: (master.background as createjs.Bitmap & { w: number }).w,
		h: (master.background as createjs.Bitmap & { h: number }).h,
	};
});
master.addBackground.on('pressmove', (e: createjs.MouseEvent) => {
	const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);
	if (master.state.mode === 'positioning') {
		const newPos = {
			x: originalPosition.x + coords.x - originalCoords.x,
			y: originalPosition.y + coords.y - originalCoords.y,
		};

		if (newPos.x + backgroundDimensions.w < canvas.width) {
			newPos.x = canvas.width - backgroundDimensions.w;
		}
		if (newPos.x > 0 && backgroundDimensions.w > canvas.width) {
			newPos.x = 0;
		}
		if (newPos.y + backgroundDimensions.h < canvas.height) {
			newPos.y = canvas.height - backgroundDimensions.h;
		}
		if (newPos.y > 0 && backgroundDimensions.h > canvas.height) {
			newPos.y = 0;
		}

		if (backgroundDimensions.w > canvas.width) {
			master.positioning.x = newPos.x;
			master.positioning.stuck = false;
		}
		if (backgroundDimensions.h > canvas.height) {
			master.positioning.y = newPos.y;
			master.positioning.stuck = false;
		}
	}
});

canvas.addEventListener('wheel', (e: WheelEvent) => {
	e.preventDefault();
	if (master.state.mode === 'positioning') {
		if (master.positioning.zoom > 0.01 || Math.sign(e.deltaY) === -1)
			master.positioning.zoom -= e.deltaY / ZOOM_SENSITIVITY_DIVISOR;

		if (master.positioning.zoom <= 0.01) master.positioning.zoom = 0.01;
	}
});

master.positioning
	.on('zoomin, zoomout', function (this: typeof master, e) {
		const bg = this.background as createjs.Bitmap & { w: number; h: number };
		const newPos = { x: master.positioning.x, y: master.positioning.y };

		newPos.x -= (this.timeline.video.videoWidth * (e.delta || 0)) / 2;
		newPos.y -= (this.timeline.video.videoHeight * (e.delta || 0)) / 2;

		if (bg.w > this.stage.canvas.width) {
			if (newPos.x + bg.w < this.stage.canvas.width) this.positioning.x = canvas.width - bg.w;
			else if (newPos.x > 0) this.positioning.x = 0;
			else this.positioning.x = newPos.x;
		} else {
			this.positioning.x = (this.stage.canvas.width - bg.w) / 2;
		}

		if (bg.h > this.stage.canvas.height) {
			if (newPos.y + bg.h < this.stage.canvas.height) this.positioning.y = canvas.height - bg.h;
			else if (newPos.y > 0) this.positioning.y = 0;
			else this.positioning.y = newPos.y;
		} else {
			this.positioning.y = (this.stage.canvas.height - bg.h) / 2;
		}
	})
	.on('zoom, translation', function (this: typeof master) {
		const bg = this.background as createjs.Bitmap & { x: number; y: number; scale: number };
		background2.scale = bg.scale;
		background2.x = bg.x;
		background2.y = bg.y;
	})
	.on('zoom', () => {
		const el = document.getElementById('screen-fit-button');
		if (el) el.classList.remove('disabled');
	});
