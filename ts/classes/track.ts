/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import type { Axes } from './axes';
import type { Frame } from './frame';
import { Point, type PointExportData } from './point';
import type { Project } from './project';
import type { Scale } from './scale';
import { Table, type TableRowData } from './table';
import type { Timeline } from './timeline';

type TrackModeCallback = (this: Track, mode: string, lastMode: string) => void;
type TrackSelectionCallback = (selected: boolean) => void;

interface TrackState {
	_mode: string;
	_lastMode: string;
	_selected: boolean;
	modeCallbacks: TrackModeCallback[];
	selectionCallbacks: TrackSelectionCallback[];
	mode: string;
	selected: boolean;
	triggerChange(): void;
	resetMode(): void;
	modeChange(val: TrackModeCallback): void;
	offModeChange(val: TrackModeCallback): void;
	selectionChange(val: TrackSelectionCallback): void;
}

interface TrackListElement {
	container: HTMLLIElement;
	swath: HTMLDivElement;
	name: HTMLDivElement;
	visibility: HTMLDivElement;
	delete: HTMLDivElement;
}

export interface TrackExportData {
	name: string;
	points: {
		scaled: TableRowData[];
		pixels: TableRowData[];
	};
	table: {
		scaled: Array<Array<string | number>>;
		pixels: Array<Array<string | number>>;
	};
}

export class Track {
	name: string;
	color: string;
	project: Project;
	hidden: boolean;
	selectedPoints: Record<string, Point>;
	unit: string;
	timeline: Timeline;
	stage: createjs.Stage;
	points: Record<number, Point>;
	deletedPoints: Record<number, Point>;
	selectedPoint: Point | null;
	emphasizedPoint: Point | null;
	table: Table;
	uid: string;
	listElement: TrackListElement;
	state: TrackState;
	scale!: Scale;

