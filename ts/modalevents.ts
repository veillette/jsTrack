/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { hideLoader, showLoader } from './functions';
import {
	CUSTOM_EXTENSION,
	canvas,
	EXPORT_FORMATS,
	editProject,
	editScale,
	editTrack,
	exportData,
	GOOGLE_API_KEY,
	GOOGLE_CLIENT_ID,
	master,
	newProject,
	newScale,
	newTrack,
	saveProject,
	stage,
} from './globals';
import { DriveUpload } from './saveDrive';

newProject.on('submit', function (data) {
	if (!data) return;
	master.name = data.name;
	master.videoSpeed = parseFloat(data.videospeed);
	master.timeline.frameSkip = parseInt(data.frameskip, 10);
	master.timeline.updateTiming(master.timeline.video.duration, data.framerate);
	master.timeline.createFrames();
	const axesPos = master.toScaled(canvas.width / 2, canvas.height / 2);
	master.newAxes(axesPos.x, axesPos.y, data.axesColor, true);
	this.hide().clear();
	master.viewPoints = {
		forward: parseInt(data.pointsForward, 10),
		backward: parseInt(data.pointsBackward, 10),
	};
	master.updateVisiblePoints();
	master.created = true;
	master.trigger('created');

	gtag('event', 'New Project', {
		event_category: 'Start',
		event_label: master.name,
	});
});

saveProject
	.on('saveFile', function (modalData) {
		if (!modalData) return;
		if (!master.videoFile) return;
		showLoader();
		const fileUrl = URL.createObjectURL(master.videoFile);
		JSZipUtils.getBinaryContent(fileUrl, (err: Error | null, data: ArrayBuffer) => {
			if (err) {
				console.log(err);
			}

			let filename = modalData.filename || '';

			if (filename.length === 0) {
				filename = `${master.name.toLowerCase().replace(' ', '_')}-${Date.now()}.${CUSTOM_EXTENSION}`;
			} else if (filename.split('.').pop() !== CUSTOM_EXTENSION) filename += `.${CUSTOM_EXTENSION}`;

			const projectInfo = JSON.stringify(master.save());
			const zip = new JSZip();

			zip.file('video.mp4', data, { binary: true }).file('meta.json', projectInfo);

			zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' }).then(
				(blob: Blob) => {
					saveAs(blob, filename);
					master.saved = true;
					hideLoader();
				},
				(err: Error) => {
					console.log(err);
				},
			);
		});

		this.hide().clear();
	})
	.on('create', function (this: typeof saveProject) {
		const button = document.getElementById(`${this.id}_button-saveDrive`) as HTMLButtonElement | null;
		if (button) button.disabled = true;
		const checkLoaded = setInterval(() => {
			try {
				if (typeof gapi !== 'undefined') {
					if (gapi.client !== undefined) {
						const logoutEl = document.getElementById('logout-button');
						const saveDriveBtn = document.getElementById(
							`${this.id}_button-saveDrive`,
						) as HTMLButtonElement | null;
						if (saveDriveBtn && logoutEl) {
							new DriveUpload({
								apiKey: GOOGLE_API_KEY,
								clientId: GOOGLE_CLIENT_ID,
								buttonEl: saveDriveBtn,
								logoutEl: logoutEl,
								getFile: (callback) => {
									if (!master.videoFile) return;
									showLoader();
									const fileUrl = URL.createObjectURL(master.videoFile);
									JSZipUtils.getBinaryContent(fileUrl, (err: Error | null, data: ArrayBuffer) => {
										if (err) {
											console.log(err);
										}

										const exported = this.export();
										let filename = exported?.filename || '';
										if (filename.length === 0) {
											filename =
												master.name.toLowerCase().replace(' ', '_') +
												'-' +
												Date.now() +
												'.' +
												CUSTOM_EXTENSION;
										} else if (filename.split('.').pop() !== CUSTOM_EXTENSION)
											filename += `.${CUSTOM_EXTENSION}`;

										const projectInfo = JSON.stringify(master.save());
										const zip = new JSZip();

										zip.file('video.mp4', data, { binary: true }).file('meta.json', projectInfo);

										zip.generateAsync({
											type: 'blob',
											mimeType: 'application/octet-stream',
										}).then(
											(zipFile: Blob) => {
												const reader = new FileReader();
												reader.onload = () => {
													callback(
														reader.result as unknown as ArrayBuffer,
														filename,
														(_success: boolean) => {
															hideLoader();
															this.hide();
														},
													);
												};
												reader.readAsArrayBuffer(zipFile);
											},
											(err: Error) => {
												console.log(err);
											},
										);
									});
								},
							});
						}
						clearInterval(checkLoaded);
					}
				}
			} catch {
				console.log('Google could not be loaded.');
				clearInterval(checkLoaded);
			}
		}, 400);
	})
	.on('cancel', function () {
		this.hide().clear();
	});

