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

// ─── math.js ───

interface MathJsUnit {
	value: number | null;
	units: Array<{ unit: { name: string } }>;
	toString(): string;
	toNumber(unit: MathJsUnit | string): number;
	to(unit: string): MathJsUnit;
}

interface MathJsStatic {
	unit(expression: string): MathJsUnit;
	multiply(a: number, b: MathJsUnit | number): MathJsUnit | number;
	divide(a: MathJsUnit | number, b: number): MathJsUnit | number;
	format(value: MathJsUnit, options?: { notation?: string; precision?: number }): string;
}

declare const math: MathJsStatic;

// ─── Handsontable ───

interface HandsontableSettings {
	readOnly?: boolean;
	autoColumnSize?: boolean;
	manualColumnResize?: boolean;
	manualColumnMove?: boolean;
	tableClassName?: string;
	rowHeaders?: boolean;
	colHeaders?: boolean;
	startRows?: number;
	fixedColsLeft?: number;
	preventOverflow?: string;
	type?: string;
	stretchH?: string;
	columns?: Array<{ title: string; type: string }>;
	data?: Array<Array<number | string | null> | null>;
}

declare class Handsontable {
	constructor(element: HTMLElement | null, settings?: HandsontableSettings);
	updateSettings(settings: HandsontableSettings): void;
	loadData(data: Array<Array<number | string | null> | null>): void;
	render(): void;
	destroy(): void;
}

// ─── JSZip ───

interface JSZipObject {
	async(type: 'text'): Promise<string>;
	async(type: 'blob'): Promise<Blob>;
	async(type: 'arraybuffer'): Promise<ArrayBuffer>;
}

interface JSZipFiles {
	[key: string]: JSZipObject | undefined;
}

declare class JSZip {
	files: JSZipFiles;
	file(name: string): JSZipObject;
	file(name: string, data: string | ArrayBuffer | Uint8Array | Blob, options?: { binary?: boolean }): JSZip;
	generateAsync(options: { type: 'blob'; mimeType?: string }): Promise<Blob>;
	generateAsync(options: { type: 'arraybuffer'; mimeType?: string }): Promise<ArrayBuffer>;
	static loadAsync(data: ArrayBuffer | Uint8Array | Blob): Promise<JSZip>;
}

declare namespace JSZipUtils {
	function getBinaryContent(url: string, callback: (err: Error | null, data: ArrayBuffer) => void): void;
}

// ─── FileSaver ───

declare function saveAs(blob: Blob, filename: string): void;

// ─── XLSX (SheetJS) ───

declare namespace XLSX {
	interface WorkBook {
		SheetNames: string[];
		Sheets: Record<string, WorkSheet>;
	}
	// biome-ignore lint/complexity/noBannedTypes: opaque type for external library
	type WorkSheet = {};

	namespace utils {
		function book_new(): WorkBook;
		function aoa_to_sheet(data: Array<Array<string | number>>): WorkSheet;
		function book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name: string): void;
	}

	function writeFile(workbook: WorkBook, filename: string): void;
}

// ─── interact.js ───

interface InteractResizableOptions {
	edges?: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
	restrictEdges?: { outer?: string; endOnly?: boolean };
	restrictSize?: { min?: { width?: number; height?: number }; max?: { width?: number; height?: number } };
	inertia?: boolean;
}

interface InteractEvent {
	target: HTMLElement;
	rect: { width: number; height: number };
}

interface InteractInstance {
	resizable(options: InteractResizableOptions): InteractInstance;
	on(event: string, listener: (event: InteractEvent) => void): InteractInstance;
}

declare function interact(target: string | HTMLElement): InteractInstance;

// ─── Dragula ───

interface DragulaInstance {
	dragging: boolean;
	on(event: string, listener: (el: HTMLElement, ...args: unknown[]) => void): DragulaInstance;
}

interface DragulaOptions {
	direction?: string;
	moves?: (el: HTMLElement, source: HTMLElement, handle: HTMLElement, sibling: HTMLElement | null) => boolean;
}

declare function dragula(containers: HTMLElement[], options?: DragulaOptions): DragulaInstance;

// ─── UndoManager ───

declare class UndoManager {
	add(command: { undo: () => void; redo: () => void }): void;
	undo(): void;
	redo(): void;
	clear(): void;
	hasUndo(): boolean;
	hasRedo(): boolean;
	getIndex(): number;
}

// ─── keyboardJS ───

interface KeyboardJSEvent {
	key: string;
	preventDefault(): void;
	preventRepeat(): void;
}

declare namespace keyboardJS {
	function on(
		keys: string | string[],
		pressHandler: (e: KeyboardJSEvent) => void,
		releaseHandler?: (e?: KeyboardJSEvent) => void,
	): void;
	function pause(): void;
	function resume(): void;
}

// ─── Color Picker (CP) ───

declare class CP {
	constructor(target: HTMLInputElement);
	target: HTMLInputElement;
	on(event: string, callback: (this: CP, color: string) => void): void;
	set(color: string): void;
}

// ─── Platform.js ───

interface PlatformInfo {
	name: string;
	version: string;
	os: { family: string };
}

declare const platform: PlatformInfo;

// ─── Google API ───

declare namespace gapi {
	namespace auth {
		function getToken(): { access_token: string } | null;
		function authorize(
			params: {
				client_id: string;
				scope: string;
				immediate: boolean;
				authuser?: number;
			},
			callback?: () => void,
		): void;
		function signOut(): void;
	}
	namespace client {
		function setApiKey(key: string): void;
		function load(api: string, version: string, callback: () => void): void;
		namespace drive {
			namespace files {
				function get(params: { fileId: string }): { execute: (callback: (file: DriveFile) => void) => void };
			}
		}
		function request(params: {
			path: string;
			method: string;
			params?: Record<string, string>;
			headers?: Record<string, string | number>;
			body?: Record<string, string>;
		}): { then: (callback: (response: { headers: { location: string } }) => void) => void };
	}
}

declare namespace google {
	function load(api: string, version: string, options: { callback: () => void }): void;
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

		class DocsView {
			constructor(viewId: ViewId);
			setMimeTypes(types: string): void;
			setMode(mode: DocsViewMode): void;
		}

		class PickerBuilder {
			addView(view: DocsView): PickerBuilder;
			setAppId(appId: string): PickerBuilder;
			setOAuthToken(token: string): PickerBuilder;
			setCallback(callback: (data: Record<string, unknown>) => void): PickerBuilder;
			build(): PickerBuilder;
			setVisible(visible: boolean): PickerBuilder;
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
