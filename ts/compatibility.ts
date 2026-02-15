/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { master } from './globals';

export function setStorage(key: string, value: string): void {
	localStorage.setItem(key, value);
}

export function getStorage(key: string): string | null {
	return localStorage.getItem(key);
}

export function deleteStorage(key: string): void {
	localStorage.removeItem(key);
}

window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
	if (master.saved) return null;
	else {
		const confirmationMessage =
			'You have made unsaved changes. If you leave without saving these changes will be lost.';
		e.returnValue = confirmationMessage;
		return confirmationMessage;
	}
});
