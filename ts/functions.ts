/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Contact:
 *
 * Luca Demian
 * jstrack.luca@gmail.com
 *
 */

// ─── Prototype Extensions ───

declare global {
	interface Array<T> {
		last(): T | undefined;
	}
	interface Number {
		roundTo(x: number): number;
		roundSig(x: number): number;
		toDegrees(): number;
		toRadians(): number;
		sigFigs(): number;
	}
	interface String {
		roundTo(x: number): number;
		sigFigs(): number;
		utf8Length(): number;
	}
	interface Math {
		cot(x: number): number;
	}
}

if (!Array.prototype.last) {
	Array.prototype.last = function <T>(this: T[]): T | undefined {
		return this[this.length - 1];
	};
}

if (!Number.prototype.roundTo) {
	Number.prototype.roundTo = function (this: number, x: number): number {
		return parseFloat(parseFloat(String(this)).toFixed(x));
	};
}

if (!Number.prototype.roundSig) {
	Number.prototype.roundSig = function (this: number, x: number): number {
		return parseFloat(parseFloat(String(this)).toPrecision(x));
	};
}

if (!String.prototype.roundTo) {
	String.prototype.roundTo = function (this: string, x: number): number {
		return parseFloat(parseFloat(this).toFixed(x));
	};
}

if (!Number.prototype.toDegrees) {
	Number.prototype.toDegrees = function (this: number): number {
		return this * (180 / Math.PI);
	};
}

if (!Number.prototype.toRadians) {
	Number.prototype.toRadians = function (this: number): number {
		return this * (Math.PI / 180);
	};
}

if (!Number.prototype.sigFigs) {
	Number.prototype.sigFigs = function (this: number): number {
		const log10 = Math.log(10);
		let n = Math.abs(Number(String(this).replace('.', '')));
		if (n === 0) return 0;
		while (n !== 0 && n % 10 === 0) n /= 10;
		return Math.floor(Math.log(n) / log10) + 1;
	};
}

if (!String.prototype.sigFigs) {
	String.prototype.sigFigs = function (this: string): number {
		const log10 = Math.log(10);
		let n = Math.abs(Number(String(this).replace('.', '')));
		if (n === 0) return 0;
		while (n !== 0 && n % 10 === 0) n /= 10;
		return Math.floor(Math.log(n) / log10) + 1;
	};
}

if (!(Math as { cot?: (x: number) => number }).cot) {
	(Math as { cot: (x: number) => number }).cot = (number: number): number => 1 / Math.tan(number);
}

if (!String.prototype.utf8Length) {
	String.prototype.utf8Length = function (this: string): number {
		const m = encodeURIComponent(this).match(/%[89ABab]/g);
		return this.length + (m ? m.length : 0);
	};
}

// ─── Utility Functions ───

export function hideLoader(): void {
	const el = document.getElementById('fullscreen-loader');
	if (el) el.classList.remove('active');
}

export function showLoader(): void {
	const el = document.getElementById('fullscreen-loader');
	if (el) el.classList.add('active');
}

export function dataURLtoBlob(dataurl: string): Blob {
	const arr = dataurl.split(',');
	const mimeMatch = arr[0].match(/:(.*?);/);
	const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
	const bstr = atob(arr[1]);
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new Blob([u8arr], { type: mime });
}

export function isQuotaExceeded(e: { code?: number; name?: string; number?: number } | null): boolean {
	let quotaExceeded = false;
	if (e) {
		if (e.code) {
			switch (e.code) {
				case 22:
					quotaExceeded = true;
					break;
				case 1014:
					if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
						quotaExceeded = true;
					}
					break;
			}
		} else if (e.number === -2147024882) {
			quotaExceeded = true;
		}
	}
	return quotaExceeded;
}

export function compareImages(img1: ImageData, img2: ImageData): boolean {
	if (img1.data.length !== img2.data.length) return false;
	for (let i = 0; i < img1.data.length; ++i) {
		if (img1.data[i] !== img2.data[i]) return false;
	}
	return true;
}
