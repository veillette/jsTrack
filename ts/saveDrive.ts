/**
 * Based on Google Drive File Picker Example
 * By Daniel Lo Nigro (http://dan.cx/)
 */

import { utf8Length } from './functions';

interface DriveUploadOptions {
	apiKey: string;
	clientId: string;
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	getFile: (callback: (file: ArrayBuffer, name: string, done: (success: boolean) => void) => void) => void;
}

export class DriveUpload {
	apiKey: string;
	clientId: string;
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	private _getFile: DriveUploadOptions['getFile'];

	constructor(options: DriveUploadOptions) {
		this.apiKey = options.apiKey;
		this.clientId = options.clientId;
		this.buttonEl = options.buttonEl;
		this.logoutEl = options.logoutEl;
		this._getFile = options.getFile;
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
	}

	open(): void {
		const token = gapi.auth.getToken();
		if (token && !this.logoutEl.classList.contains('disabled')) {
			this._upload();
			this.logoutEl.classList.remove('disabled');
		} else {
			this._doAuth(false, () => {
				this._upload();
				this.logoutEl.classList.remove('disabled');
			});
		}
	}

	private _upload(): void {
		this._getFile((file: ArrayBuffer, name: string, callback: (success: boolean) => void) => {
			const metadata = { name: name };
			gapi.client
				.request({
					path: '/upload/drive/v3/files',
					method: 'POST',
					params: { uploadType: 'resumable' },
					headers: {
						'X-Upload-Content-Type': 'application/x-zip',
						'X-Upload-Content-Length': String(file.byteLength),
						'Content-Type': 'application/json; charset=UTF-8',
						'Content-Length': String(utf8Length(JSON.stringify(metadata))),
					},
					body: metadata,
				})
				.then((response: { headers: { location: string } }) => {
					const resumableURI = response.headers.location;
					const uploadFileRequest = new XMLHttpRequest();
					uploadFileRequest.open('PUT', resumableURI, true);
					const token = gapi.auth.getToken();
					if (token) {
						uploadFileRequest.setRequestHeader('Authorization', `Bearer ${token.access_token}`);
					}
					uploadFileRequest.setRequestHeader('Content-Type', 'application/x-zip');
					uploadFileRequest.setRequestHeader('X-Upload-Content-Type', 'application/x-zip');
					uploadFileRequest.onreadystatechange = () => {
						if (uploadFileRequest.readyState === XMLHttpRequest.DONE) callback(true);
						else callback(false);
					};
					uploadFileRequest.send(file);
				});
		});
	}

	private _driveApiLoaded(): void {
		this.buttonEl.disabled = false;
		this._doAuth(true);
	}

	private _doAuth(immediate: boolean, callback?: () => void): void {
		if (this.logoutEl.classList.contains('disabled')) {
			gapi.auth.authorize(
				{
					client_id: `${this.clientId}.apps.googleusercontent.com`,
					scope: 'https://www.googleapis.com/auth/drive',
					immediate: immediate,
					authuser: -1,
				},
				callback,
			);
		} else {
			gapi.auth.authorize(
				{
					client_id: `${this.clientId}.apps.googleusercontent.com`,
					scope: 'https://www.googleapis.com/auth/drive',
					immediate: immediate,
				},
				callback,
			);
		}
	}
}
