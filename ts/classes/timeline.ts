/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import { FRAMERATE_DETECTION_STEP } from '../constants';
import { roundTo } from '../functions';
import { EventEmitter } from './event-emitter';
import { Frame } from './frame';
import type { Project } from './project';

export class Timeline extends EventEmitter {
	duration: number;
	video: HTMLVideoElement;
	width: number;
	height: number;
	fps: number;
	frameSkip: number;
	frameTime: number;
	frameCount: number;
	currentTime: number;
	currentFrame: number;
	lastFrame: number;
	direction: 'forward' | 'backward';
	savedTime: number;
	savedFrame!: number;
	seekSaved: boolean;
	startFrame: number;
	endFrame: number;
	frames: Frame[];
	activeFrames: Frame[];
	playInterval: ReturnType<typeof setInterval> | undefined;
	project!: Project;

	constructor(width: number, height: number, video: HTMLVideoElement, fps: number) {
		super();
		this.duration = roundTo(video.duration, 3);
		this.video = video;
		this.width = width;
		this.height = height;
		this.fps = fps;
		this.frameSkip = 1;
		this.frameTime = roundTo(1 / this.fps, 3);
		this.frameCount = Math.floor(this.duration / this.frameTime);
		this.currentTime = 0;
		this.currentFrame = 0;
		this.lastFrame = -1;
		this.direction = 'forward';
		this.savedTime = 0;
		this.seekSaved = false;
		this.startFrame = 0;
		this.endFrame = 1;
		this.frames = [new Frame(this, 0, 0)];
		this.activeFrames = [];
	}

	createFrames(): void {
		let counter = 1;
		for (let time = this.frameTime; time <= this.video.duration; time = roundTo(time + this.frameTime, 3)) {
			this.frames[counter] = new Frame(this, time, counter);
			counter++;
		}
	}

	detectFrameRate(callback: ((fps: number) => void) | null = null): void {
		const frameTime = FRAMERATE_DETECTION_STEP;
		let frame: string | null = null;
		const tempVideo = document.createElement('video');
		let firstLoad = true;
		tempVideo.onloadeddata = () => {
			if (firstLoad) {
				firstLoad = false;
				tempVideo.currentTime = tempVideo.duration;
				const newCanv = document.createElement('canvas');
				newCanv.height = tempVideo.videoHeight;
				newCanv.width = tempVideo.videoWidth;
				const newCtx = newCanv.getContext('2d');
				if (!newCtx) return;
				newCtx.drawImage(tempVideo, 0, 0, newCanv.width, newCanv.height);

				let tempTime = 0;
				tempVideo.currentTime = tempTime;
				let startFrame = newCanv.toDataURL();
				let matchCount = 0;
				let startFrameTime = 0;
				const onTimeUpdate = () => {
					newCtx.drawImage(tempVideo, 0, 0, newCanv.width, newCanv.height);
					if (tempTime === 0) startFrame = newCanv.toDataURL();

					frame = newCanv.toDataURL();

					if (frame !== startFrame && matchCount === 0) {
						startFrameTime = tempTime;
						startFrame = frame;
						tempTime += frameTime;
						matchCount++;
						tempVideo.currentTime = tempTime;
					} else if (frame !== startFrame && matchCount === 1) {
						matchCount++;
						tempVideo.removeEventListener('timeupdate', onTimeUpdate);
						let framerate = roundTo(
							tempVideo.duration / (tempTime - startFrameTime) / tempVideo.duration,
							2,
						);

						if (navigator.userAgent.includes('Firefox') && framerate === 34.29) framerate = 30;
						if (callback !== null) callback(framerate);
					} else {
						tempTime += frameTime;
						tempVideo.currentTime = tempTime;
					}
				};
				tempVideo.addEventListener('timeupdate', onTimeUpdate);
			}
		};
		tempVideo.src = this.video.src;
	}

	currentImage(): HTMLImageElement {
		return this.getImage();
	}

	getImage(time: number = this.currentTime): HTMLImageElement {
		const lastTime = this.currentTime;
		this.video.currentTime = time;
		const canvas = document.createElement('canvas');
		canvas.height = this.video.videoHeight;
		canvas.width = this.video.videoWidth;
		const ctx = canvas.getContext('2d');
		if (ctx) ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
		const img = new Image();
		img.src = canvas.toDataURL();
		this.video.currentTime = lastTime;
		return img;
	}

