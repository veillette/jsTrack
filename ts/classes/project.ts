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
import { Axes, type Coordinate } from './axes';
import { Scale } from './scale';
import type { TableRowData } from './table';
import type { Timeline } from './timeline';
import { Track } from './track';

type ProjectCallback = (this: Project, args: unknown[]) => void;
type ProjectModeCallback = (this: Project, mode: string, lastMode: string) => void;
type PositioningCallback = (this: Project, args: { event: string; delta?: number }) => void;

interface ProjectPositioning {
	_zoom: number;
	_x: number;
	_y: number;
	stuck: boolean;
	autoZoom: boolean;
	_callbacks: Record<string, PositioningCallback[]>;
	zoom: number;
	x: number;
	y: number;
	trigger(event: string, argArray?: { event?: string; delta?: number }): void;
	on(event: string, callback: PositioningCallback): ProjectPositioning;
}

interface ProjectState {
	_mode: string;
	_lastMode: string;
	modeCallbacks: ProjectModeCallback[];
	selectionCallbacks: Array<(selected: boolean) => void>;
	mode: string;
	triggerChange(): void;
	reset(): void;
	modeChange(val: ProjectModeCallback): void;
	default(): void;
}

interface SaveScaleData {
	size: string;
	color: string;
	nodes: [Coordinate, Coordinate];
}

interface SaveAxesData {
	position: { x: number; y: number; rotation: number };
	color: string;
}

interface SaveTrackInfo {
	name: string;
	color: string;
	points: Record<string, Coordinate>;
	hidden: boolean;
}

interface SaveData {
	name: string;
	duration: number;
	video: HTMLVideoElement;
	fps: number;
	currentFrame: number;
	uid: number;
	startFrame: number;
	endFrame: number;
	videoName: string;
	videoSpeed: number;
	scale?: SaveScaleData;
	axes?: SaveAxesData;
	activeTrack?: string;
	tracks?: Record<string, SaveTrackInfo>;
}

interface MetaInfo {
	date: string;
	createdWith: string;
	appVersion: number;
	fileVersion: number;
}

export interface ProjectSaveFile {
	meta: MetaInfo;
	project: SaveData;
}

interface LoadFileData {
	meta?: { fileVersion: number };
	project?: Record<string, unknown>;
	[key: string]: unknown;
}

export class Project {
	name: string;
	created: boolean;
	uid: number;
	timeline: Timeline;
	stage: createjs.Stage;
	videoName: string;
	addBackground: createjs.Shape;
	background: createjs.Bitmap;
	backgroundScale: number;
	saved: boolean;
	backedUp: boolean;
	backUpDate: Date | null;
	videoFile: File | Blob | null;
	track: Track | null;
	scale: Scale | null;
	axes: Axes | null;
	trackList: Record<string, Track>;
	deletedTracks: Record<string, Track>;
	axesList: Axes[];
	callbacks: Record<string, ProjectCallback[]>;
	undoManager: UndoManager;
	saveIndex: number;
	backUpIndex: number;
	viewPoints: { forward: number; backward: number };
	videoSpeed: number;
	handsOnTable: Handsontable;
	positioning: ProjectPositioning;
	state: ProjectState;

