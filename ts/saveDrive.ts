/**
 * Based on Google Drive File Picker Example
 * By Daniel Lo Nigro (http://dan.cx/)
 */

import { utf8Length } from './functions';
import { getAccessToken, initGoogleApis, requestAccessToken, revokeAccessToken } from './googleAuth';

interface DriveUploadOptions {
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	getFile: (callback: (file: ArrayBuffer, name: string, done: (success: boolean) => void) => void) => void;
}

export class DriveUpload {
	buttonEl: HTMLButtonElement;
	logoutEl: HTMLElement;
	private _getFile: DriveUploadOptions['getFile'];

	constructor(options: DriveUploadOptions) {
		this.buttonEl = options.buttonEl;
		this.logoutEl = options.logoutEl;
		this._getFile = options.getFile;
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
		if (token && !this.logoutEl.classList.contains('disabled')) {
			this._upload();
			this.logoutEl.classList.remove('disabled');
		} else {
			requestAccessToken('consent')
				.then(() => {
					this._upload();
					this.logoutEl.classList.remove('disabled');
				})
				.catch(console.error);
		}
	}

	private _upload(): void {
		this._getFile((file: ArrayBuffer, name: string, callback: (success: boolean) => void) => {
			const metadata = { name };
			const token = getAccessToken();
			if (!token) {
				callback(false);
				return;
			}
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
				.then((response: { headers?: { location?: string }; result?: { headers?: { location?: string } } }) => {
					const headers = response.headers ?? response.result?.headers;
					const resumableURI = headers?.location;
					if (!resumableURI) {
						callback(false);
						return;
					}
					const uploadFileRequest = new XMLHttpRequest();
					uploadFileRequest.open('PUT', resumableURI, true);
					uploadFileRequest.setRequestHeader('Authorization', `Bearer ${token}`);
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
}
