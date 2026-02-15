/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import type { Coordinate } from './axes';
import type { Project } from './project';

interface ScaleProcessedValue {
	textValue: string;
	size: MathJsUnit;
}

export class Scale {
	stage: createjs.Stage;
	project: Project;
	color: string;
	nodeSize: number;
	positions: [Coordinate, Coordinate];
	textValue: string;
	size: MathJsUnit;
	hitArea: createjs.Shape;
	nodes: [createjs.Shape, createjs.Shape];
	length: number;
	line: createjs.Shape;
	lineStart: createjs.GraphicsCommand;
	lineEnd: createjs.GraphicsCommand;
	textSizingElement: HTMLSpanElement;
	letterWidth: number;
	textElement: HTMLInputElement;
	text: createjs.DOMElement;
	textHitShape: createjs.Shape;
	textHit: createjs.GraphicsCommand;
	uid: string;
	styleCommands: { colors: createjs.GraphicsCommand[] };

	constructor(
		stage: createjs.Stage,
		size: string | null,
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color: string,
		project: Project,
	) {
		this.stage = stage;
		this.project = project;
		this.color = color;
		this.nodeSize = 8;
		this.uid = crypto.randomUUID();
		this.positions = [
			{ x: x1, y: y1 },
			{ x: x2, y: y2 },
		];
		if (size == null) {
			this.textValue = math.unit('1m').toString();
			this.size = math.unit('1m');
		} else {
			const valueProcessed = this.processValue(size);
			if (valueProcessed !== false) {
				this.textValue = valueProcessed.textValue;
				this.size = valueProcessed.size;
			} else {
				this.textValue = math.unit('1m').toString();
				this.size = math.unit('1m');
			}
		}

		this.hitArea = new createjs.Shape();
		this.hitArea.graphics.beginFill(this.color).drawRect(-1, -1, this.nodeSize + 2, this.nodeSize + 2);
		this.nodes = [new createjs.Shape(), new createjs.Shape()];
		this.nodes[0].hitArea = this.hitArea;
		this.nodes[1].hitArea = this.hitArea;
		this.nodes[0].regX = this.nodeSize / 2;
		this.nodes[1].regX = this.nodeSize / 2;
		this.nodes[0].regY = this.nodeSize / 2;
		this.nodes[1].regY = this.nodeSize / 2;
		this.styleCommands = { colors: [] };
		this.styleCommands.colors[0] = this.nodes[0].graphics.beginStroke(this.color).command;
		this.styleCommands.colors[1] = this.nodes[1].graphics.beginStroke(this.color).command;
		this.nodes[0].graphics.drawEllipse(0, 0, this.nodeSize, this.nodeSize);
		this.nodes[1].graphics.drawEllipse(0, 0, this.nodeSize, this.nodeSize);
		this.nodes[0].cursor = 'pointer';
		this.nodes[1].cursor = 'pointer';
		const scaled1 = this.project.toUnscaled(x1, y1);
		const scaled2 = this.project.toUnscaled(x2, y2);
		this.nodes[0].x = scaled1.x;
		this.nodes[1].x = scaled2.x;
		this.nodes[0].y = scaled1.y;
		this.nodes[1].y = scaled2.y;

		this.length = Math.sqrt(
			(this.positions[0].y - this.positions[1].y) ** 2 + (this.positions[0].x - this.positions[1].x) ** 2,
		);
		this.line = new createjs.Shape();
		this.line.graphics.setStrokeStyle('2');
		this.styleCommands.colors.push(this.line.graphics.beginStroke(this.color).command);
		this.lineStart = this.line.graphics.moveTo(this.nodes[0].x, this.nodes[0].y).command;
		this.lineEnd = this.line.graphics.lineTo(this.nodes[1].x, this.nodes[1].y).command;
		this.line.graphics.endStroke();

		this.textSizingElement = document.createElement('span');
		this.textSizingElement.innerText = this.textValue;
		this.textSizingElement.classList.add('scale-text');
		const mainContainer = document.getElementById('main-container');
		if (mainContainer) mainContainer.appendChild(this.textSizingElement);
		this.letterWidth = this.textSizingElement.getBoundingClientRect().width / this.textValue.length;
		this.textSizingElement.remove();

		this.textElement = document.createElement('input');
		if (mainContainer) mainContainer.appendChild(this.textElement);
		this.textElement.classList.add('scale-text');
		this.textElement.classList.add('not-editing');
		this.textElement.type = 'text';
		this.textElement.readOnly = true;
		this.textElement.style.border = `2px ${this.color} solid`;
		this.textElement.style.color = this.color;
		this.textElement.style.width = `${this.letterWidth * this.textValue.length}px`;
		this.textElement.value = this.textValue;
		this.text = new createjs.DOMElement(this.textElement);

		this.textHitShape = new createjs.Shape();
		this.textHit = this.textHitShape.graphics.drawRect(
			this.text.x - this.text.regX,
			this.text.y - this.text.regY,
			this.text.offsetWidth,
			this.text.offsetHeight,
		).command;

		this.stage.addChild(this.textHitShape);
		this.stage.addChild(this.text);
		this.stage.addChild(this.line);
		this.stage.addChild(this.nodes[0]);
		this.stage.addChild(this.nodes[1]);

		this.update();
		this.stage.update();
		this.project.update();
		this.textElement.addEventListener('focus', () => {
			if (this.textElement.readOnly) {
				this.textElement.blur();
			}
		});

		['startEditing', 'dblclick'].forEach((value) => {
			this.textElement.addEventListener(value, () => {
				this.textElement.classList.add('editing');
				this.textElement.classList.remove('not-editing');
				this.textElement.readOnly = false;
				this.textElement.value = math.format(this.size).toString();
				this.update();
			});
		});

		['change', 'keypress', 'keyup'].forEach((value) => {
			this.textElement.addEventListener(value, (e) => {
				if ((value !== 'keypress' && value !== 'keyup') || (e as KeyboardEvent).key === '13') {
					this.update(this.textElement.value);
					this.textElement.classList.remove('editing');
					this.textElement.classList.add('not-editing');
					this.textElement.blur();
					this.textElement.readOnly = true;
				} else {
					this.update();
				}
			});
		});
		this.stage.addEventListener('click', (e: createjs.MouseEvent) => {
			const mouseCoords = this.textHitShape.globalToLocal(e.stageX, e.stageY);
			if (mouseCoords.x > this.textElement.offsetWidth) {
				this.update(this.textElement.value);
				this.textElement.classList.remove('editing');
				this.textElement.classList.add('not-editing');
				this.textElement.blur();
				this.textElement.readOnly = true;
			}
		});

		this.nodes[0].addEventListener('pressmove', (e: createjs.MouseEvent) => {
			const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);
			this.nodes[0].x = coords.x;
			this.nodes[0].y = coords.y;

			const scaledCoord = this.project.toScaled(coords);
			this.positions[0] = scaledCoord;

			this.update();
			this.stage.update();
		});
		this.nodes[1].addEventListener('pressmove', (e: createjs.MouseEvent) => {
			const coords = e.target.stage.globalToLocal(e.stageX, e.stageY);
			this.nodes[1].x = coords.x;
			this.nodes[1].y = coords.y;

			const scaledCoord = this.project.toScaled(coords);
			this.positions[1] = scaledCoord;

			this.update();
			this.stage.update();
		});