	constructor(
		name: string,
		timeline: Timeline,
		handsOnTable: Handsontable,
		stage: createjs.Stage,
		background: createjs.Bitmap,
	) {
		this.name = name;
		this.created = false;
		this.uid = Math.random() * 100000000000000;
		this.timeline = timeline;
		this.stage = stage;
		this.videoName = '';
		this.addBackground = new createjs.Shape();
		const hitArea = new createjs.Shape();
		hitArea.graphics.beginFill('#000000');
		hitArea.graphics.drawRect(-10000, -10000, 30000, 30000);
		this.addBackground.hitArea = hitArea;
		this.background = background;
		this.backgroundScale = 0;
		this.saved = true;
		this.backedUp = true;
		this.backUpDate = null;
		this.videoFile = null;
		this.track = null;
		this.scale = null;
		this.axes = null;
		this.trackList = {};
		this.deletedTracks = {};
		this.axesList = [];
		this.callbacks = {};
		this.undoManager = new UndoManager();
		this.saveIndex = this.backUpIndex = this.undoManager.getIndex();
		this.viewPoints = {
			forward: 0,
			backward: 7,
		};
		this.videoSpeed = 1;
		this.handsOnTable = handsOnTable;
		this.handsOnTable.updateSettings({
			readOnly: true,
			autoColumnSize: true,
			manualColumnResize: true,
			manualColumnMove: true,
			tableClassName: 'data-table-master',
			rowHeaders: false,
			colHeaders: true,
			startRows: 3,
			fixedColsLeft: 1,
			preventOverflow: 'horizontal',
			type: 'numeric',
			stretchH: 'last',
		});

		const project = this;

		this.positioning = {
			_zoom: 1,
			_x: 0,
			_y: 0,
			stuck: true,
			autoZoom: true,
			_callbacks: {},
			get zoom(): number {
				return this._zoom;
			},
			set zoom(value: number) {
				const oldZoom = this._zoom;
				this._zoom = value.roundTo(5);
				this.autoZoom = false;
				const zoomChange = this._zoom - oldZoom;

				project.background.scale = project.backgroundScale * this._zoom;
				(project.background as createjs.Bitmap & { w: number }).w =
					project.background.scale * project.timeline.video.videoWidth;
				(project.background as createjs.Bitmap & { h: number }).h =
					project.background.scale * project.timeline.video.videoHeight;
				project.updateScale();

				if (oldZoom > this._zoom) this.trigger('zoomout', { delta: zoomChange });
				else this.trigger('zoomin', { delta: zoomChange });

				this.trigger('zoom', { delta: zoomChange });
			},
			get x(): number {
				return this._x;
			},
			set x(value: number) {
				this._x = value.roundTo(5);

				project.background.x = this._x;
				project.updateScale();

				this.trigger('translation');
			},
			get y(): number {
				return this._y;
			},
			set y(value: number) {
				this._y = value.roundTo(5);

				project.background.y = this._y;
				project.updateScale();

				this.trigger('translation');
			},
			trigger(event: string, argArray: { event?: string; delta?: number } = {}) {
				argArray.event = event;
				if (this._callbacks[event] !== undefined) {
					const callbacks = this._callbacks[event];
					for (let i = 0; i < callbacks.length; i++) {
						callbacks[i].call(project, argArray as { event: string; delta?: number });
					}
				}
			},
			on(event: string, callback: PositioningCallback) {
				const events = event.split(',');
				for (let i = 0; i < events.length; i++) {
					const tempEvent = events[i].trim();

					if (this._callbacks[tempEvent] === undefined) {
						this._callbacks[tempEvent] = [];
					}

					this._callbacks[tempEvent].push(callback);
				}
				return this;
			},
		};

		this.state = {
			_mode: 'default',
			_lastMode: '',
			modeCallbacks: [],
			selectionCallbacks: [],
			set mode(val: string) {
				if (this._mode !== val) {
					this._lastMode = this._mode;
					this._mode = val;
				}
				this.triggerChange();
			},
			get mode(): string {
				return this._mode;
			},
			triggerChange() {
				for (let i = 0; i < this.modeCallbacks.length; i++) {
					this.modeCallbacks[i].call(project, this._mode, this._lastMode);
				}
			},
			reset() {
				const tempLastMode = this._lastMode;
				this._lastMode = this._mode;
				this._mode = tempLastMode;
				this.triggerChange();
			},
			modeChange(val: ProjectModeCallback) {
				this.modeCallbacks.push(val);
			},
			default() {
				this._mode = 'default';
				this.triggerChange();
			},
		};

		this.state.modeChange(function (this: Project, mode: string) {
			if (mode === 'add') {
				if (this.axes !== null && this.axes !== undefined) {
					this.axes.hide();
				}
				if (this.scale !== null && this.scale !== undefined) {
					this.scale.hide();
				}
			} else {
				if (this.axes !== null && this.axes !== undefined) {
					this.axes.show();
				}
				if (this.scale !== null && this.scale !== undefined) {
					this.scale.show();
				}
			}

			switch (mode) {
				case 'seek':
					this.stage.removeChild(this.addBackground);
					this.stage.cursor = 'crosshair';
					break;
				case 'add':
				case 'newScale':
					this.stage.addChild(this.addBackground);
					switch (platform.name) {
						case 'Firefox':
							this.stage.cursor = "url('icons/add_point.png') 16 16, copy";
							break;
						case 'Chrome':
							this.stage.cursor = "url('icons/add_point.png') 8 8, copy";
							break;
						default:
							this.stage.cursor = 'copy';
							break;
					}
					break;
				case 'positioning':
					this.stage.addChild(this.addBackground);
					this.stage.cursor = 'move';
					break;
				default:
					this.stage.removeChild(this.addBackground);
					this.stage.cursor = 'default';
					this.updateVisiblePoints();
					break;
			}
			this.stage._testMouseOver(true);
		});

		this.timeline.project = this;
	}

