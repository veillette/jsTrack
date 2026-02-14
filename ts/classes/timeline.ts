/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import '../functions';
import { Frame } from './frame';
import type { Project } from './project';

type TimelineCallback = (this: Timeline, args: unknown[]) => void;

export class Timeline {
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
	callbacks: Record<string, TimelineCallback[]>;
	frames: Frame[];
	activeFrames: Frame[];
	playInterval: ReturnType<typeof setInterval> | undefined;
	project!: Project;

	constructor(width: number, height: number, video: HTMLVideoElement, fps: number) {
		this.duration = video.duration.roundTo(3);
		this.video = video;
		this.width = width;
		this.height = height;
		this.fps = fps;
		this.frameSkip = 1;
		this.frameTime = (1 / this.fps).roundTo(3);
		this.frameCount = Math.floor(this.duration / this.frameTime);
		this.currentTime = 0;
		this.currentFrame = 0;
		this.lastFrame = -1;
		this.direction = 'forward';
		this.savedTime = 0;
		this.seekSaved = false;
		this.startFrame = 0;
		this.endFrame = 1;
		this.callbacks = {};
		this.frames = [new Frame(this, 0, 0)];
		this.activeFrames = [];
	}

	createFrames(): void {
		let counter = 1;
		for (let time = this.frameTime; time <= this.video.duration; time = (time + this.frameTime).roundTo(3)) {
			this.frames[counter] = new Frame(this, time, counter);
			counter++;
		}
	}

	trigger(events: string, argArray: unknown[] = []): void {
		const eventList = events.split(',');
		for (let i = 0; i < eventList.length; i++) {
			const event = eventList[i].trim();
			if (this.callbacks[event] !== undefined) {
				for (let j = 0; j < this.callbacks[event].length; j++) {
					this.callbacks[event][j].call(this, argArray);
				}
			}
		}
	}

	on(events: string, callback: TimelineCallback): void {
		const eventList = events.split(',');
		for (let i = 0; i < eventList.length; i++) {
			const event = eventList[i].trim();
			if (this.callbacks[event] === undefined) {
				this.callbacks[event] = [];
			}
			this.callbacks[event].push(callback);
		}
	}

	detectFrameRate(callback: ((fps: number) => void) | null = null): void {
		const frameTime = 1 / 240;
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
				console.log('Detecting Framerate...');
				let matchCount = 0;
				let startFrameTime = 0;
				tempVideo.addEventListener('timeupdate', () => {
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
						let framerate = (tempVideo.duration / (tempTime - startFrameTime) / tempVideo.duration).roundTo(
							2,
						);

						if (platform.name === 'Firefox' && framerate === 34.29) framerate = 30;
						console.log(`${framerate} FPS`);
						if (callback !== null) callback(framerate);
					} else {
						tempTime += frameTime;
						tempVideo.currentTime = tempTime;
					}
				});
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
				if (this.project.track !== undefined && this.project.track !== null) {
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

			this.currentTime = (this.currentFrame * this.frameTime).roundTo(3);

			this.trigger('seek');
		} else {
			this.currentTime = (this.currentFrame * this.frameTime).roundTo(3);
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
		this.duration = duration.roundTo(3);
		this.fps = parseFloat(String(fps));
		this.frameTime = (1 / this.fps).roundTo(3);
		this.frameCount = Math.floor(this.duration / this.frameTime);
		this.duration = (this.frameCount * this.frameTime).roundTo(3);
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
			this.currentTime = frame.time.roundTo(3);
			this.video.currentTime = frame.time;

			if (this.lastFrame < this.currentFrame) this.direction = 'forward';
			else this.direction = 'backward';

			this.trigger('seek');
		} else {
			return false;
		}
	}

	getClosestFrame(time: number = this.currentTime): number {
		return Math.floor((time / this.frameTime).roundTo(3));
	}

	getFrameStart(frameNum: number): number {
		return (this.frameTime * frameNum).roundTo(3);
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
