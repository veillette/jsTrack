/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { hideLoader } from './functions';
import { master } from './globals';

/** Wraps JSZipUtils.getBinaryContent in a Promise. */
export function fetchBinaryContent(url: string): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		JSZipUtils.getBinaryContent(url, (err: Error | null, data: ArrayBuffer) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
}

export function loadVideo(file: File | Blob, callback: (() => void) | null = null): void {
	master.videoFile = file;
	master.timeline.video.src = URL.createObjectURL(file);
	if (callback !== null) {
		master.timeline.video.addEventListener('playing', callback);
	}
}

export async function loadProject(file: File, callback: (() => void) | null = null): Promise<void> {
	const fileUrl = URL.createObjectURL(file);
	const data = await fetchBinaryContent(fileUrl);
	const zipData = await JSZip.loadAsync(data);

	if (zipData.files['video.mp4'] !== undefined) {
		const videoBlob = await zipData.file('video.mp4').async('blob');
		loadVideo(videoBlob as Blob, async () => {
			if (zipData.files['meta.json'] !== undefined) {
				const projectJson = await zipData.file('meta.json').async('text');
				master.load(JSON.parse(projectJson));
				hideLoader();
				master.saved = true;
				master.trigger('created');
				if (callback !== null) callback();
			}
		});
	}
}

export function hideLaunchModal(): void {
	const container = document.getElementById('modal-container');
	if (container) {
		container.classList.remove('active');
		container.classList.remove('launch');
	}
	const launch = document.getElementById('launch');
	if (launch) launch.classList.remove('active');

	const helpFab = document.getElementById('help-fab');
	if (helpFab) helpFab.remove();
	const githubFab = document.getElementById('github-fab');
	if (githubFab) githubFab.remove();
	const paypalFab = document.getElementById('paypal-fab');
	if (paypalFab) paypalFab.remove();

	keyboardJS.resume();
}

export interface BackupData {
	name: string;
	data: Record<string, unknown>;
}

export let dataLoaded: BackupData | false = false;

export function setDataLoaded(value: BackupData | false): void {
	dataLoaded = value;
}