	toUnscaled(x: number | Coordinate, y: number | null = null): Coordinate {
		let xNum: number;
		let yNum: number;
		if (typeof x === 'object') {
			xNum = x.x;
			yNum = y !== null ? y : x.y;
		} else {
			xNum = x;
			yNum = y !== null ? y : 0;
		}

		const changing = {
			width: this.timeline.video.videoWidth * (this.backgroundScale * this.positioning.zoom),
			height: this.timeline.video.videoHeight * (this.backgroundScale * this.positioning.zoom),
		};
		const unchanging = {
			width: this.timeline.video.videoWidth,
			height: this.timeline.video.videoHeight,
		};
		const translation = {
			x: this.positioning.x,
			y: this.positioning.y,
		};

		return {
			x: (xNum / unchanging.width) * changing.width + translation.x,
			y: (yNum / unchanging.height) * changing.height + translation.y,
		};
	}

	toScaled(x: number | Coordinate, y: number | null = null): Coordinate {
		let xNum: number;
		let yNum: number;
		if (typeof x === 'object') {
			xNum = x.x;
			yNum = y !== null ? y : x.y;
		} else {
			xNum = x;
			yNum = y !== null ? y : 0;
		}

		const changing = {
			width: this.timeline.video.videoWidth * (this.backgroundScale * this.positioning.zoom),
			height: this.timeline.video.videoHeight * (this.backgroundScale * this.positioning.zoom),
		};
		const unchanging = {
			width: this.timeline.video.videoWidth,
			height: this.timeline.video.videoHeight,
		};
		const translation = {
			x: this.positioning.x,
			y: this.positioning.y,
		};

		return {
			x: ((xNum - translation.x) / changing.width) * unchanging.width,
			y: ((yNum - translation.y) / changing.height) * unchanging.height,
		};
	}

	updateScale(): void {
		if (this.axes !== undefined && this.axes !== null) {
			const moveTo = this.toUnscaled(this.axes.x, this.axes.y);
			this.axes.shape.x = moveTo.x;
			this.axes.shape.y = moveTo.y;
		}
		for (let i = 0; i < this.timeline.frames.length; i++) {
			const frame = this.timeline.frames[i];
			for (let j = 0; j < frame.points.length; j++) {
				const point = frame.points[j];
				const scaled = this.toUnscaled(point.x, point.y);
				point.shape.x = point.circle.x = scaled.x;
				point.shape.y = point.circle.y = scaled.y;
			}
		}
		if (this.scale !== undefined && this.scale !== null) {
			const moveTo = [this.toUnscaled(this.scale.positions[0]), this.toUnscaled(this.scale.positions[1])];
			this.scale.nodes[0].x = moveTo[0].x;
			this.scale.nodes[0].y = moveTo[0].y;
			this.scale.nodes[1].x = moveTo[1].x;
			this.scale.nodes[1].y = moveTo[1].y;
			this.scale.update();
		}
	}

