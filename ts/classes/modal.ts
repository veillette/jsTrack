/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

export interface ModalSelectOption {
	label: string;
	value: string;
}

export interface ModalFieldSchema {
	label?: string;
	type: string;
	required?: boolean;
	initVal?: string | number;
	defaultValue?: string | number;
	id?: string;
	element?: HTMLDivElement;
	options?: ModalSelectOption[];
}

export interface ModalButtonSchema {
	label: string;
	image?: string;
}

export interface ModalSchema {
	name: string;
	id: string;
	fields: Record<string, ModalFieldSchema>;
	buttons: Record<string, ModalButtonSchema>;
	text?: string[];
}

import { type EventCallback, EventEmitter } from './event-emitter';

export type ModalExportData = Record<string, string> | false;

let confirmCounter = 0;

/**
 * Shows a non-blocking confirmation dialog using the Modal system.
 * Replaces native `confirm()` which blocks the main thread.
 */
export function confirmModal(message: string, title = 'Confirm'): Promise<boolean> {
	return new Promise((resolve) => {
		const id = `confirm-modal-${++confirmCounter}`;
		const modal = new Modal({
			name: title,
			id,
			fields: {},
			buttons: { cancel: { label: 'Cancel' }, confirm: { label: 'OK' } },
			text: [message],
		});
		const cleanup = () => {
			modal.hide();
			modal.element?.remove();
		};
		modal.on('confirm', () => {
			cleanup();
			resolve(true);
		});
		modal.on('cancel', () => {
			cleanup();
			resolve(false);
		});
		modal.show();
	});
}

/**
 * Shows a non-blocking alert dialog using the Modal system.
 * Replaces native `alert()` which blocks the main thread.
 */
export function alertModal(message: string, title = 'Alert'): Promise<void> {
	return new Promise((resolve) => {
		const id = `alert-modal-${++confirmCounter}`;
		const modal = new Modal({
			name: title,
			id,
			fields: {},
			buttons: { ok: { label: 'OK' } },
			text: [message],
		});
		modal.on('ok', () => {
			modal.hide();
			modal.element?.remove();
			resolve();
		});
		modal.show();
	});
}

export class Modal extends EventEmitter {
	name: string;
	id: string;
	fields: Record<string, ModalFieldSchema>;
	buttons: Record<string, ModalButtonSchema>;
	text: string[] | undefined;
	created: boolean;
	defaultColors: string[];
	element!: HTMLDivElement;
	textContainer!: HTMLDivElement;

	constructor(schema: ModalSchema, create = true) {
		super();
		this.name = schema.name;
		this.id = schema.id;
		this.fields = schema.fields;
		this.buttons = schema.buttons;
		this.text = schema.text;
		this.created = false;
		this.defaultColors = [
			'#FFFF00',
			'#FFFF33',
			'#F2EA02',
			'#E6FB04',
			'#FF0000',
			'#FD1C03',
			'#FF3300',
			'#FF6600',
			'#00FF00',
			'#00FF33',
			'#00FF66',
			'#33FF00',
			'#00FFFF',
			'#099FFF',
			'#0062FF',
			'#0033FF',
			'#FF00FF',
			'#FF00CC',
			'#FF0099',
			'#CC00FF',
			'#9D00FF',
			'#6E0DD0',
			'#9900FF',
		];

		if (create) {
			this.create();
		}
	}

	override on(event: string, callback: EventCallback): this {
		super.on(event, callback);

		// If subscribing to 'create' after the modal is already created, fire immediately
		for (const e of event.split(',')) {
			if (e.trim() === 'create' && this.created) {
				callback.call(this, this.export());
			}
		}
		return this;
	}

	show(): this {
		const container = document.getElementById('modal-container');
		const element = document.getElementById(this.id);
		if (container) container.classList.add('active');
		if (element) element.classList.add('active');
		return this;
	}

	hide(): this {
		if ([...document.querySelectorAll('.modal.active')].length <= 1) {
			const container = document.getElementById('modal-container');
			if (container) container.classList.remove('active');
		}
		const element = document.getElementById(this.id);
		if (element) element.classList.remove('active');
		return this;
	}

