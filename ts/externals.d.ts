/**
 * Type declarations for external libraries used by trackTS.
 */

// ─── CreateJS (EaselJS) ───

declare namespace createjs {
	class EventDispatcher {
		addEventListener(type: string, listener: (event: MouseEvent) => void): () => void;
		removeEventListener(type: string, listener: (event: MouseEvent) => void): void;
		on(type: string, listener: (event: MouseEvent) => void): () => void;
		dispatchEvent(event: Event | string): boolean;
	}

	interface GraphicsCommand {
		x: number;
		y: number;
		w: number;
		h: number;
		style: string;
		width: number;
	}

	class Graphics {
		beginFill(color: string): Graphics;
		beginStroke(color: string): Graphics;
		endStroke(): Graphics;
		setStrokeStyle(thickness: number | string): Graphics;
		drawRect(x: number, y: number, w: number, h: number): Graphics;
		drawRoundRect(
			x: number,
			y: number,
			w: number,
			h: number,
			r1: number,
			r2: number,
			r3: number,
			r4: number,
		): Graphics;
		drawEllipse(x: number, y: number, w: number, h: number): Graphics;
		moveTo(x: number, y: number): Graphics;
		lineTo(x: number, y: number): Graphics;

		command: GraphicsCommand;
	}

	interface MouseEvent {
		stageX: number;
		stageY: number;
		target: DisplayObject;
		type: string;
		preventDefault(): void;
		preventRepeat?(): void;
	}

	class DisplayObject extends EventDispatcher {
		x: number;
		y: number;
		regX: number;
		regY: number;
		rotation: number;
		scale: number;
		scaleX: number;
		scaleY: number;
		cursor: string;
		visible: boolean;
		hitArea: Shape;
		offsetWidth: number;
		offsetHeight: number;

		globalToLocal(x: number, y: number): { x: number; y: number };
		localToGlobal(x: number, y: number): { x: number; y: number };

		stage: Stage;
	}

	class Shape extends DisplayObject {
		constructor(graphics?: Graphics);
		graphics: Graphics;
	}

	class Bitmap extends DisplayObject {
		constructor(imageOrUri: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | string);
		image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
		w: number;
		h: number;
	}

	class Text extends DisplayObject {
		constructor(text: string, font: string, color: string);
		text: string;
	}

	class DOMElement extends DisplayObject {
		constructor(htmlElement: HTMLElement);
	}

	class Container extends DisplayObject {
		addChild(child: DisplayObject): DisplayObject;
		removeChild(child: DisplayObject): boolean;
		children: DisplayObject[];
	}

	class Stage extends Container {
		constructor(canvasOrId: HTMLCanvasElement | string);
		canvas: HTMLCanvasElement;
		mouseX: number;
		mouseY: number;
		enableMouseOver(frequency?: number): void;
		update(): void;
		_testMouseOver(force?: boolean): void;
	}

	class SpriteSheet {
		constructor(data: {
			images: string[];
			frames: { width: number; height: number };
			animations: Record<string, number>;
		});
	}

	class Sprite extends DisplayObject {
		constructor(spriteSheet: SpriteSheet, frameOrAnimation?: string | number);
		gotoAndStop(frameOrAnimation: string | number): void;
	}

	class ButtonHelper {
		constructor(target: Sprite, outLabel: string, overLabel: string, downLabel: string, hit?: boolean);
		enabled: boolean;
	}

	// biome-ignore lint/complexity/noStaticOnlyClass: external library type stub
	class Ticker {
		static addEventListener(type: string, target: Stage): void;
	}
}

// ─── Google API ───

declare namespace gapi {
	function load(libraries: string, options: { callback: () => void; onerror?: (error: unknown) => void }): void;
	namespace client {
		function setApiKey(key: string): void;
		function load(urlOrObject: string): Promise<void>;
		namespace drive {
			namespace files {
				function get(params: {
					fileId: string;
					fields?: string;
				}): gapi.client.Request<{ id?: string; name?: string; mimeType?: string }>;
			}
		}
		function request<T = unknown>(params: {
			path: string;
			method: string;
			params?: Record<string, string>;
			headers?: Record<string, string | number>;
			body?: Record<string, string>;
		}): gapi.client.Request<T>;
		interface Request<T> {
			then<R>(onFulfilled: (response: { result: T; headers?: Record<string, string> }) => R): Promise<R>;
		}
	}
}

// google.accounts.oauth2 (GIS) - @types/gsi only has accounts.id
declare namespace google.accounts.oauth2 {
	interface TokenClientConfig {
		client_id: string;
		scope: string;
		callback?: (response: TokenResponse) => void;
	}
	interface TokenResponse {
		access_token: string;
		error?: string;
	}
	interface OverridableTokenClientConfig {
		prompt?: 'consent' | '';
	}
	interface TokenClient {
		callback: (response: TokenResponse) => void;
		requestAccessToken(overrideConfig?: OverridableTokenClientConfig): void;
	}
	function initTokenClient(config: TokenClientConfig): TokenClient;
	function revoke(token: string, done?: (response: { successful: boolean; error?: string }) => void): void;
}

declare namespace google {
	namespace picker {
		enum ViewId {
			DOCS,
		}
		enum Action {
			PICKED,
		}
		enum Response {
			ACTION,
			DOCUMENTS,
		}
		enum Document {
			ID,
		}
		enum DocsViewMode {
			LIST,
		}

		interface DocumentObject {
			id?: string;
			name?: string;
			mimeType?: string;
		}

		interface ResponseObject {
			action: Action | string;
			docs?: DocumentObject[];
		}

		class DocsView {
			constructor(viewId: ViewId);
			setMimeTypes(types: string): void;
			setMode(mode: DocsViewMode): void;
		}

		class Picker {
			setVisible(visible: boolean): void;
		}

		class PickerBuilder {
			addView(view: DocsView): PickerBuilder;
			setAppId(appId: string): PickerBuilder;
			setDeveloperKey(key: string): PickerBuilder;
			setOAuthToken(token: string): PickerBuilder;
			setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
			build(): Picker;
			setTitle(title: string): void;
		}
	}
}

interface DriveFile {
	id: string;
	title: string;
	mimeType: string;
}

// ─── Google Analytics ───

declare function gtag(command: string, action: string, params?: Record<string, string>): void;

// ─── KeyboardJS ───

interface KeyboardJSEvent {
	preventRepeat(): void;
	preventDefault(): void;
	key: string;
}

// ─── Interact.js ───

interface InteractEvent {
	target: HTMLElement;
	rect: { width: number; height: number };
}
