/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { editProject, editScale, editTrack, exportData, master, newScale, newTrack, saveProject } from './globals';
import { drawGraphics } from './index';

document.getElementById('new-project')?.addEventListener('click', () => {
	window.location.reload();
});

document.getElementById('sidebar-visibility')?.addEventListener('click', function (this: HTMLElement) {
	const sidebarEl = document.getElementById('sidebar');
	const visEl = document.getElementById('sidebar-visibility');
	if (!sidebarEl || !visEl) return;

	if (this.classList.contains('show')) {
		sidebarEl.classList.add('normal');
		sidebarEl.classList.remove('hidden');
		visEl.classList.add('hide');
		visEl.classList.remove('show');
	} else {
		sidebarEl.classList.remove('normal');
		sidebarEl.classList.add('hidden');
		visEl.classList.add('show');
		visEl.classList.remove('hide');
	}

	sidebarEl.classList.add('changed');
	visEl.style.right = `${sidebarEl.offsetWidth}px`;
	drawGraphics();
});

document.querySelector('#new-track-button:not(.disabled)')?.addEventListener('click', () => {
	newTrack.push({
		color: newTrack.defaultColors[Math.floor(Math.random() * newTrack.defaultColors.length)],
	});
	newTrack.show();
});

document.getElementById('play-pause-button')?.addEventListener('click', function (this: HTMLElement) {
	if (this.classList.contains('play')) {
		master.timeline.play();
		this.classList.remove('play');
		this.classList.add('pause');
	} else {
		master.timeline.pause();
		this.classList.remove('pause');
		this.classList.add('play');
	}
});

document.querySelector('#undo-button:not(.disabled)')?.addEventListener('click', () => {
	master.undo();
});

document.querySelector('#screen-fit-button')?.addEventListener('click', function (this: HTMLElement) {
	if (!this.classList.contains('disabled')) {
		master.positioning.zoom = 1;
		master.positioning.autoZoom = true;
		master.positioning.stuck = true;
		drawGraphics();
		this.classList.add('disabled');
	}
});

document.querySelector('#redo-button:not(.disabled)')?.addEventListener('click', () => {
	master.redo();
});

document.getElementById('export-button')?.addEventListener('click', function (this: HTMLElement) {
	if (!this.classList.contains('disabled')) exportData.show();
});

document.querySelector('#save-button:not(.disabled)')?.addEventListener('click', () => {
	saveProject.show();
});

document.querySelectorAll('.help-button:not(.disabled)').forEach((el) => {
	el.addEventListener('click', () => {
		window.open('using_jstrack.pdf', '_blank');
	});
});

document.querySelector('#scale-button:not(.disabled)')?.addEventListener('click', () => {
	if (master.scale != null) {
		editScale
			.push({
				color: master.scale.color,
			})
			.show();
	} else {
		newScale.show();
	}
});

document.querySelector('#edit-project-button:not(.disabled)')?.addEventListener('click', () => {
	if (!master.axes) return;
	editProject
		.push({
			name: master.name,
			framerate: String(master.timeline.fps),
			frameskip: String(master.timeline.frameSkip),
			axesColor: master.axes.color,
			pointsForward: String(master.viewPoints.forward),
			pointsBackward: String(master.viewPoints.backward),
		})
		.show();
});

master.on('undo, created, change', function (this: typeof master) {
	const el = document.getElementById('undo-button');
	if (!el) return;
	if (this.undoManager.hasUndo()) el.classList.remove('disabled');
	else el.classList.add('disabled');
});

master.on('redo, created, change', function (this: typeof master) {
	const el = document.getElementById('redo-button');
	if (!el) return;
	if (this.undoManager.hasRedo()) el.classList.remove('disabled');
	else el.classList.add('disabled');
});

const trackListUl = document.getElementById('track-list')?.querySelector('ul');
if (trackListUl) {
	trackListUl.querySelectorAll('li').forEach((element) => {
		element.addEventListener('click', function (this: HTMLElement) {
			const uid = this.getAttribute('data-uid');
			if (uid) master.switchTrack(uid);
		});
		element.addEventListener('dblclick', function (this: HTMLElement) {
			const uid = this.getAttribute('data-uid');
			if (uid && master.trackList[uid] !== undefined) {
				editTrack
					.push({
						name: master.trackList[uid].name,
						color: master.trackList[uid].color,
						uid: uid,
					})
					.show();
			}
		});
	});
}
