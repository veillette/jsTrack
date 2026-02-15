/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import { roundSig, roundTo } from '../functions';
import type { Axes } from './axes';
import type { Frame } from './frame';
import type { Scale } from './scale';
import type { Track } from './track';

export interface PointExportData {
	t: number;
	pixels: { x: number; y: number };
	scaled: { x: number; y: number };
}

export class Point {
	track: Track;
	frame: Frame;
	hidden: boolean;
	x: number;
	y: number;
	pointSize: number;
	shape: createjs.Shape;
	strokeWidth: createjs.GraphicsCommand;
	strokeColor: createjs.GraphicsCommand;
	pointRect: createjs.GraphicsCommand;
	circle: createjs.Shape;
	deleted: boolean;
	private _trackModeCallback: (this: Track, mode: string, lastMode: string) => void;
	private _projectModeCallback: (mode: string, lastMode: string) => void;

	constructor(track: Track, frame: Frame, x: number, y: number) {
		this.track = track;
		this.frame = frame;
		this.hidden = false;
		this.x = x;
		this.y = y;
		this.pointSize = 6;
		this.shape = new createjs.Shape();
		this.shape.cursor = 'pointer';
		this.shape.regX = this.pointSize / 2;
		this.shape.regY = this.pointSize / 2;
		const unscaled = this.track.project.toUnscaled(x, y);
		this.shape.x = unscaled.x;
		this.shape.y = unscaled.y;
		this.shape.rotation = 45;
		this.shape.hitArea = new createjs.Shape(new createjs.Graphics().beginFill('#000000').drawRect(-1, -1, 12, 12));

		this.strokeWidth = this.shape.graphics.setStrokeStyle(2).command;
		this.strokeColor = this.shape.graphics.beginStroke(this.track.color).command;
		this.pointRect = this.shape.graphics.drawRect(0, 0, this.pointSize, this.pointSize).command;

		this.circle = new createjs.Shape();
		this.circle.regX = (this.pointSize + 6) / 2;
		this.circle.regY = (this.pointSize + 6) / 2;
		this.circle.x = this.shape.x;
		this.circle.y = this.shape.y;
		this.circle.graphics.setStrokeStyle(2);
		this.circle.graphics.beginStroke(this.track.color);
		this.circle.graphics.drawEllipse(0, 0, this.pointSize + 6, this.pointSize + 6);

		this.deleted = false;

		if (this.track.state.mode !== 'add' && this.track.state.mode !== 'hidden') {
			this.track.stage.addChild(this.shape);
		}

		const tempShape = this;
		this._trackModeCallback = function (this: Track, mode: string) {
			if (mode === 'add' || mode === 'hidden') {
				tempShape.track.stage.removeChild(tempShape.shape);
				tempShape.track.stage.removeChild(tempShape.circle);
			} else {
				if (!tempShape.deleted && !tempShape.hidden) {
					tempShape.track.stage.addChild(tempShape.shape);
				}
			}
		};
		this.track.state.modeChange(this._trackModeCallback);
		let moving = false;
		this.shape.on('pressmove', (e: createjs.MouseEvent) => {
			if (tempShape.track.project.state.mode !== 'seek') {
				const coords = tempShape.track.project.toScaled(e.stageX, e.stageY);
				moving = true;
				tempShape.move(coords.x, coords.y, true);
				tempShape.select();
			}
		});
		this.shape.on('pressup', (e: createjs.MouseEvent) => {
			if (tempShape.track.project.state.mode !== 'seek' && moving) {
				moving = false;
				const coords = tempShape.track.project.toScaled(e.stageX, e.stageY);

				const goTo = { x: tempShape.x, y: tempShape.y };
				tempShape.track.project.change({
					undo: () => {
						tempShape.move(goTo.x, goTo.y);
					},
					redo: () => {
						tempShape.move(coords.x, coords.y);
					},
				});

				tempShape.move(coords.x, coords.y);
				tempShape.track.project.update();
			}
		});
		this.shape.on('dblclick', () => {
			tempShape.remove();

			tempShape.track.project.change({
				undo: () => {
					const tempPoint = tempShape.track.deletedPoints[tempShape.frame.number];
					if (tempPoint) {
						tempPoint.deleted = false;
						tempShape.track.points[tempPoint.frame.number] = tempPoint;
						tempShape.track.stage.addChild(tempPoint.shape);
						tempShape.track.project.update();
					}
				},
				redo: () => {
					tempShape.remove();
				},
			});
		});
		this.shape.on('click', () => {
			tempShape.track.unselectAll();
			tempShape.select();

			if (tempShape.track.project.state.mode === 'seek') {
				tempShape.track.project.timeline.seek(tempShape.frame.number);
				tempShape.track.project.switchTrack(tempShape.track.uid);
				tempShape.track.project.changed();
			}
		});
		this._projectModeCallback = (mode: string) => {
			if (mode === 'seek') {
				tempShape.shape.cursor = 'crosshair';
			} else {
				tempShape.shape.cursor = 'pointer';
			}
		};
		this.track.project.state.modeChange(this._projectModeCallback);
	}