	undo(): void {
		this.undoManager.undo();
		if (this.saveIndex !== this.undoManager.getIndex()) {
			this.saved = false;
			this.trigger('change');
		}
		if (this.backUpIndex !== this.undoManager.getIndex()) {
			this.backedUp = false;
			this.trigger('change');
		}
		this.trigger('undo');
	}

	redo(): void {
		this.undoManager.redo();
		if (this.saveIndex !== this.undoManager.getIndex()) {
			this.saved = false;
			this.trigger('change');
		}
		if (this.backUpIndex !== this.undoManager.getIndex()) {
			this.backedUp = false;
			this.trigger('change');
		}
		this.trigger('redo');
	}

	backup(): void {
		this.backedUp = true;
		this.backUpDate = new Date();
		this.backUpIndex = this.undoManager.getIndex();
	}

	on(events: string, callback: ProjectCallback): this {
		const eventList = events.split(',');
		for (let i = 0; i < eventList.length; i++) {
			const event = eventList[i].trim();
			if (this.callbacks[event] === undefined) {
				this.callbacks[event] = [];
			}
			this.callbacks[event].push(callback);
		}
		return this;
	}

	trigger(events: string, argArray: unknown[] = []): this {
		const eventList = events.split(',');
		for (let i = 0; i < eventList.length; i++) {
			const event = eventList[i].trim();
			if (this.callbacks[event] !== undefined) {
				for (let j = 0; j < this.callbacks[event].length; j++) {
					this.callbacks[event][j].call(this, argArray);
				}
			}
		}
		return this;
	}

	changed(): this {
		this.saved = false;
		this.backedUp = false;
		this.trigger('change');
		return this;
	}

	change(actions: { undo: () => void; redo: () => void }): this {
		this.saved = false;
		this.backedUp = false;

		this.undoManager.add({
			undo: actions.undo,
			redo: actions.redo,
		});

		this.trigger('change');

		return this;
	}

	updateVisiblePoints(): this {
		if (this.state.mode !== 'add') {
			for (let i = 0; i < this.timeline.activeFrames.length; i++) {
				const frame = this.timeline.activeFrames[i];
				if (
					frame.number < this.timeline.currentFrame - this.viewPoints.backward * this.timeline.frameSkip ||
					frame.number > this.timeline.currentFrame + this.viewPoints.forward * this.timeline.frameSkip ||
					frame.number < this.timeline.startFrame ||
					frame.number > this.timeline.endFrame
				) {
					for (let j = 0; j < frame.points.length; j++) {
						if (!frame.points[j].hidden) {
							frame.points[j].hide();
						}
					}
				} else {
					for (let j = 0; j < frame.points.length; j++) {
						if (frame.points[j].hidden) {
							frame.points[j].show();
						}
					}
				}
			}
			if (this.track !== undefined && this.track !== null) {
				if (this.track.emphasizedPoint !== null && this.track.emphasizedPoint !== undefined) {
					this.track.emphasizedPoint.emphasize();
				}
			}
		}
		return this;
	}

	destroy(): this {
		for (const uid in this.trackList) {
			const track = this.trackList[uid];
			track.listElement.container.remove();
		}
		if (this.scale !== null && this.scale !== undefined) this.scale.textElement.remove();

		this.handsOnTable.destroy();
		return this;
	}