	constructor(
		project: Project,
		timeline: Timeline,
		name: string,
		color: string,
		stage: createjs.Stage,
		uid: string | false = false,
	) {
		this.name = name;
		this.color = color;
		this.project = project;
		this.hidden = false;
		this.selectedPoints = {};

		if (this.project.scale === null || this.project.scale === undefined) {
			this.unit = 'px';
		} else {
			this.unit = this.project.scale.unit().toString();
		}
		this.timeline = timeline;
		this.stage = stage;
		this.points = {};
		this.deletedPoints = {};
		this.selectedPoint = null;
		this.emphasizedPoint = null;
		this.table = new Table(this, { t: 's', x: this.unit, y: this.unit });
		if (uid === false) this.uid = crypto.randomUUID();
		else this.uid = uid.toString();
		this.listElement = {
			container: document.createElement('li'),
			swath: document.createElement('div'),
			name: document.createElement('div'),
			visibility: document.createElement('div'),
			delete: document.createElement('div'),
		};
		this.listElement.container.setAttribute('data-uid', this.uid);
		this.listElement.container.title = 'Double Click to Edit';
		this.listElement.swath.classList.add('swath');
		this.listElement.swath.style.background = this.color;
		this.listElement.name.classList.add('name');
		this.listElement.name.innerText = this.name;
		this.listElement.visibility.classList.add('visibility');
		this.listElement.visibility.title = 'Hide Track';
		this.listElement.delete.classList.add('delete');
		this.listElement.delete.title = 'Delete Track';

		const trackListUl = document.getElementById('track-list')?.querySelector('ul');
		if (trackListUl) trackListUl.appendChild(this.listElement.container);
		this.listElement.container.appendChild(this.listElement.swath);
		this.listElement.container.appendChild(this.listElement.name);
		this.listElement.container.appendChild(this.listElement.delete);
		this.listElement.container.appendChild(this.listElement.visibility);

		const track = this;
		this.state = {
			_mode: 'default',
			_lastMode: '',
			_selected: true,
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
					this.modeCallbacks[i].call(track, this._mode, this._lastMode);
				}
			},
			resetMode() {
				const tempLastMode = this._lastMode;
				this._lastMode = this._mode;
				this._mode = tempLastMode;
				this.triggerChange();
			},
			modeChange(val: TrackModeCallback) {
				this.modeCallbacks.push(val);
			},
			offModeChange(val: TrackModeCallback) {
				const idx = this.modeCallbacks.indexOf(val);
				if (idx !== -1) this.modeCallbacks.splice(idx, 1);
			},
			set selected(val: boolean) {
				this._selected = val;
				for (let i = 0; i < this.selectionCallbacks.length; i++) {
					this.selectionCallbacks[i](this._selected);
				}
			},
			get selected(): boolean {
				return this._selected;
			},
			selectionChange(val: TrackSelectionCallback) {
				this.selectionCallbacks.push(val);
			},
		};

		const tempTrack = this;
		this.stage.addEventListener('click', (e: createjs.MouseEvent) => {
			const point = tempTrack.selectedPoint;
			if (point !== null && point !== undefined) {
				const mouseCoords = point.shape.globalToLocal(e.stageX, e.stageY);
				if (mouseCoords.x < -1 || mouseCoords.x > 12 || mouseCoords.y < -1 || mouseCoords.y > 12) {
					point.unselect();
				}
			}
		});
		this.listElement.container.addEventListener('click', () => {
			let lastUid = '';
			if (tempTrack.project.track !== null && tempTrack.project.track !== undefined) {
				lastUid = tempTrack.project.track.uid;
			}
			tempTrack.project.change({
				undo: () => {
					tempTrack.project.switchTrack(lastUid);
				},
				redo: () => {
					tempTrack.project.switchTrack(tempTrack.uid);
				},
			});

			tempTrack.project.switchTrack(tempTrack.uid);
		});
		this.listElement.container.addEventListener('dblclick', () => {
			if (tempTrack.project.onEditTrack) {
				tempTrack.project.onEditTrack({
					name: tempTrack.name,
					color: tempTrack.color,
					uid: tempTrack.uid,
				});
			}
		});

		this.listElement.delete.addEventListener('click', (e) => {
			e.stopPropagation();
			tempTrack.project.change({
				undo: () => {
					tempTrack.project.undeleteTrack(tempTrack.uid);
				},
				redo: () => {
					tempTrack.project.deleteTrack(tempTrack.uid);
				},
			});

			tempTrack.project.deleteTrack(tempTrack.uid);
		});
		this.listElement.visibility.addEventListener(
			'click',
			function (this: HTMLDivElement, e) {
				e.stopPropagation();
				if (this.classList.contains('hidden')) {
					tempTrack.project.change({
						undo: () => {
							tempTrack.hide();
						},
						redo: () => {
							tempTrack.show();
						},
					});
					tempTrack.show();
				} else {
					tempTrack.project.change({
						undo: () => {
							tempTrack.show();
						},
						redo: () => {
							tempTrack.hide();
						},
					});
					tempTrack.hide();
				}
			},
			false,
		);
	}

	hide(): void {
		this.state.mode = 'hidden';
		this.hidden = true;
		this.listElement.visibility.classList.add('hidden');
		this.listElement.visibility.title = 'Make Visible';
	}

	show(): void {
		this.state.resetMode();
		this.hidden = false;
		this.listElement.visibility.classList.remove('hidden');
		this.listElement.visibility.title = 'Hide Track';
	}

	update(data: Record<string, string>): void {
		for (const key in data) {
			switch (key) {
				case 'name':
					this.name = data[key];
					this.listElement.name.innerText = this.name;
					this.project.changed();
					break;
				case 'color':
					this.color = data[key];
					this.listElement.swath.style.background = this.color;
					for (const pointKey in this.points) {
						this.points[pointKey].color(this.color);
					}
					this.project.changed();
					break;
			}
		}
	}

	export(axes: Axes | null = this.project.axes, scale: Scale | null = this.project.scale): TrackExportData {
		const data: TrackExportData = {
			name: this.name,
			points: { scaled: [], pixels: [] },
			table: { scaled: [], pixels: [] },
		};

		data.table.scaled.push(['t (s)', `x (${this.unit})`, `y (${this.unit})`]);
		data.table.pixels.push(['t (s)', `x (${this.unit})`, `y (${this.unit})`]);

		for (const key in this.points) {
			if (Object.hasOwn(this.points, key)) {
				const point = this.points[key];
				const pointData: PointExportData | undefined = point.export(axes, scale);
				if (pointData !== undefined) {
					const pushData = {
						pixels: {
							t: pointData.t,
							x: pointData.pixels.x,
							y: pointData.pixels.y,
						},
						scaled: {
							t: pointData.t,
							x: pointData.scaled.x,
							y: pointData.scaled.y,
						},
					};

					data.points.pixels.push(pushData.pixels);
					data.table.pixels.push([pushData.pixels.t, pushData.pixels.x, pushData.pixels.y]);

					data.points.scaled.push(pushData.scaled);
					data.table.scaled.push([pushData.scaled.t, pushData.scaled.x, pushData.scaled.y]);
				}
			}
		}
		return data;
	}

	addPoint(frame: Frame, x: number, y: number, _userAction = true): Point {
		if (this.points[frame.number] !== undefined) {
			const point = this.points[frame.number];
			const toGo = { x: point.x, y: point.y };
			this.project.change({
				undo: () => {
					point.move(toGo.x, toGo.y);
					this.project.timeline.seek(frame.number);
					this.project.update();
				},
				redo: () => {
					point.move(x, y);
					this.project.timeline.seek(frame.number);
					this.project.update();
				},
			});

			point.move(x, y).select();
			this.project.trigger('newpoint');
			this.project.update();
			this.project.updateVisiblePoints();
			return this.points[frame.number];
		} else {
			const newPoint = new Point(this, frame, x, y);
			this.points[frame.number] = newPoint;
			frame.points.push(newPoint);
			this.project.timeline.activeFrames.push(frame);
			this.project.change({
				undo: () => {
					newPoint.remove();
					this.project.timeline.seek(newPoint.frame.number);
					this.project.update();
				},
				redo: () => {
					newPoint.unRemove();
					this.project.timeline.seek(newPoint.frame.number);
					this.project.update();
				},
			});

			const pointData = newPoint.export();
			if (pointData !== undefined)
				this.table.addRow({ t: pointData.t, x: pointData.scaled.x, y: pointData.scaled.y }, true);

			this.project.trigger('newpoint');
			this.project.updateVisiblePoints();
			return newPoint;
		}
	}

	unselectAll(): void {
		if (this.selectedPoint !== null && this.selectedPoint !== undefined) {
			this.selectedPoint.unselect();
		}
		this.selectedPoint = null;
	}

	unemphasizeAll(): void {
		if (this.emphasizedPoint !== null && this.emphasizedPoint !== undefined) {
			this.emphasizedPoint.unemphasize();
		}
		this.emphasizedPoint = null;
	}

	select(): void {
		const trackListUl = document.getElementById('track-list')?.querySelector('ul');
		if (trackListUl) {
			trackListUl.querySelectorAll('li').forEach((el) => {
				el.classList.remove('selected');
			});
		}
		this.listElement.container.classList.add('selected');
	}

	unselect(): void {
		this.listElement.container.classList.remove('selected');
	}
}
