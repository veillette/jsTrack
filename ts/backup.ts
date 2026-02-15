/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { deleteStorage, getStorage, setStorage } from './compatibility';
import { dataURLtoBlob, hideLoader, showLoader } from './functions';
import { master } from './globals';
import { hideLaunchModal, loadVideo, setDataLoaded } from './load';

function updateBackup(state: number | string | false): void {
	const backupStatus = document.getElementById('backup-status');
	if (!backupStatus) return;
	switch (state) {
		case 1:
			backupStatus.style.opacity = '1';
			backupStatus.style.backgroundColor = 'yellow';
			if (master.backUpDate) {
				backupStatus.title =
					'Partially backed up on ' +
					master.backUpDate.toLocaleDateString() +
					' at ' +
					master.backUpDate.toLocaleTimeString();
			}
			break;
		case 2:
			backupStatus.style.opacity = '1';
			backupStatus.style.backgroundColor = '#07ff07';
			if (master.backUpDate) {
				backupStatus.title =
					'Backed up on ' +
					master.backUpDate.toLocaleDateString() +
					' at ' +
					master.backUpDate.toLocaleTimeString();
			}
			break;
		case 'loading':
			backupStatus.style.opacity = '0.5';
			backupStatus.style.backgroundColor = 'grey';
			backupStatus.title = 'Backing up...';
			break;
		default:
			backupStatus.style.opacity = '1';
			backupStatus.style.backgroundColor = 'red';
			backupStatus.title = 'Unable to backup changes';
			break;
	}
}

interface BackupInfo {
	uid: string;
	video: string | null | undefined;
	date: string | null;
	data?: string;
	videoName?: string;
}

function projectBackup(): void {
	if (!master.videoFile) return;
	let success: number | false = false;
	const fileUrl = URL.createObjectURL(master.videoFile);
	JSZipUtils.getBinaryContent(fileUrl, (err: Error | null, videoFile: ArrayBuffer) => {
		if (err) {
			console.log(err);
			success = false;
			updateBackup(success);
		}

		const projectInfo = JSON.stringify(master.save());
		const lastBackupRaw = getStorage('backup');
		const lastBackupParsed: BackupInfo | null = lastBackupRaw ? JSON.parse(lastBackupRaw) : null;
		const lastBackup: BackupInfo = lastBackupParsed ?? { uid: '', video: null, date: null };

		const toBackup: BackupInfo = {
			uid: String(master.uid),
			date: new Date().toString(),
			videoName: master.videoName,
			video: undefined,
			data: undefined,
		};

		const sameProject = lastBackup.uid === String(master.uid);

		deleteStorage('backup');

		const dataZip = new JSZip();
		dataZip.file('meta.json', projectInfo);
		dataZip.generateAsync({ type: 'blob' }).then(
			(blob: Blob) => {
				const reader = new FileReader();
				reader.readAsDataURL(blob);
				reader.onload = () => {
					try {
						toBackup.data = reader.result as string;
						setStorage('backup', JSON.stringify(toBackup));

						if (
							lastBackup.video === null ||
							lastBackup.video === '' ||
							lastBackup.video === undefined ||
							!sameProject
						) {
							const videoZip = new JSZip();
							videoZip.file('video.mp4', videoFile, { binary: true });
							videoZip.generateAsync({ type: 'blob' }).then(
								(blob: Blob) => {
									const reader = new FileReader();
									reader.readAsDataURL(blob);
									reader.onload = () => {
										try {
											setStorage('video', reader.result as string);
											deleteStorage('video');
											toBackup.video = reader.result as string;
											setStorage('backup', JSON.stringify(toBackup));
											master.backup();
											success = 2;
											updateBackup(success);
										} catch {
											toBackup.video = undefined;
											setStorage('backup', JSON.stringify(toBackup));
											master.backup();
											success = 1;
											updateBackup(success);
										}
									};
								},
								(err: Error) => {
									console.log(err);
									success = false;
									updateBackup(success);
								},
							);
						} else if (sameProject) {
							if (
								lastBackup.video !== null &&
								lastBackup.video !== '' &&
								lastBackup.video !== undefined
							) {
								try {
									setStorage('video', lastBackup.video);
									deleteStorage('video');
									toBackup.video = lastBackup.video;
									setStorage('backup', JSON.stringify(toBackup));
									master.backup();
									success = 2;
									updateBackup(success);
								} catch {
									toBackup.video = undefined;
									setStorage('backup', JSON.stringify(toBackup));
									master.backup();
									success = 1;
									updateBackup(success);
								}
							} else {
								success = 1;
								updateBackup(success);
							}
						} else {
							success = 1;
							updateBackup(success);
						}
					} catch {
						if (lastBackupRaw) setStorage('backup', lastBackupRaw);
						master.backup();
						success = false;
						updateBackup(success);
					}
				};
			},
			(err: Error) => {
				console.log(err);
				success = false;
				updateBackup(success);
			},
		);
	});
}