	play(_callback: (() => void) | null = null, options: Record<string, number | boolean> = {}): void {
		if (this.playInterval === undefined) {
			this.trigger('play');
			let _loop = true;
			let startingTime = this.currentTime;
			let startingFrame = this.startFrame;
			let endingFrame = this.endFrame;
			const speed = 1;

			for (const key in options) {
				const value = options[key];
				switch (key) {
					case 'loop':
						_loop = value as boolean;
						break;
					case 'startTime':
					case 'startingTime':
						if ((value as number) > 0 && (value as number) < this.duration) startingTime = value as number;
						break;
					case 'startFrame':
					case 'startingFrame':
						if ((value as number) >= 0 && (value as number) < this.frameCount)
							startingFrame = value as number;
						break;
					case 'endFrame':
					case 'endingFrame':
						if ((value as number) > 0 && (value as number) <= this.frameCount)
							endingFrame = value as number;
						break;
				}
			}

			this.currentTime = startingTime;
			let counter = startingFrame;

			this.playInterval = setInterval(() => {
				if (counter <= endingFrame) {
					const next = this.next();
					if (next !== false) {
						this.setFrame(next.number);
						counter = next.number;
						if (counter === endingFrame) counter = endingFrame + 100;
					}
				} else {
					this.setFrame(startingFrame);
					counter = startingFrame;
				}
				this.project.updateVisiblePoints();
				if (this.project.track != null) {
					if (this.project.track.points[this.currentFrame] !== undefined) {
						this.project.track.unemphasizeAll();
						this.project.track.points[this.currentFrame].emphasize();
					}
				}
			}, 200 / speed);
		}
	}

	pause(): void {
		clearInterval(this.playInterval);
		this.playInterval = undefined;
		this.trigger('pause');
	}

	seek(frame: number): this {
		this.savedFrame = frame;
		this.seekSaved = true;
		return this;
	}

	update(): void {
		if (this.seekSaved && this.duration > 0) {
			this.lastFrame = this.currentFrame;
			this.currentFrame = this.savedFrame;
			this.seekSaved = false;

			if (this.lastFrame < this.currentFrame) this.direction = 'forward';
			else this.direction = 'backward';

			this.currentTime = roundTo(this.currentFrame * this.frameTime, 3);

			this.trigger('seek');
		} else {
			this.currentTime = roundTo(this.currentFrame * this.frameTime, 3);
		}

		if (this.video.currentTime !== this.currentTime) {
			this.video.currentTime = this.currentTime;
		}
	}

	updateTiming(duration: number, fps: number | string): number {
		const ratios = {
			start: this.startFrame / this.frameCount || 0,
			end: this.endFrame / this.frameCount || 1,
		};
		this.duration = roundTo(duration, 3);
		this.fps = parseFloat(String(fps));
		this.frameTime = roundTo(1 / this.fps, 3);
		this.frameCount = Math.floor(this.duration / this.frameTime);
		this.duration = roundTo(this.frameCount * this.frameTime, 3);
		this.startFrame = Math.floor(ratios.start * this.frameCount);
		this.endFrame = Math.floor(ratios.end * this.frameCount);
		this.trigger('timingUpdate');
		return this.duration;
	}

	current(): Frame | false {
		if (this.frames[this.currentFrame] !== undefined) {
			return this.frames[this.currentFrame];
		} else {
			return false;
		}
	}

	setFrame(frameNum: number): undefined | false {
		const frame = this.frames[frameNum];
		if (frame !== undefined) {
			this.lastFrame = this.currentFrame;
			this.currentFrame = frame.number;
			this.currentTime = roundTo(frame.time, 3);
			this.video.currentTime = frame.time;

			if (this.lastFrame < this.currentFrame) this.direction = 'forward';
			else this.direction = 'backward';

			this.trigger('seek');
		} else {
			return false;
		}
	}

	getClosestFrame(time: number = this.currentTime): number {
		return Math.floor(roundTo(time / this.frameTime, 3));
	}

	getFrameStart(frameNum: number): number {
		return roundTo(this.frameTime * frameNum, 3);
	}

	next(): Frame | false {
		let nextFrameNum = this.currentFrame + this.frameSkip;
		if (this.currentFrame % this.frameSkip !== 0) {
			nextFrameNum -= this.currentFrame % this.frameSkip;
		}

		if (nextFrameNum > this.endFrame) {
			nextFrameNum = this.endFrame;
		}

		const pickedFrame = this.frames[nextFrameNum];
		if (pickedFrame === undefined) {
			return false;
		} else {
			return pickedFrame;
		}
	}

	prev(): Frame | false {
		let prevFrameNum = this.currentFrame - this.frameSkip;
		if (this.currentFrame % this.frameSkip !== 0) {
			prevFrameNum += this.frameSkip - (this.currentFrame % this.frameSkip);
		}

		if (prevFrameNum < this.startFrame) {
			prevFrameNum = this.currentFrame - (this.frameCount % this.frameSkip);
		}

		const pickedFrame = this.frames[prevFrameNum];
		if (pickedFrame === undefined) {
			return false;
		} else {
			return pickedFrame;
		}
	}
}