	save(): ProjectSaveFile {
		const metaInfo: MetaInfo = {
			date: new Date().toString(),
			createdWith: 'Created with JSTrack by Luca Demian',
			appVersion: 0.1,
			fileVersion: 0.3,
		};

		const saveData: SaveData = {
			name: this.name,
			duration: this.timeline.duration,
			video: this.timeline.video,
			fps: this.timeline.fps,
			currentFrame: this.timeline.currentFrame,
			uid: this.uid,
			startFrame: this.timeline.startFrame,
			endFrame: this.timeline.endFrame,
			videoName: this.videoName,
			videoSpeed: this.videoSpeed,
		};

		if (this.scale !== null && this.scale !== undefined) {
			saveData.scale = {
				size: this.scale.size.toString(),
				color: this.scale.color,
				nodes: [
					{ x: this.scale.positions[0].x, y: this.scale.positions[0].y },
					{ x: this.scale.positions[1].x, y: this.scale.positions[1].y },
				],
			};
		}

		if (this.axes !== null && this.axes !== undefined) {
			saveData.axes = {
				position: { x: this.axes.x, y: this.axes.y, rotation: this.axes.theta },
				color: this.axes.color,
			};
		}

		if (this.track !== null && this.track !== undefined) saveData.activeTrack = this.track.uid;

		saveData.tracks = {};
		for (const uid in this.trackList) {
			const track = this.trackList[uid];
			const trackInfo: SaveTrackInfo = {
				name: track.name,
				color: track.color,
				points: {},
				hidden: track.hidden,
			};

			for (const number in track.points) {
				trackInfo.points[number] = {
					x: track.points[number].x,
					y: track.points[number].y,
				};
			}

			saveData.tracks[uid] = trackInfo;
		}

		return { meta: metaInfo, project: saveData };
	}

	load(fileData: LoadFileData): this {
		let version = 0;
		const fileInfo = fileData.meta;

		let data: Record<string, unknown>;
		if (fileInfo !== undefined) {
			version = fileInfo.fileVersion;
			if (version > 0) {
				data = (fileData.project as Record<string, unknown>) || fileData;
			} else {
				data = fileData as Record<string, unknown>;
			}
		} else {
			data = fileData as Record<string, unknown>;
		}

		if (data.fps !== undefined) {
			this.timeline.updateTiming(this.timeline.video.duration, data.fps as number);
			if (this.timeline.frames.length === 1) {
				this.timeline.createFrames();
			}
			this._load(data, version);
		} else {
			this.timeline.detectFrameRate((fps: number) => {
				this.timeline.updateTiming(this.timeline.video.duration, fps);
				if (this.timeline.frames.length === 1) {
					this.timeline.createFrames();
				}

				this._load(data, version);
			});
		}

		return this;
	}

	_load(data: Record<string, unknown>, version: number): void {
		for (const key in data) {
			const value = data[key];
			switch (key) {
				case 'name':
					this.name = value as string;
					break;
				case 'uid':
					this.uid = value as number;
					break;
				case 'videoName':
					this.videoName = value as string;
					break;
				case 'videoSpeed':
					this.videoSpeed = value as number;
					break;
				case 'currentFrame':
					this.timeline.seek(value as number);
					break;
				case 'startFrame':
					this.timeline.startFrame = value as number;
					break;
				case 'endFrame':
					this.timeline.endFrame = value as number;
					break;
				case 'scale': {
					const scaleData = value as SaveScaleData;
					this.newScale(
						scaleData.size,
						scaleData.nodes[0].x,
						scaleData.nodes[0].y,
						scaleData.nodes[1].x,
						scaleData.nodes[1].y,
						scaleData.color,
						true,
					);
					break;
				}
				case 'axes': {
					const axesData = value as SaveAxesData;
					const axes = this.newAxes(axesData.position.x, axesData.position.y, axesData.color, true);
					if (version > 0) {
						axes.rotate(axesData.position.rotation);
					}
					break;
				}
				case 'tracks': {
					const tracksData = value as Record<string, SaveTrackInfo>;
					for (const uid in tracksData) {
						const trackInfo = tracksData[uid];
						const track = this.newTrack(trackInfo.name, trackInfo.color, false, uid);
						for (const number in trackInfo.points) {
							const frame = this.timeline.frames[Number(number)];
							if (frame !== undefined)
								track.addPoint(frame, trackInfo.points[number].x, trackInfo.points[number].y);
						}
						track.unselectAll();
						if (version > 0.2) {
							if (trackInfo.hidden) track.hide();
						}
					}
					break;
				}
			}
			if (data.activeTrack !== undefined && data.activeTrack !== null) {
				this.switchTrack(data.activeTrack as string);
			}
		}

		this.updateVisiblePoints();
		this.created = true;
		this.trigger('created');
		this.undoManager.clear();
	}