	hide(): this {
		this.track.stage.removeChild(this.shape);
		this.track.stage.removeChild(this.circle);
		this.hidden = true;
		return this;
	}

	show(): this {
		if (!this.deleted) {
			this.track.stage.addChild(this.shape);
			this.hidden = false;
		}
		return this;
	}

	color(color: string): void {
		this.strokeColor.style = color;
	}

	export(
		axes: Axes | null = this.track.project.axes,
		scale: Scale | null = this.track.project.scale,
	): PointExportData | undefined {
		if (this.frame.number >= this.track.timeline.startFrame && this.frame.number <= this.track.timeline.endFrame) {
			if (!axes) return undefined;
			const location = axes.convert(this.x, this.y);

			const data: PointExportData = {
				t: roundSig(
					this.track.project.videoSpeed *
						(this.frame.time - this.track.timeline.getFrameStart(this.track.timeline.startFrame)),
					6,
				),
				pixels: { x: 0, y: 0 },
				scaled: { x: 0, y: 0 },
			};

			data.pixels.x = roundTo(location.x, 5);
			data.pixels.y = roundTo(location.y, 5);

			if (scale === null || scale === undefined) {
				data.scaled.x = roundTo(location.x, 5);
				data.scaled.y = roundTo(location.y, 5);
			} else {
				data.scaled.x = roundTo(scale.convert(location.x).number, 5);
				data.scaled.y = roundTo(scale.convert(location.y).number, 5);
			}

			return data;
		}
		return undefined;
	}

	emphasize(multiple = false): this {
		if (!multiple) this.track.unemphasizeAll();
		if (!this.track.hidden && !this.hidden && this.track.state.mode !== 'add')
			this.track.stage.addChild(this.circle);
		this.circle.x = this.shape.x;
		this.circle.y = this.shape.y;
		this.track.emphasizedPoint = this;
		return this;
	}

	unemphasize(): void {
		this.track.stage.removeChild(this.circle);
		this.track.emphasizedPoint = null;
		this.track.stage.update();
	}

	select(multiple = false): this {
		if (!multiple) this.track.unselectAll();
		this.shape.rotation = 0;
		this.strokeWidth.width = 2;
		this.pointRect.w = this.pointSize + 2;
		this.pointRect.h = this.pointSize + 2;
		this.shape.regX = (this.pointSize + 2) / 2;
		this.shape.regY = (this.pointSize + 2) / 2;

		this.track.selectedPoint = this;
		return this;
	}

	unselect(): this {
		this.shape.rotation = 45;
		this.strokeWidth.width = 2;
		this.pointRect.w = this.pointSize;
		this.pointRect.h = this.pointSize;
		this.shape.regX = this.pointSize / 2;
		this.shape.regY = this.pointSize / 2;
		this.track.selectedPoint = null;
		return this;
	}

	move(x: number, y: number, internal = false): this {
		const unscaled = this.track.project.toUnscaled(x, y);
		this.shape.x = unscaled.x;
		this.shape.y = unscaled.y;
		this.circle.x = unscaled.x;
		this.circle.y = unscaled.y;
		if (!internal) {
			this.x = x;
			this.y = y;
		}
		return this;
	}

	remove(): void {
		this.track.stage.removeChild(this.shape);
		this.track.stage.removeChild(this.circle);
		this.unselect().unemphasize();
		this.deleted = true;
		this.track.state.offModeChange(this._trackModeCallback);
		this.track.project.state.offModeChange(this._projectModeCallback);
		this.track.deletedPoints[this.frame.number] = this;
		delete this.track.points[this.frame.number];
		this.track.project.update();
	}

	unRemove(): void {
		if (!this.track.hidden && !this.hidden) {
			this.track.stage.addChild(this.shape);
		}
		this.deleted = false;
		this.track.state.modeChange(this._trackModeCallback);
		this.track.project.state.modeChange(this._projectModeCallback);
		this.track.points[this.frame.number] = this;
		delete this.track.deletedPoints[this.frame.number];
		this.track.project.update();
	}
}