master.on('change', function (this: typeof master) {
	if (!this.saved && this.created && !this.backedUp) {
		updateBackup('loading');
		projectBackup();
	} else if (this.saved) {
		deleteStorage('backup');
	}
});

const backupRaw = getStorage('backup');
if (backupRaw !== undefined && backupRaw !== null && backupRaw !== '') {
	const launchEl = document.getElementById('launch');
	if (launchEl?.classList.contains('active')) {
		const backupInfo: BackupInfo = JSON.parse(backupRaw);
		const dateStr = backupInfo.date || new Date().toString();
		const date = new Date(dateStr).toLocaleString();
		if (confirm(`You have a project backup from ${date}. Would you like to recover this?`)) {
			if (backupInfo.video !== undefined && backupInfo.video !== null && backupInfo.video !== '') {
				showLoader();
				const file = dataURLtoBlob(backupInfo.video);

				const fileUrl = URL.createObjectURL(file);
				JSZipUtils.getBinaryContent(fileUrl, (err: Error | null, data: ArrayBuffer) => {
					if (err) throw err;

					JSZip.loadAsync(data).then((zipData: JSZip) => {
						zipData
							.file('video.mp4')
							.async('blob')
							.then((videoBlob: Blob) => {
								loadVideo(videoBlob, () => {
									if (
										backupInfo.data !== undefined &&
										backupInfo.data !== null &&
										backupInfo.data !== ''
									) {
										const dataFile = dataURLtoBlob(backupInfo.data);

										const dataFileUrl = URL.createObjectURL(dataFile);
										JSZipUtils.getBinaryContent(
											dataFileUrl,
											(err: Error | null, innerData: ArrayBuffer) => {
												if (err) throw err;

												JSZip.loadAsync(innerData).then((innerZipData: JSZip) => {
													innerZipData
														.file('meta.json')
														.async('text')
														.then((projectJson: string) => {
															master.load(JSON.parse(projectJson));
															hideLoader();
															hideLaunchModal();
															master.saved = true;
															master.trigger('created');
														});
												});
											},
										);
									}
								});
							});
					});
				});
			} else if (backupInfo.data !== undefined && backupInfo.data !== null && backupInfo.data !== '') {
				const file = dataURLtoBlob(backupInfo.data);
				const fileUrl = URL.createObjectURL(file);
				JSZipUtils.getBinaryContent(fileUrl, (err: Error | null, data: ArrayBuffer) => {
					if (err) throw err;

					JSZip.loadAsync(data).then((zipData: JSZip) => {
						zipData
							.file('meta.json')
							.async('text')
							.then((projectJson: string) => {
								let videoName = '';
								let rawVideoName = '';
								if (
									backupInfo.videoName !== undefined &&
									backupInfo.videoName !== null &&
									backupInfo.videoName !== ''
								) {
									videoName = `(${backupInfo.videoName}) `;
									rawVideoName = backupInfo.videoName;
								}
								if (
									confirm(
										'There is no video saved in this backup, you will need to be able to access the original video ' +
											videoName +
											'to load it yourself. Would you like to continue?',
									)
								) {
									const dropText = document.getElementById('file-drop-area')?.querySelector('.text');
									if (dropText)
										dropText.textContent = 'Drag the video here to recover your project, or';
									setDataLoaded({
										name: rawVideoName,
										data: JSON.parse(projectJson),
									});
								} else {
									if (confirm('Would you like to remove this backup from storage?')) {
										deleteStorage('backup');
									}
								}
							});
					});
				});
			} else {
				if (confirm('Error opening project. Would you like to remove it from storage?')) {
					deleteStorage('backup');
				}
			}
		} else {
			if (confirm('Would you like to delete this from storage?')) {
				deleteStorage('backup');
			}
		}
	}
}