	deleteTrack(uid: string): void {
		if (this.trackList[uid] !== undefined) {
			const track = this.trackList[uid];
			this.deletedTracks[uid] = track;
			for (const number in track.points) {
				const point = track.points[number];
				point.unemphasize();
				point.unselect();
				track.stage.removeChild(point.shape);
				for (let i = 0; i < point.frame.points.length; i++) {
					if (point.frame.points[i] === point) {
						point.frame.points.splice(i, 1);
						i--;
					}
				}
			}
			if (this.track === track) {
				this.track = null;
			}
			track.listElement.container.remove();

			delete this.trackList[uid];

			this.trigger('deleteTrack', [track]);
		}
	}

	undeleteTrack(uid: string): void {
		if (this.deletedTracks[uid] !== undefined) {
			const track = this.deletedTracks[uid];
			this.trackList[uid] = track;
			const trackListUl = document.getElementById('track-list')?.querySelector('ul');
			if (trackListUl) trackListUl.appendChild(track.listElement.container);
			for (const number in track.points) {
				const point = track.points[number];
				point.unemphasize();
				point.unselect();
				point.show();

				point.frame.points.push(point);
			}
			this.updateVisiblePoints();
			this.switchTrack(uid);
			delete this.deletedTracks[uid];

			this.trigger('undeleteTrack', [track]);
		}
	}

	newTrack(name: string, color: string, makeDefault = true, uid: string | false = false): Track {
		const track = new Track(this, this.timeline, name, color, this.stage, uid);

		this.change({
			undo: () => {
				this.deleteTrack(track.uid);
			},
			redo: () => {
				this.undeleteTrack(track.uid);
			},
		});

		this.trackList[track.uid] = track;
		if (makeDefault) {
			this.track = track;
			this.track.select();
		}
		track.table.makeActive();

		this.trigger('newTrack', [track]);

		return track;
	}

	newAxes(x: number, y: number, color: string, makeDefault = true): Axes {
		const axes = new Axes(this.stage, x, y, color, this);
		this.axesList.push(axes);
		if (makeDefault) this.axes = axes;

		return axes;
	}

	newScale(
		size: string | null,
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color = '#39ff14',
		makeDefault = true,
	): Scale {
		const scale = new Scale(this.stage, size, x1, y1, x2, y2, color, this);

		this.change({
			undo: () => {
				this.deleteScale(scale.uid);
			},
			redo: () => {
				this.newScale(size, x1, y1, x2, y2, color, makeDefault);
			},
		});

		if (makeDefault) this.scale = scale;

		this.trigger('newScale', [scale]);

		return scale;
	}

	deleteScale(uid: string): void {
		if (this.scale && this.scale.uid === uid) {
			this.scale.hide();
			this.scale = null;
		}
	}

	switchTrack(uid: string): this {
		if (this.trackList[uid] !== undefined) {
			if (this.track !== null && this.track !== undefined) {
				this.track.unselectAll();
				this.track.unemphasizeAll();
			}

			this.track = this.trackList[uid];
			this.track.select();
			this.track.table.makeActive();

			let tableData: TableRowData[] = this.track.export().points.scaled;
			if (tableData.length === 0) tableData = [{ '': '' }];
			this.track.table.newData(tableData, true, true);

			if (this.track.points[this.timeline.currentFrame] !== undefined) {
				this.track.points[this.timeline.currentFrame].emphasize();
			}
		}
		return this;
	}

	update(): this {
		for (const uid in this.trackList) {
			const track = this.trackList[uid];

			if (this.scale === null || this.scale === undefined) {
				track.unit = 'px';
			} else {
				track.scale = this.scale;

				if (track.unit !== this.scale.unit().toString()) {
					track.unit = this.scale.unit().toString();
					track.table.newCols({ t: 's', x: track.unit, y: track.unit });
				}
			}
		}
		if (this.track !== null && this.track !== undefined) {
			let tableData: TableRowData[] = this.track.export().points.scaled;
			if (tableData.length === 0) tableData = [{ '': '' }];
			this.track.table.newData(tableData, true, true);
		}
		return this;
	}
}
