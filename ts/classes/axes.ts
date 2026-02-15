/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import { cot, toDegrees, toRadians } from '../functions';
import type { Project } from './project';

export interface Coordinate {
	x: number;
	y: number;
}

export class Axes {
	stage: createjs.Stage;
	project: Project;
	x: number;
	y: number;
	theta: number;
	color: string;
	styles: { color: createjs.GraphicsCommand[] };
	size: number;
	shape: createjs.Shape;
	hitShape: createjs.Shape;

	constructor(stage: createjs.Stage, x: number, y: number, color: string, project: Project) {
		this.stage = stage;
		this.project = project;
		this.x = x;
		this.y = y;
		this.theta = 0;
		this.color = color;
		this.styles = {
			color: [],
		};
		this.size = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2) * 4;
		this.shape = new createjs.Shape();
		const unscaled = this.project.toUnscaled(this.x, this.y);
		this.shape.x = unscaled.x;
		this.shape.y = unscaled.y;
		this.shape.rotation = this.theta;
		this.shape.cursor = 'pointer';
		this.stage.addChild(this.shape);
		this.styles.color.push(this.shape.graphics.beginFill(this.color).command);
		this.shape.graphics.drawRect(19, -6, 2, 12);
		this.shape.graphics.drawRect(-this.size / 2, -1, this.size, 2);
		this.shape.graphics.drawRect(-1, -this.size / 2, 2, this.size);

		this.hitShape = new createjs.Shape();

