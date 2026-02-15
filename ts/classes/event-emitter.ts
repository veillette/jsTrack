/**
 * Shared event emitter base class.
 * Provides on/off/trigger with comma-separated event names.
 */

// biome-ignore lint/complexity/noBannedTypes: EventEmitter needs a generic callback type to support diverse callback signatures across subclasses
export type EventCallback = Function;

export class EventEmitter {
	protected _callbacks: Record<string, EventCallback[]> = {};

	on(events: string, callback: EventCallback): this {
		for (const event of events.split(',')) {
			const name = event.trim();
			if (!this._callbacks[name]) {
				this._callbacks[name] = [];
			}
			this._callbacks[name].push(callback);
		}
		return this;
	}

	off(events: string, callback: EventCallback): this {
		for (const event of events.split(',')) {
			const name = event.trim();
			const cbs = this._callbacks[name];
			if (cbs) {
				const idx = cbs.indexOf(callback);
				if (idx !== -1) cbs.splice(idx, 1);
			}
		}
		return this;
	}

	trigger(events: string, ...args: unknown[]): this {
		for (const event of events.split(',')) {
			const name = event.trim();
			const cbs = this._callbacks[name];
			if (cbs) {
				for (let i = 0; i < cbs.length; i++) {
					cbs[i].call(this, ...args);
				}
			}
		}
		return this;
	}
}
