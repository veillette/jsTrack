/**
 * Based on Google Drive File Picker Example
 * By Daniel Lo Nigro (http://dan.cx/)
 */

import { showLoader } from './functions';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from './globals';
import { handleFile } from './handlefiles';

interface FilePickerOptions {
	apiKey: string;
	clientId: string;
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	onSelect: (file: DriveFile) => void;
}

class FilePicker {
	apiKey: string;
	clientId: string;
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	onSelect: (file: DriveFile) => void;
	picker: unknown;

	constructor(options: FilePickerOptions) {
		this.apiKey = options.apiKey;
		this.clientId = options.clientId;
		this.buttonEl = options.buttonEl;
		this.logoutEl = options.logoutEl;
		this.onSelect = options.onSelect;
		this.buttonEl.addEventListener('click', this.open.bind(this));
		this.logoutEl.addEventListener(
			'click',
			function (this: HTMLElement) {
				if (!this.classList.contains('disabled')) {
					gapi.auth.signOut();
					this.classList.add('disabled');
				}
			}.bind(this.logoutEl),
		);

		this.buttonEl.disabled = true;

		gapi.client.setApiKey(this.apiKey);
		gapi.client.load('drive', 'v2', this._driveApiLoaded.bind(this));
		google.load('picker', '1', { callback: this._pickerApiLoaded.bind(this) });
	}

	open(): void {
		const token = gapi.auth.getToken();
		if (token) {
			this._showPicker();
			this.logoutEl.classList.remove('disabled');
		} else {
			this._doAuth(false, () => {
				this._showPicker();
				this.logoutEl.classList.remove('disabled');
			});
		}
	}

	private _showPicker(): void {
		const token = gapi.auth.getToken();
		if (!token) return;
		const accessToken = token.access_token;
		const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
		view.setMimeTypes('video/mp4,application/x-zip');
		view.setMode(google.picker.DocsViewMode.LIST);
		this.picker = new google.picker.PickerBuilder()
			.addView(view)
			.setAppId(this.clientId)
			.setOAuthToken(accessToken)
			.setCallback(this._pickerCallback.bind(this))
			.build()
			.setVisible(true);
	}

	private _pickerCallback(data: Record<string, unknown>): void {
		const actionKey = String(google.picker.Response.ACTION);
		const documentsKey = String(google.picker.Response.DOCUMENTS);
		const idKey = String(google.picker.Document.ID);
		if (data[actionKey] === google.picker.Action.PICKED) {
			const docs = data[documentsKey] as Array<Record<string, string>>;
			const file = docs[0];
			const id = file[idKey];
			const request = gapi.client.drive.files.get({ fileId: id });
			request.execute(this._fileGetCallback.bind(this));
		}
	}

	private _fileGetCallback(file: DriveFile): void {
		if (this.onSelect) {
			this.onSelect(file);
		}
	}

	private _pickerApiLoaded(): void {
		this.buttonEl.disabled = false;
	}

	private _driveApiLoaded(): void {
		this._doAuth(true);
	}

	private _doAuth(immediate: boolean, callback?: () => void): void {
		gapi.auth.authorize(
			{
				client_id: `${this.clientId}.apps.googleusercontent.com`,
				scope: 'https://www.googleapis.com/auth/drive',
				authuser: -1,
				immediate: immediate,
			},
			callback,
		);
	}
}

function importDrive(file: DriveFile): void {
	const token = gapi.auth.getToken();
	if (!token) return;
	const accessToken = token.access_token;
	switch (file.mimeType) {
		case 'application/x-zip':
		case 'video/mp4': {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, true);
			xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
			xhr.responseType = 'blob';
			showLoader();
			xhr.onload = function (this: XMLHttpRequest) {
				if (this.status === 200) {
					const blob = this.response as Blob;
					let type = '';
					if (file.mimeType === 'video/mp4') type = 'video/mp4';
					const tempFile = new File([blob], file.title, { type: type });
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
			apiKey: GOOGLE_API_KEY,
			clientId: GOOGLE_CLIENT_ID,
			buttonEl: pickBtn,
			logoutEl: logoutBtn,
			onSelect: importDrive,
		});
	}
}
