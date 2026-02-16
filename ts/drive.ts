/**
 * Based on Google Drive File Picker Example
 * By Daniel Lo Nigro (http://dan.cx/)
 */

import { showLoader } from './functions';
import {
	GOOGLE_API_KEY,
	GOOGLE_APP_ID,
	getAccessToken,
	initGoogleApis,
	requestAccessToken,
	revokeAccessToken,
} from './googleAuth';
import { handleFile } from './handlefiles';

interface FilePickerOptions {
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	onSelect: (file: DriveFile) => void;
}

class FilePicker {
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	onSelect: (file: DriveFile) => void;
	picker: google.picker.Picker | null = null;

	constructor(options: FilePickerOptions) {
		this.buttonEl = options.buttonEl;
		this.logoutEl = options.logoutEl;
		this.onSelect = options.onSelect;
		this.buttonEl.addEventListener('click', this.open.bind(this));
		this.logoutEl.addEventListener('click', () => {
			if (!this.logoutEl.classList.contains('disabled')) {
				revokeAccessToken();
				this.logoutEl.classList.add('disabled');
			}
		});

		this.buttonEl.disabled = true;
		initGoogleApis().then(this._onApisLoaded.bind(this)).catch(console.error);
	}

	private _onApisLoaded(): void {
		this.buttonEl.disabled = false;
	}

	open(): void {
		const token = getAccessToken();
		if (token) {
			this._showPicker(token);
			this.logoutEl.classList.remove('disabled');
		} else {
			requestAccessToken('consent')
				.then((accessToken) => {
					this._showPicker(accessToken);
					this.logoutEl.classList.remove('disabled');
				})
				.catch(console.error);
		}
	}

	private _showPicker(accessToken: string): void {
		const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
		view.setMimeTypes('video/mp4,application/x-zip');
		view.setMode(google.picker.DocsViewMode.LIST);
		this.picker = new google.picker.PickerBuilder()
			.addView(view)
			.setAppId(GOOGLE_APP_ID)
			.setDeveloperKey(GOOGLE_API_KEY)
			.setOAuthToken(accessToken)
			.setCallback(this._pickerCallback.bind(this))
			.build();
		this.picker.setVisible(true);
	}

	private _pickerCallback(data: google.picker.ResponseObject): void {
		if (data.action === google.picker.Action.PICKED && data.docs) {
			const doc = data.docs[0];
			const fileId = doc.id;
			if (!fileId) return;
			gapi.client.drive.files
				.get({
					fileId,
					fields: 'id,name,mimeType',
				})
				.then((response) => {
					const result = response.result as { id?: string; name?: string; mimeType?: string };
					const file: DriveFile = {
						id: result.id ?? fileId,
						title: result.name ?? doc.name ?? 'Unknown',
						mimeType: result.mimeType ?? 'application/octet-stream',
					};
					this._fileGetCallback(file);
				})
				.catch(console.error);
		}
	}

	private _fileGetCallback(file: DriveFile): void {
		if (this.onSelect) {
			this.onSelect(file);
		}
	}
}

function importDrive(file: DriveFile): void {
	const token = getAccessToken();
	if (!token) return;
	switch (file.mimeType) {
		case 'application/x-zip':
		case 'video/mp4': {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, true);
			xhr.setRequestHeader('Authorization', `Bearer ${token}`);
			xhr.responseType = 'blob';
			showLoader();
			xhr.onload = function (this: XMLHttpRequest) {
				if (this.status === 200) {
					const blob = this.response as Blob;
					let type = '';
					if (file.mimeType === 'video/mp4') type = 'video/mp4';
					const tempFile = new File([blob], file.title, { type });
					handleFile(tempFile);
				}
			};
			xhr.send();
			break;
		}
	}
}

export function initPicker(): void {
	const pickBtn = document.getElementById('pick') as HTMLButtonElement | null;
	const logoutBtn = document.getElementById('logout-button');
	if (pickBtn && logoutBtn) {
		new FilePicker({
			buttonEl: pickBtn,
			logoutEl: logoutBtn,
			onSelect: importDrive,
		});
	}
}
