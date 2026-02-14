/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { hideLoader, showLoader } from './functions';
import { CUSTOM_EXTENSION, master, newProject, VIDEO_CONVERTOR } from './globals';
import { dataLoaded, hideLaunchModal, loadProject, loadVideo } from './load';

export function handleFile(
	file: File | (Blob & { name?: string; type?: string }),
	callback: (() => void) | null = null,
): void {
	const fileType = (file as File).type || '';
	const fileName = (file as File).name || '';

	switch (fileType) {
		case 'video/mp4':
			if (dataLoaded !== false) {
				let canLoad = false;

				if (fileName !== dataLoaded.name) {
					if (confirm("This file doesn't match what the original video was named. Continue?")) canLoad = true;
					else canLoad = false;
				} else canLoad = true;

				if (canLoad) {
					loadVideo(file as File, () => {
						if (callback !== null) callback();

						if (dataLoaded !== false) master.load(dataLoaded.data);
						hideLoader();
						hideLaunchModal();
						master.saved = true;
						master.trigger('created');

						gtag('event', 'Import Video Existing Project', {
							event_category: 'Start',
							event_label: master.name,
						});
					});
				}
			} else {
				master.videoName = fileName;
				loadVideo(file as File, () => {
					if (callback !== null) callback();
					master.timeline.detectFrameRate((framerate: number) => {
						hideLaunchModal();
						newProject.push({ framerate: String(framerate) });
						newProject.show();
						hideLoader();
					});
				});
			}
			break;
		case '':
		case 'application/x-zip':
			if (fileName.split('.').pop() === CUSTOM_EXTENSION) {
				loadProject(file as File, callback);
				hideLaunchModal();
				gtag('event', 'Load Project File', {
					event_category: 'Start',
					event_label: fileName,
				});
			} else {
				alert(`This filetype is not supported. It must be .mp4 or .${CUSTOM_EXTENSION}`);
				hideLoader();
			}
			break;
		default:
			if (fileType.split('/')[0] === 'video') {
				if (
					confirm(
						"The only supported video type is mp4. Would you like to try the experimental video converter? (sometimes doesn't work, especially for longer videos)",
					)
				) {
					gtag('event', 'Agreed to Try Convertor', {
						event_category: 'Start',
						event_label: fileType,
					});
					showLoader();
					const filereader = new FileReader();
					filereader.onload = (result: ProgressEvent<FileReader>) => {
						const fileData = result.target?.result as ArrayBuffer;

						const worker = new Worker('src/ffmpeg-worker-mp4.js');
						worker.onmessage = (
							e: MessageEvent<{ type: string; data: { MEMFS: Array<{ data: ArrayBuffer }> } | string }>,
						) => {
							const msg = e.data;
							switch (msg.type) {
								case 'ready':
									worker.postMessage({
										MEMFS: [{ name: fileName, data: fileData }],
										type: 'run',
										arguments: ['-i', fileName, '-vcodec', 'copy', '-acodec', 'copy', 'out.mp4'],
									});
									break;
								case 'done': {
									const result = (msg.data as { MEMFS: Array<{ data: ArrayBuffer }> }).MEMFS[0];
									const dotIndex = fileName.indexOf('.');
									const name = fileName.substring(0, dotIndex !== -1 ? dotIndex : fileName.length);
									const blob = new File([result.data], `${name}.mp4`, {
										type: 'video/mp4',
									});
									master.videoName = blob.name;
									loadVideo(blob, () => {
										if (callback !== null) callback();
										master.timeline.detectFrameRate((framerate: number) => {
											hideLaunchModal();
											newProject.push({ framerate: String(framerate) });
											newProject.show();
											hideLoader();
										});
									});

									gtag('event', 'Convertor Done', {
										event_category: 'Start',
										event_label: fileType,
									});
									break;
								}
							}
						};
					};
					filereader.readAsArrayBuffer(file as File);
				} else if (confirm('Would you like to open a free online video converter in another tab?')) {
					hideLoader();
					window.open(VIDEO_CONVERTOR, '_blank');
				} else {
					hideLoader();
				}
			} else {
				hideLoader();
				alert(`This filetype is not supported. It must be .mp4 or .${CUSTOM_EXTENSION}`);
			}
			break;
	}
}

export function handleFiles(files: FileList): void {
	const fileArray = [...files];
	if (fileArray.length > 0) {
		const file = fileArray[0];
		handleFile(file);
	}
}
