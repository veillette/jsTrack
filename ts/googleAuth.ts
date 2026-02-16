/**
 * Shared Google API initialization and GIS (Google Identity Services) OAuth.
 * Replaces deprecated gapi.auth with google.accounts.oauth2.
 */

import { GAPI_POLL_INTERVAL_MS, GAPI_TIMEOUT_MS } from './constants';
import { GOOGLE_API_KEY, GOOGLE_APP_ID, GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './globals';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let initPromise: Promise<void> | null = null;

function waitForGapi(): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => {
			if (typeof gapi !== 'undefined') {
				resolve();
				return;
			}
			if (Date.now() - start > GAPI_TIMEOUT_MS) {
				reject(new Error('Google API failed to load within timeout'));
				return;
			}
			setTimeout(check, GAPI_POLL_INTERVAL_MS);
		};
		check();
	});
}

function waitForGis(): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => {
			if (typeof google !== 'undefined' && google.accounts?.oauth2?.initTokenClient !== undefined) {
				resolve();
				return;
			}
			if (Date.now() - start > GAPI_TIMEOUT_MS) {
				reject(new Error('Google Identity Services failed to load within timeout'));
				return;
			}
			setTimeout(check, GAPI_POLL_INTERVAL_MS);
		};
		check();
	});
}

/**
 * Initialize Google APIs: gapi (client + picker), Drive API, and GIS TokenClient.
 * Safe to call multiple times; returns the same promise.
 */
export function initGoogleApis(): Promise<void> {
	if (initPromise) return initPromise;
	initPromise = (async () => {
		await Promise.all([waitForGapi(), waitForGis()]);
		await new Promise<void>((resolve, reject) => {
			gapi.load('client:picker', {
				callback: resolve,
				onerror: reject,
			});
		});
		gapi.client.setApiKey(GOOGLE_API_KEY);
		await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
		tokenClient = google.accounts.oauth2.initTokenClient({
			client_id: GOOGLE_CLIENT_ID,
			scope: GOOGLE_SCOPES,
			callback: (response) => {
				if (response.access_token) {
					accessToken = response.access_token;
				}
			},
		});
	})();
	return initPromise;
}

/**
 * Request an OAuth access token. Resolves when user grants consent.
 * @param prompt 'consent' to always show consent UI, '' to use cached session
 */
export function requestAccessToken(prompt: 'consent' | '' = ''): Promise<string> {
	return new Promise((resolve, reject) => {
		if (!tokenClient) {
			reject(new Error('Google APIs not initialized'));
			return;
		}
		tokenClient.callback = (response) => {
			if (response.error) {
				reject(new Error(response.error));
				return;
			}
			if (response.access_token) {
				accessToken = response.access_token;
				resolve(response.access_token);
			} else {
				reject(new Error('No access token in response'));
			}
		};
		tokenClient.requestAccessToken({ prompt });
	});
}

/** Get the current access token if one was previously obtained. */
export function getAccessToken(): string | null {
	return accessToken;
}

/** Revoke the current token and clear stored state. */
export function revokeAccessToken(): void {
	if (accessToken) {
		google.accounts.oauth2.revoke(accessToken);
		accessToken = null;
	}
}

/** Whether gapi and GIS are ready (for modalevents polling). */
export function isGoogleApisReady(): boolean {
	return tokenClient !== null;
}

export { GOOGLE_APP_ID, GOOGLE_API_KEY };
