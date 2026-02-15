/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { RESIZE_DEBOUNCE_MS } from './constants';
import { showLoader } from './functions';
import { sidebar } from './globals';
import { handleFiles } from './handlefiles';
import { drawGraphics } from './index';

interact('#sidebar')
	.resizable({
		edges: { left: true },
		restrictEdges: {
			outer: 'parent',
			endOnly: true,
		},
		restrictSize: {
			min: { width: 400 },
			max: { width: window.innerWidth - 300 },
		},
		inertia: true,
	})
	.on('resizemove', (event: InteractEvent) => {
		const target = event.target;
		target.style.width = `${event.rect.width}px`;
		const vis = document.getElementById('sidebar-visibility');
		if (vis) vis.style.right = `${event.rect.width}px`;
	})
	.on('resizeend', () => {
		drawGraphics();
	});

const sidebarEl = document.getElementById('sidebar');
const panelMove = dragula(sidebarEl ? [sidebarEl] : [], {
	direction: 'vertical',
	moves: (_el: HTMLElement, _source: HTMLElement, handle: HTMLElement) => {
		if (!handle.classList.contains('handle-bar')) {
			return false;
		} else {
			handle.style.cursor = 'grabbing';
			return true;
		}
	},
});

let scroll = 0;
let scrollInterval: ReturnType<typeof setInterval> | null = null;
panelMove
	.on('drag', (el: HTMLElement) => {
		const handleBar = el.querySelector('.handle-bar') as HTMLElement | null;
		if (handleBar) handleBar.style.cursor = 'grabbing';
		scrollInterval = setInterval(() => {
			const mirror = document.querySelector('.gu-mirror');
			if (!mirror) return;
			const position = mirror.getBoundingClientRect();

			if (panelMove.dragging) {
				if (position.top < 100) {
					scroll = -1;
				} else if (position.top > window.innerHeight - 100) {
					scroll = 1;
				} else {
					scroll = 0;
				}
			} else {
				scroll = 0;
			}
			const sidebarScroll = document.getElementById('sidebar');
			if (sidebarScroll) sidebarScroll.scrollTop += scroll * 20;
		}, 100);
	})
	.on('dragend', (el: HTMLElement) => {
		const handleBar = el.querySelector('.handle-bar') as HTMLElement | null;
		if (handleBar) handleBar.style.cursor = 'grab';
		if (scrollInterval !== null) {
			clearInterval(scrollInterval);
			scrollInterval = null;
		}
	});

let resizeTimer: ReturnType<typeof setTimeout>;
window.addEventListener('resize', () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(drawGraphics, RESIZE_DEBOUNCE_MS);
	const vis = document.getElementById('sidebar-visibility');
	if (vis) vis.style.right = `${sidebar.offsetWidth}px`;
});

// ─── File drop area ───

const dropArea = document.getElementById('file-drop-area');
if (dropArea) {
	['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
		dropArea.addEventListener(
			eventName,
			(e) => {
				e.preventDefault();
				e.stopPropagation();
			},
			false,
		);
		document.body.addEventListener(
			eventName,
			(e) => {
				e.preventDefault();
				e.stopPropagation();
			},
			false,
		);
	});

	['dragenter', 'dragover'].forEach((eventName) => {
		dropArea.addEventListener(
			eventName,
			() => {
				dropArea.classList.add('highlight');
			},
			false,
		);
	});

	['dragleave', 'drop'].forEach((eventName) => {
		dropArea.addEventListener(
			eventName,
			() => {
				dropArea.classList.remove('highlight');
			},
			false,
		);
	});

	dropArea.addEventListener(
		'drop',
		(e: DragEvent) => {
			showLoader();
			const dt = e.dataTransfer;
			if (dt) {
				const files = dt.files;
				handleFiles(files);
			}
		},
		false,
	);
}

const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
if (fileInput) {
	fileInput.addEventListener('change', function (this: HTMLInputElement) {
		if (this.files) {
			handleFiles(this.files);
			showLoader();
		}
	});
}