		this.styles.color.push(this.hitShape.graphics.beginFill(this.color).command);
		this.hitShape.graphics.drawRect(-this.size / 2, -3, this.size, 6);
		this.hitShape.graphics.drawRect(-3, -this.size / 2, 6, this.size);
		this.shape.hitArea = this.hitShape;
		let moving = false;
		let rotating = false;
		this.shape.addEventListener('mousedown', (e: createjs.MouseEvent) => {
			const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);
			moving = false;
			rotating = false;
			const mouseCoords = this.convert(this.project.toScaled(coords));
			if (mouseCoords.x < 20 && mouseCoords.x > -20 && mouseCoords.y < 20 && mouseCoords.y > -20) {
				moving = true;
				this.shape.cursor = 'grabbing';
				this.stage.update();
				this.stage._testMouseOver(true);
			} else if (mouseCoords.x > 20) {
				rotating = true;
				moving = false;
			}
		});
		this.shape.addEventListener('tick', (e: createjs.MouseEvent) => {
			const coords = e.target.stage.globalToLocal(stage.mouseX, stage.mouseY);
			const mouseCoords = this.convert(this.project.toScaled(coords.x, coords.y));
			if (mouseCoords.x < 20 && mouseCoords.x > -20 && mouseCoords.y < 20 && mouseCoords.y > -20) {
				if (moving) {
					this.shape.cursor = 'grabbing';
				} else {
					this.shape.cursor = 'grab';
					this.stage._testMouseOver(true);
				}
			} else if (mouseCoords.x > 20) {
				this.cursor();
			} else {
				this.shape.cursor = 'default';
			}
		});
		this.shape.addEventListener('pressmove', (e: createjs.MouseEvent) => {
			const coords = this.project.toScaled(e.stageX, e.stageY);
			const coordsUnscaled = this.project.toUnscaled(coords);

			if (moving) {
				this.shape.cursor = 'grabbing';
				this.shape.x = coordsUnscaled.x - 1;
				this.shape.y = coordsUnscaled.y - 1;
			} else if (rotating) {
				let sign = 1;
				let reference = Math.PI;

				if (coords.y > this.y && coords.x > this.x) {
					sign = 1;
					reference = Math.PI * 2;
				} else if (coords.y > this.y && coords.x < this.x) {
					sign = 1;
					reference = Math.PI;
				} else if (coords.y < this.y && coords.x < this.x) {
					sign = 1;
					reference = Math.PI;
				} else if (coords.y < this.y && coords.x > this.x) {
					sign = 1;
					reference = 0;
				}

				let theta = sign * (-sign * Math.atan((this.y - coords.y) / (this.x - coords.x)) + reference);
				if (theta === Math.PI && coords.x > this.x) {
					theta = 0;
				}

				this.cursor(toDegrees(theta));

				this.shape.rotation = -toDegrees(theta);
			}
		});
		this.shape.addEventListener('pressup', () => {
			if (moving) {
				const lastCoords = {
					x: this.x,
					y: this.y,
				};

				const lastCoordsUnscaled = this.project.toUnscaled(lastCoords);

				const newCoordsUnscaled = {
					x: this.shape.x,
					y: this.shape.y,
				};
				const coords = this.project.toScaled(this.shape.x, this.shape.y);
				this.x = coords.x;
				this.y = coords.y;

				this.project.change({
					undo: () => {
						this.x = lastCoords.x;
						this.y = lastCoords.y;
						this.shape.x = lastCoordsUnscaled.x - 1;
						this.shape.y = lastCoordsUnscaled.y - 1;
						this.project.update();
					},
					redo: () => {
						this.x = coords.x;
						this.y = coords.y;
						this.shape.x = newCoordsUnscaled.x - 1;
						this.shape.y = newCoordsUnscaled.y - 1;
						this.project.update();
					},
				});
			} else if (rotating) {
				const lastRotation = this.theta;
				const newRotation = (this.theta = -toRadians(this.shape.rotation));
				this.project.change({
					undo: () => {
						this.theta = lastRotation;
						this.shape.rotation = -toDegrees(lastRotation);
						this.project.update();
					},
					redo: () => {
						this.theta = newRotation;
						this.shape.rotation = -toDegrees(newRotation);
						this.project.update();
					},
				});
			}

			this.project.update();
			moving = false;
			rotating = false;
		});
	}

	hide(): void {
		this.stage.removeChild(this.shape);
	}

	show(): void {
		this.stage.addChild(this.shape);
	}

	rotate(radians: number): void {
		this.theta = radians;
		this.shape.rotation = -toDegrees(this.theta);
	}

	updateColor(color: string): void {
		this.color = color;
		for (let i = 0; i < this.styles.color.length; i++) {
			this.styles.color[i].style = this.color;
		}
		this.project.changed();
	}

	cursor(cursorDegree: number = toDegrees(this.theta)): void {
		if ((cursorDegree >= 0 && cursorDegree <= 20) || (cursorDegree > 340 && cursorDegree <= 360)) {
			this.shape.cursor = 'ns-resize';
		} else if (cursorDegree > 20 && cursorDegree <= 60) {
			this.shape.cursor = 'nw-resize';
		} else if (cursorDegree > 60 && cursorDegree <= 120) {
			this.shape.cursor = 'ew-resize';
		} else if (cursorDegree > 120 && cursorDegree <= 160) {
			this.shape.cursor = 'ne-resize';
		} else if (cursorDegree > 160 && cursorDegree <= 200) {
			this.shape.cursor = 'ns-resize';
		} else if (cursorDegree > 200 && cursorDegree <= 250) {
			this.shape.cursor = 'se-resize';
		} else if (cursorDegree > 250 && cursorDegree <= 290) {
			this.shape.cursor = 'ew-resize';
		} else if (cursorDegree > 290 && cursorDegree <= 340) {
			this.shape.cursor = 'ne-resize';
		}
	}

	/**
	 * Converts a point from video pixel coordinates to the rotated axes coordinate system.
	 *
	 * The Y axis is flipped (screen Y is inverted) before applying the rotation.
	 * For the general case, the method projects the point onto the rotated X and Y axes
	 * by computing line–line intersections:
	 *   - interceptX: perpendicular drop from the point onto the rotated X-axis line
	 *   - interceptY: perpendicular drop from the point onto the rotated Y-axis line
	 * The signed distances from the origin to these intercepts give the (x, y) result.
	 *
	 * Special cases for theta = 0, π/2, π, 3π/2, 2π use direct arithmetic to avoid
	 * division by zero in tan/cot.
	 *
	 * @param x - X in video pixel coords, or a Coordinate object
	 * @param y - Y in video pixel coords (ignored if x is a Coordinate)
	 * @returns The point expressed in the rotated axes coordinate system
	 */
	convert(x: number | Coordinate, y: number | null = null): Coordinate {
		let xVal: number;
		let yVal: number;
		if (typeof x === 'object') {
			xVal = x.x;
			yVal = y ?? x.y;
		} else if (typeof y === 'number') {
			xVal = x;
			yVal = y;
		} else {
			return { x: 0, y: 0 };
		}

		const coords = { x: xVal, y: -yVal };
		const origin = { x: this.x, y: -this.y };

		const tan = Math.tan(this.theta);
		const cotTheta = cot(this.theta);

		const interceptX = { x: 0, y: 0 };
		interceptX.x = (-origin.y + coords.y + tan * origin.x + cotTheta * coords.x) / (cotTheta + tan);
		interceptX.y = tan * interceptX.x + (origin.y - tan * origin.x);

		const interceptY = { x: 0, y: 0 };
		interceptY.x = (-coords.y + origin.y + tan * coords.x + cotTheta * origin.x) / (cotTheta + tan);
		interceptY.y = -cotTheta * interceptY.x + (origin.y + cotTheta * origin.x);

		let signX = Math.sign(interceptX.x - origin.x);
		if (this.theta > 0.5 * Math.PI && this.theta < 1.5 * Math.PI) {
			signX *= -1;
		}

		let location = {
			x: signX * Math.sqrt((interceptX.y - origin.y) ** 2 + (interceptX.x - origin.x) ** 2),
			y:
				Math.sign(interceptY.y - origin.y) *
				Math.sqrt((interceptX.y - coords.y) ** 2 + (interceptX.x - coords.x) ** 2),
		};

		switch (this.theta) {
			case 0:
				location = { x: coords.x - origin.x, y: coords.y - origin.y };
				break;
			case 0.5 * Math.PI:
				location = { x: coords.y - origin.y, y: origin.x - coords.x };
				break;
			case Math.PI:
				location = { x: origin.x - coords.x, y: origin.y - coords.y };
				break;
			case 1.5 * Math.PI:
				location = { x: origin.y - coords.y, y: coords.x - origin.x };
				break;
			case 2 * Math.PI:
				location = { x: coords.x - origin.x, y: coords.y - origin.y };
				break;
		}

		return location;
	}
}