editProject
	.on('submit', function (data) {
		if (!data) return;
		master.name = data.name;
		master.timeline.frameSkip = parseInt(data.frameskip, 10);
		master.axes?.updateColor(data.axesColor);
		this.hide().clear();
		master.viewPoints = {
			forward: parseInt(data.pointsForward, 10),
			backward: parseInt(data.pointsBackward, 10),
		};
		master.updateVisiblePoints();
	})
	.on('cancel', function () {
		this.hide().clear();
	});

exportData
	.on('submit', function (data) {
		if (!data) return;
		const workbook = XLSX.utils.book_new();

		for (const uid in master.trackList) {
			const track = master.trackList[uid];
			const ws = XLSX.utils.aoa_to_sheet(track.export().table.scaled);
			XLSX.utils.book_append_sheet(workbook, ws, track.name);
		}

		let filename = data.filename;

		if (filename.split('.').length <= 1) filename += '.xlsx';

		if (!EXPORT_FORMATS.includes(filename.split('.')[filename.split('.').length - 1])) filename += '.xlsx';

		XLSX.writeFile(workbook, filename);

		this.hide().clear();
	})
	.on('cancel', function () {
		this.hide().clear();
	});

editScale
	.on('cancel', function () {
		this.hide().clear();
	})
	.on('submit', function (data) {
		if (!data) return;
		master.scale?.updateInfo({ color: data.color });
		this.hide();
	});

let scaleClickCounter = 3;
newScale
	.on('submit', function (data) {
		if (!data) return;
		master.state.mode = 'newScale';
		scaleClickCounter = 1;
		const locations = {
			point1: { x: 0, y: 0 },
			point2: { x: 0, y: 0 },
		};
		const posTextEl = stage.children.find((c) => c instanceof createjs.Text) as createjs.Text | undefined;
		if (posTextEl) posTextEl.text = 'Click for 1st end of scale';
		stage.on('click', (e: createjs.MouseEvent) => {
			const mouseCoords = master.toScaled(e.stageX, e.stageY);
			if (scaleClickCounter === 1) {
				locations.point1 = { x: mouseCoords.x, y: mouseCoords.y };
				if (posTextEl) posTextEl.text = 'Click for 2nd end of scale';
				scaleClickCounter++;
			} else if (scaleClickCounter === 2) {
				locations.point2 = { x: mouseCoords.x, y: mouseCoords.y };
				const scale = master.newScale(
					null,
					locations.point1.x,
					locations.point1.y,
					locations.point2.x,
					locations.point2.y,
					data.color,
				);
				window.setTimeout(() => {
					scale.textElement.dispatchEvent(new Event('startEditing'));
					scale.textElement.value = '';
					scale.textElement.focus();
				}, 200);
				stage.cursor = 'default';
				master.state.default();
				scaleClickCounter++;
			}
		});
		this.hide().clear();
	})
	.on('cancel', function () {
		this.hide().clear();
	});

editTrack
	.on('cancel', function () {
		this.hide().clear();
	})
	.on('submit', function (data) {
		if (!data) return;
		if (master.trackList[data.uid] !== undefined) {
			master.trackList[data.uid].update({
				name: data.name,
				color: data.color,
			});
		}
		this.hide();
	});

newTrack
	.on('cancel', function () {
		this.hide().clear();
	})
	.on('submit', function (data) {
		if (!data) return;
		this.hide().clear();
		master.newTrack(data.name, data.color, true);
	});
