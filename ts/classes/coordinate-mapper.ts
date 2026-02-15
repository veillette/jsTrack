/**
 * CoordinateMapper handles conversion between video pixel coordinates
 * and canvas display coordinates, accounting for zoom, pan, and scale.
 */

import type { Coordinate } from './axes';
import type { Project } from './project';

export class CoordinateMapper {
	private project: Project;

	constructor(project: Project) {
		this.project = project;
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
			width:
				this.project.timeline.video.videoWidth * (this.project.backgroundScale * this.project.positioning.zoom),
			height:
				this.project.timeline.video.videoHeight *
				(this.project.backgroundScale * this.project.positioning.zoom),
		};
		const unchanging = {
			width: this.project.timeline.video.videoWidth,
			height: this.project.timeline.video.videoHeight,
		};
		const translation = {
			x: this.project.positioning.x,
			y: this.project.positioning.y,
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
			width:
				this.project.timeline.video.videoWidth * (this.project.backgroundScale * this.project.positioning.zoom),
			height:
				this.project.timeline.video.videoHeight *
				(this.project.backgroundScale * this.project.positioning.zoom),
		};
		const unchanging = {
			width: this.project.timeline.video.videoWidth,
			height: this.project.timeline.video.videoHeight,
		};
		const translation = {
			x: this.project.positioning.x,
			y: this.project.positioning.y,
		};

		return {
			x: ((xNum - translation.x) / changing.width) * unchanging.width,
			y: ((yNum - translation.y) / changing.height) * unchanging.height,
		};
	}

	updateScale(): void {
		if (this.project.axes !== undefined && this.project.axes !== null) {
			const moveTo = this.toUnscaled(this.project.axes.x, this.project.axes.y);
			this.project.axes.shape.x = moveTo.x;
			this.project.axes.shape.y = moveTo.y;
		}
		for (let i = 0; i < this.project.timeline.frames.length; i++) {
			const frame = this.project.timeline.frames[i];
			for (let j = 0; j < frame.points.length; j++) {
				const point = frame.points[j];
				const scaled = this.toUnscaled(point.x, point.y);
				point.shape.x = point.circle.x = scaled.x;
				point.shape.y = point.circle.y = scaled.y;
			}
		}
		if (this.project.scale !== undefined && this.project.scale !== null) {
			const moveTo = [
				this.toUnscaled(this.project.scale.positions[0]),
				this.toUnscaled(this.project.scale.positions[1]),
			];
			this.project.scale.nodes[0].x = moveTo[0].x;
			this.project.scale.nodes[0].y = moveTo[0].y;
			this.project.scale.nodes[1].x = moveTo[1].x;
			this.project.scale.nodes[1].y = moveTo[1].y;
			this.project.scale.update();
		}
	}
}
