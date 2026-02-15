/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import type Handsontable from 'handsontable';
import type { UndoManagerInstance } from 'undo-manager';
import UndoManager from 'undo-manager';
import { roundTo } from '../functions';
import { Axes, type Coordinate } from './axes';
import { CoordinateMapper } from './coordinate-mapper';
import { EventEmitter } from './event-emitter';
import { type LoadFileData, type ProjectSaveFile, ProjectSerializer } from './project-serializer';
import { Scale } from './scale';
import type { TableRowData } from './table';
import type { Timeline } from './timeline';
import { Track } from './track';

export type { ProjectSaveFile } from './project-serializer';

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
	off(event: string, callback: PositioningCallback): ProjectPositioning;
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
	offModeChange(val: ProjectModeCallback): void;
	default(): void;
}

export class Project extends EventEmitter {
	name: string;
	created: boolean;
	uid: string;
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
	undoManager: UndoManagerInstance;
	saveIndex: number;
	backUpIndex: number;
	viewPoints: { forward: number; backward: number };
	videoSpeed: number;
	handsOnTable: Handsontable;
	positioning: ProjectPositioning;
	state: ProjectState;
	onEditTrack: ((data: Record<string, string>) => void) | null;
	readonly coordinateMapper: CoordinateMapper;
	readonly serializer: ProjectSerializer;

	constructor(
		name: string,
		timeline: Timeline,
		handsOnTable: Handsontable,
		stage: createjs.Stage,
		background: createjs.Bitmap,
	) {
		super();
		this.name = name;
		this.created = false;
		this.uid = crypto.randomUUID();
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
		this.onEditTrack = null;
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

		this.coordinateMapper = new CoordinateMapper(this);
		this.serializer = new ProjectSerializer(this);

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
				this._zoom = roundTo(value, 5);
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
				this._x = roundTo(value, 5);

				project.background.x = this._x;
				project.updateScale();

				this.trigger('translation');
			},
			get y(): number {
				return this._y;
			},
			set y(value: number) {
				this._y = roundTo(value, 5);

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
			off(event: string, callback: PositioningCallback) {
				const events = event.split(',');
				for (let i = 0; i < events.length; i++) {
					const tempEvent = events[i].trim();
					const cbs = this._callbacks[tempEvent];
					if (cbs) {
						const idx = cbs.indexOf(callback);
						if (idx !== -1) cbs.splice(idx, 1);
					}
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
			offModeChange(val: ProjectModeCallback) {
				const idx = this.modeCallbacks.indexOf(val);
				if (idx !== -1) this.modeCallbacks.splice(idx, 1);
			},
			default() {
				this._mode = 'default';
				this.triggerChange();
			},
		};

		this.state.modeChange(function (this: Project, mode: string) {
			if (mode === 'add') {
				if (this.axes != null) {
					this.axes.hide();
				}
				if (this.scale != null) {
					this.scale.hide();
				}
			} else {
				if (this.axes != null) {
					this.axes.show();
				}
				if (this.scale != null) {
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
					if (navigator.userAgent.includes('Firefox')) {
						this.stage.cursor = "url('icons/add_point.png') 16 16, copy";
					} else if (navigator.userAgent.includes('Chrome')) {
						this.stage.cursor = "url('icons/add_point.png') 8 8, copy";
					} else {
						this.stage.cursor = 'copy';
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

	// ─── Coordinate Mapping (delegates to CoordinateMapper) ───

	toUnscaled(x: number | Coordinate, y: number | null = null): Coordinate {
		return this.coordinateMapper.toUnscaled(x, y);
	}

	toScaled(x: number | Coordinate, y: number | null = null): Coordinate {
		return this.coordinateMapper.toScaled(x, y);
	}

	updateScale(): void {
		this.coordinateMapper.updateScale();
	}

	// ─── Serialization (delegates to ProjectSerializer) ───

	save(): ProjectSaveFile {
		return this.serializer.save();
	}

	load(fileData: LoadFileData): this {
		this.serializer.load(fileData);
		return this;
	}

	// ─── Undo/Redo ───

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

	// ─── Events ───

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

	// ─── Point Visibility ───

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
			if (this.track != null) {
				if (this.track.emphasizedPoint != null) {
					this.track.emphasizedPoint.emphasize();
				}
			}
		}
		return this;
	}

	// ─── Lifecycle ───

	destroy(): this {
		for (const uid in this.trackList) {
			const track = this.trackList[uid];
			track.listElement.container.remove();
		}
		if (this.scale != null) this.scale.textElement.remove();

		this.handsOnTable.destroy();
		return this;
	}

	// ─── Track Management ───

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

	// ─── Axes & Scale Management ───

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

	// ─── Track Switching & Data Update ───

	switchTrack(uid: string): this {
		if (this.trackList[uid] !== undefined) {
			if (this.track != null) {
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

			if (this.scale == null) {
				track.unit = 'px';
			} else {
				track.scale = this.scale;

				if (track.unit !== this.scale.unit().toString()) {
					track.unit = this.scale.unit().toString();
					track.table.newCols({ t: 's', x: track.unit, y: track.unit });
				}
			}
		}
		if (this.track != null) {
			let tableData: TableRowData[] = this.track.export().points.scaled;
			if (tableData.length === 0) tableData = [{ '': '' }];
			this.track.table.newData(tableData, true, true);
		}
		return this;
	}
}