	create(show = false): this {
		const titleElement = document.createElement('div');
		titleElement.classList.add('modal-title');
		titleElement.innerText = this.name;

		this.element = document.createElement('div');
		this.element.classList.add('modal');
		this.element.id = this.id;
		this.element.appendChild(titleElement);

		for (const field in this.fields) {
			const formItem = document.createElement('div');
			formItem.classList.add('form-item');
			formItem.setAttribute('data-key', field);
			const formInputId = `${this.id}_input-${field}`;
			this.fields[field].id = formInputId;
			this.fields[field].element = formItem;

			if (this.fields[field].defaultValue !== undefined && this.fields[field].initVal === undefined) {
				this.fields[field].initVal = this.fields[field].defaultValue;
			}

			if (this.fields[field].initVal === undefined) {
				if (this.fields[field].type === 'color') {
					this.fields[field].initVal =
						this.defaultColors[Math.floor(Math.random() * this.defaultColors.length)];
				} else {
					this.fields[field].initVal = '';
				}
			}

			let formInputElement: HTMLInputElement | HTMLSelectElement;

			if (this.fields[field].type === 'select' && this.fields[field].options) {
				const selectEl = document.createElement('select');
				selectEl.name = formInputId;
				selectEl.id = formInputId;
				selectEl.setAttribute('data-key', field);
				const fieldOptions = this.fields[field].options;
				if (fieldOptions) {
					for (const opt of fieldOptions) {
						const optionEl = document.createElement('option');
						optionEl.value = opt.value;
						optionEl.textContent = opt.label;
						selectEl.appendChild(optionEl);
					}
				}
				formInputElement = selectEl;
			} else {
				const inputEl = document.createElement('input');
				inputEl.type = this.fields[field].type;
				inputEl.name = formInputId;
				inputEl.id = formInputId;
				inputEl.setAttribute('data-key', field);
				formInputElement = inputEl;
			}

			formInputElement.value = String(this.fields[field].initVal);

			if (this.fields[field].type !== 'hidden') {
				const formItemLabel = document.createElement('label');
				formItemLabel.innerText = `${this.fields[field].label || field}:`;
				formItemLabel.htmlFor = formInputId;
				formItem.appendChild(formItemLabel);
			}

			formItem.appendChild(formInputElement);
			this.element.appendChild(formItem);
		}

		if (this.text !== undefined) {
			this.textContainer = document.createElement('div');
			for (let i = 0; i < this.text.length; i++) {
				const paragraph = document.createElement('p');
				paragraph.innerHTML = this.text[i];
				this.textContainer.appendChild(paragraph);
			}
			this.element.appendChild(this.textContainer);
		}

		const buttonContainer = document.createElement('div');
		buttonContainer.classList.add('form-buttons');

		for (const button in this.buttons) {
			const buttonItem = document.createElement('button');
			buttonItem.type = 'button';
			buttonItem.id = `${this.id}_button-${button}`;
			if (this.buttons[button].image !== undefined) {
				buttonItem.title = this.buttons[button].label;
				buttonItem.style.backgroundImage = `url('${this.buttons[button].image}')`;
			} else {
				buttonItem.innerText = this.buttons[button].label;
			}
			const buttonTemp = button;
			buttonItem.addEventListener('click', () => {
				this.trigger(buttonTemp);
			});
			buttonContainer.appendChild(buttonItem);
		}
		this.element.appendChild(buttonContainer);

		const modalContainer = document.getElementById('modal-container');
		if (modalContainer) modalContainer.appendChild(this.element);

		this.created = true;
		this.trigger('create');

		if (show) this.show();

		return this;
	}

	override trigger(event: string): this {
		return super.trigger(event, this.export());
	}

	export(): ModalExportData {
		const exportData: Record<string, string> = {};
		for (const field in this.fields) {
			const fieldId = this.fields[field].id;
			if (!fieldId) return false;
			const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
			if (el && el.value.length > 0) {
				exportData[field] = el.value;
			} else {
				return false;
			}
		}
		return exportData;
	}

	clear(): this {
		for (const field in this.fields) {
			if (this.fields[field].initVal === undefined) this.fields[field].initVal = '';

			const fieldId = this.fields[field].id;
			if (fieldId) {
				const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
				if (el) el.value = String(this.fields[field].initVal);
			}
		}
		return this;
	}

	/** Updates the text content of the modal (creating the container if needed). */
	setText(lines: string[]): this {
		if (!this.textContainer) {
			this.textContainer = document.createElement('div');
			// Insert before the button container
			const buttons = this.element.querySelector('.form-buttons');
			if (buttons) {
				this.element.insertBefore(this.textContainer, buttons);
			} else {
				this.element.appendChild(this.textContainer);
			}
		}
		this.textContainer.innerHTML = '';
		for (const line of lines) {
			const paragraph = document.createElement('p');
			paragraph.innerHTML = line;
			this.textContainer.appendChild(paragraph);
		}
		return this;
	}

	push(value: Record<string, string>): this {
		for (const field in value) {
			if (this.fields[field] !== undefined) {
				const fieldId = this.fields[field].id;
				if (fieldId) {
					const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
					if (el) {
						el.value = value[field];
					}
				}
			}
		}
		return this;
	}
}
