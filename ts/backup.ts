/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { confirmModal } from './classes/modal';
import { deleteStorage, getStorage, setStorage } from './compatibility';
import { dataURLtoBlob, hideLoader, showLoader } from './functions';
import { master } from './globals';
import { fetchBinaryContent, hideLaunchModal, loadVideo, setDataLoaded } from './load';

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

function readAsDataURL(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

async function projectBackup(): Promise<void> {
	if (!master.videoFile) return;
	let success: number | false = false;

	try {
		const fileUrl = URL.createObjectURL(master.videoFile);
		const videoFile = await fetchBinaryContent(fileUrl);

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
		const dataBlob = await dataZip.generateAsync({ type: 'blob' });

		try {
			toBackup.data = await readAsDataURL(dataBlob);
			setStorage('backup', JSON.stringify(toBackup));

			if (!lastBackup.video || !sameProject) {
				try {
					const videoZip = new JSZip();
					videoZip.file('video.mp4', videoFile, { binary: true });
					const videoBlob = await videoZip.generateAsync({ type: 'blob' });
					const videoDataUrl = await readAsDataURL(videoBlob);

					try {
						setStorage('video', videoDataUrl);
						deleteStorage('video');
						toBackup.video = videoDataUrl;
						setStorage('backup', JSON.stringify(toBackup));
						master.backup();
						success = 2;
					} catch {
						toBackup.video = undefined;
						setStorage('backup', JSON.stringify(toBackup));
						master.backup();
						success = 1;
					}
				} catch (err) {
					console.error(err);
					success = false;
				}
			} else if (sameProject) {
				if (lastBackup.video) {
					try {
						setStorage('video', lastBackup.video);
						deleteStorage('video');
						toBackup.video = lastBackup.video;
						setStorage('backup', JSON.stringify(toBackup));
						master.backup();
						success = 2;
					} catch {
						toBackup.video = undefined;
						setStorage('backup', JSON.stringify(toBackup));
						master.backup();
						success = 1;
					}
				} else {
					success = 1;
				}
			} else {
				success = 1;
			}
		} catch {
			if (lastBackupRaw) setStorage('backup', lastBackupRaw);
			master.backup();
			success = false;
		}
	} catch (err) {
		console.error(err);
		success = false;
	}

	updateBackup(success);
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
if (backupRaw) {
	const launchEl = document.getElementById('launch');
	if (launchEl?.classList.contains('active')) {
		(async () => {
			const backupInfo: BackupInfo = JSON.parse(backupRaw);
			const dateStr = backupInfo.date || new Date().toString();
			const date = new Date(dateStr).toLocaleString();
			if (
				await confirmModal(
					`You have a project backup from ${date}. Would you like to recover this?`,
					'Recover Backup',
				)
			) {
				if (backupInfo.video) {
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
										if (backupInfo.data) {
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
				} else if (backupInfo.data) {
					const file = dataURLtoBlob(backupInfo.data);
					const fileUrl = URL.createObjectURL(file);
					JSZipUtils.getBinaryContent(fileUrl, (err: Error | null, data: ArrayBuffer) => {
						if (err) throw err;

						JSZip.loadAsync(data).then((zipData: JSZip) => {
							zipData
								.file('meta.json')
								.async('text')
								.then(async (projectJson: string) => {
									let videoName = '';
									let rawVideoName = '';
									if (backupInfo.videoName) {
										videoName = `(${backupInfo.videoName}) `;
										rawVideoName = backupInfo.videoName;
									}
									if (
										await confirmModal(
											'There is no video saved in this backup, you will need to be able to access the original video ' +
												videoName +
												'to load it yourself. Would you like to continue?',
											'Missing Video',
										)
									) {
										const dropText = document
											.getElementById('file-drop-area')
											?.querySelector('.text');
										if (dropText)
											dropText.textContent = 'Drag the video here to recover your project, or';
										setDataLoaded({
											name: rawVideoName,
											data: JSON.parse(projectJson),
										});
									} else {
										if (
											await confirmModal(
												'Would you like to remove this backup from storage?',
												'Remove Backup',
											)
										) {
											deleteStorage('backup');
										}
									}
								});
						});
					});
				} else {
					if (
						await confirmModal(
							'Error opening project. Would you like to remove it from storage?',
							'Backup Error',
						)
					) {
						deleteStorage('backup');
					}
				}
			} else {
				if (await confirmModal('Would you like to delete this from storage?', 'Delete Backup')) {
					deleteStorage('backup');
				}
			}
		})();
	}
}