		this.nodes[0].addEventListener('pressup', () => {
			this.project.update();
			this.project.changed();
		});
		this.nodes[1].addEventListener('pressup', () => {
			this.project.update();
			this.project.changed();
		});
	}

	show(): void {
		const mainContainer = document.getElementById('main-container');
		if (mainContainer) mainContainer.appendChild(this.textElement);
		this.stage.addChild(this.textHitShape);
		this.stage.addChild(this.text);
		this.stage.addChild(this.line);
		this.stage.addChild(this.nodes[0]);
		this.stage.addChild(this.nodes[1]);
		this.update();
	}

	hide(): void {
		this.stage.removeChild(this.textHitShape);
		this.stage.removeChild(this.text);
		this.stage.removeChild(this.line);
		this.stage.removeChild(this.nodes[0]);
		this.stage.removeChild(this.nodes[1]);
		const mainContainer = document.getElementById('main-container');
		if (mainContainer) mainContainer.removeChild(this.textElement);
	}

	updateInfo(data: Record<string, string>): void {
		for (const key in data) {
			switch (key) {
				case 'color':
					this.color = data[key];
					this.textElement.style.color = this.color;
					this.textElement.style.border = `2px ${this.color} solid`;
					for (let i = 0; i < this.styleCommands.colors.length; i++) {
						this.styleCommands.colors[i].style = this.color;
					}
					this.project.changed();
					break;
			}
		}
	}

	unit(): string {
		return this.size.units[0].unit.name;
	}

	/**
	 * Parses a user-entered scale string into a math.js unit value.
	 *
	 * Supports two formats:
	 *   - Simple unit: `"5 m"`, `"2.3 ft"` → parsed directly via `math.unit()`
	 *   - Conversion: `"5 m > cm"` → parsed as `math.unit("5 m").to("cm")`
	 *
	 * @param value - The raw string from the scale text input
	 * @returns The parsed size and display text, or `false` if parsing fails
	 */
	processValue(value: string): ScaleProcessedValue | false {
		const returnData: Partial<ScaleProcessedValue> = {};
		if (value.length > 0) {
			try {
				if (value.split('>').length > 1) {
					const split = value.split('>');
					math.unit(split[0].trim());
					returnData.size = math.unit(split[0].trim()).to(split[split.length - 1].trim());
					returnData.textValue = math.format(returnData.size, { notation: 'auto', precision: 6 }).toString();
				} else {
					returnData.size = math.unit(value);
					returnData.textValue = math.format(math.unit(value), { notation: 'auto', precision: 6 }).toString();
				}
			} catch {
				return false;
			}
		} else {
			return false;
		}
		return returnData as ScaleProcessedValue;
	}

	update(value: string = this.textValue): void {
		if (value !== this.textValue) {
			let valueProcessed = this.processValue(value);

			if (!valueProcessed) {
				valueProcessed = this.processValue(`${value.trim()} m`);
			}

			if (valueProcessed !== false) {
				if (valueProcessed.size.value !== null) {
					const oldInfo = {
						size: this.size,
						textValue: this.textValue,
					};

					this.size = valueProcessed.size;
					this.textValue = valueProcessed.textValue;

					const newInfo = {
						size: this.size,
						textValue: this.textValue,
					};

					if (oldInfo.size.toString() !== newInfo.size.toString()) {
						this.project.change({
							undo: () => {
								this.update(oldInfo.size.toString());
							},
							redo: () => {
								this.update(newInfo.size.toString());
							},
						});
					}
					this.project.update();

					this.textElement.value = this.textValue;
				} else {
					this.textElement.value = this.textValue;
				}
			} else {
				this.textElement.value = this.textValue;
			}
		}

		this.lineStart.x = this.nodes[1].x;
		this.lineStart.y = this.nodes[1].y;
		this.lineEnd.x = this.nodes[0].x;
		this.lineEnd.y = this.nodes[0].y;
		this.length = Math.sqrt(
			(this.positions[0].y - this.positions[1].y) ** 2 + (this.positions[0].x - this.positions[1].x) ** 2,
		);

		this.textElement.style.width = `${this.letterWidth * this.textElement.value.length}px`;

		if (
			(this.nodes[0].x < this.nodes[1].x && this.nodes[0].y < this.nodes[1].y) ||
			(this.nodes[1].x < this.nodes[0].x && this.nodes[1].y < this.nodes[0].y)
		) {
			this.text.regX = 0;
			this.text.regY = this.textElement.offsetHeight;
			this.text.x = this.nodes[1].x + (this.nodes[0].x - this.nodes[1].x) / 2;
			this.text.y = this.nodes[1].y + (this.nodes[0].y - this.nodes[1].y) / 2;
		} else {
			this.text.regX = this.textElement.offsetWidth;
			this.text.regY = this.textElement.offsetHeight;
			this.text.x = this.nodes[1].x + (this.nodes[0].x - this.nodes[1].x) / 2;
			this.text.y = this.nodes[1].y + (this.nodes[0].y - this.nodes[1].y) / 2;
		}

		if (Math.abs((this.nodes[1].y - this.nodes[0].y) / (this.nodes[1].x - this.nodes[0].x)) < 0.4) {
			this.text.regX = this.textElement.offsetWidth * 0.5;
			this.text.regY = this.textElement.offsetHeight;
			this.text.x = this.nodes[1].x + (this.nodes[0].x - this.nodes[1].x) / 2;
			this.text.y = this.nodes[1].y + (this.nodes[0].y - this.nodes[1].y) / 2;
		}

		this.textHit.x = this.text.x - this.text.regX;
		this.textHit.y = this.text.y - this.text.regY;
		this.textHit.w = this.textElement.offsetWidth;
		this.textHit.h = this.textElement.offsetHeight;
		this.stage.update();
	}

	/**
	 * Converts a distance in pixels to real-world units using the scale ratio.
	 *
	 * The conversion factor is `this.size / this.length` (real-world size per pixel
	 * of the scale line). The result is then converted to the requested unit.
	 *
	 * @param pixels - Distance in video pixel coordinates
	 * @param unit - Target unit (defaults to the scale's own unit)
	 * @returns Object with `number` property containing the converted value
	 */
	convert(pixels: number, unit: MathJsUnit = math.unit(this.unit())): { number: number } {
		const scaled = math.multiply(pixels, math.divide(this.size, this.length) as number);
		const mathUnit = math.unit(String(scaled)).to(unit.toString());
		return { number: mathUnit.toNumber(unit.toString()) };
	}
}
