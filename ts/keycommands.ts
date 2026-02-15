/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { ARROW_KEY_STEP_PX } from './constants';
import { canvas, master, saveProject } from './globals';
import { drawGraphics } from './index';

keyboardJS.pause();
keyboardJS.on(
	'shift',
	(e: KeyboardJSEvent) => {
		e.preventRepeat();
		if (master.track != null) {
			master.state.mode = 'add';
			for (const uid in master.trackList) {
				master.trackList[uid].state.mode = 'add';
			}
		}
	},
	() => {
		if (master.track != null) {
			master.state.reset();
			for (const uid in master.trackList) {
				master.trackList[uid].state.resetMode();
			}
		}
	},
);

keyboardJS.on(
	's',
	(e: KeyboardJSEvent) => {
		e.preventRepeat();
		master.state.mode = 'seek';
	},
	() => {
		master.state.reset();
	},
);

keyboardJS.on(['delete', 'backspace'], () => {
	if (master.track != null) {
		if (master.track.selectedPoint != null) {
			master.track.selectedPoint.shape.dispatchEvent(new Event('dblclick'));
		}
	}
});

keyboardJS.on(['up', 'down', 'right', 'left'], (e: KeyboardJSEvent) => {
	const bg = master.background as createjs.Bitmap & { w: number; h: number };
	const newPos = { x: master.positioning.x, y: master.positioning.y };

	switch (e.key) {
		case 'ArrowLeft':
			newPos.x += ARROW_KEY_STEP_PX;
			break;
		case 'ArrowRight':
			newPos.x -= ARROW_KEY_STEP_PX;
			break;
		case 'ArrowUp':
			newPos.y += ARROW_KEY_STEP_PX;
			break;
		case 'ArrowDown':
			newPos.y -= ARROW_KEY_STEP_PX;
			break;
	}

	if (newPos.x + bg.w < canvas.width) {
		newPos.x = canvas.width - bg.w;
	}
	if (newPos.x > 0 && bg.w > canvas.width) {
		newPos.x = 0;
	}
	if (newPos.y + bg.h < canvas.height) {
		newPos.y = canvas.height - bg.h;
	}
	if (newPos.y > 0 && bg.h > canvas.height) {
		newPos.y = 0;
	}

	if (bg.w > canvas.width) {
		master.positioning.x = newPos.x;
		master.positioning.stuck = false;
	}
	if (bg.h > canvas.height) {
		master.positioning.y = newPos.y;
		master.positioning.stuck = false;
	}
});

keyboardJS.on(['ctrl + =', 'ctrl + +', 'cmd + =', 'cmd + +'], (e: KeyboardJSEvent) => {
	e.preventDefault();
	master.positioning.zoom += 0.01;
});

keyboardJS.on(['ctrl + -', 'cmd + -'], (e: KeyboardJSEvent) => {
	e.preventDefault();
	if (master.positioning.zoom > 0.02) master.positioning.zoom -= 0.01;
	else master.positioning.zoom = 0.01;
});

keyboardJS.on(['=', '+'], () => {
	master.positioning.zoom += 0.05;
});

keyboardJS.on('-', () => {
	if (master.positioning.zoom > 0.1) master.positioning.zoom -= 0.05;
	else master.positioning.zoom = 0.05;
});

keyboardJS.on(['ctrl + 0', 'cmd + 0'], (e: KeyboardJSEvent) => {
	e.preventDefault();
	master.positioning.zoom = 1;
	master.positioning.autoZoom = true;
	master.positioning.stuck = true;
	drawGraphics();
	const el = document.getElementById('screen-fit-button');
	if (el) el.classList.add('disabled');
});

keyboardJS.on(
	'ctrl',
	(e: KeyboardJSEvent) => {
		e.preventRepeat();
		master.state.mode = 'positioning';
	},
	() => {
		master.state.reset();
	},
);

keyboardJS.on(['ctrl+z', 'cmd+z'], () => {
	master.undo();
});

keyboardJS.on(['ctrl+y', 'cmd+y'], () => {
	master.redo();
});

keyboardJS.on(['ctrl+s', 'cmd+s'], (e: KeyboardJSEvent) => {
	e.preventRepeat();
	e.preventDefault();
	saveProject.show();
});
