/**
 * Minimal type declarations for OpenCV.js (4.x).
 * Only the APIs used by the auto-tracking feature are declared here.
 */

declare namespace cv {
	class Mat {
		rows: number;
		cols: number;
		data: Uint8Array;
		data32S: Int32Array;
		data32F: Float32Array;
		data64F: Float64Array;

		constructor();
		constructor(rows: number, cols: number, type: number);
		constructor(rows: number, cols: number, type: number, scalar: Scalar);

		delete(): void;
		clone(): Mat;
		roi(rect: Rect): Mat;
		isContinuous(): boolean;
		type(): number;
		channels(): number;
		size(): Size;

		static zeros(rows: number, cols: number, type: number): Mat;
		static ones(rows: number, cols: number, type: number): Mat;
	}

	class Size {
		width: number;
		height: number;
		constructor(width: number, height: number);
	}

	class Point {
		x: number;
		y: number;
		constructor(x: number, y: number);
	}

	class Rect {
		x: number;
		y: number;
		width: number;
		height: number;
		constructor(x: number, y: number, width: number, height: number);
	}

	type Scalar = [number, number, number, number];

	class MatVector {
		constructor();
		push_back(mat: Mat): void;
		get(index: number): Mat;
		size(): number;
		delete(): void;
	}

	interface MinMaxLocResult {
		minVal: number;
		maxVal: number;
		minLoc: Point;
		maxLoc: Point;
	}

	// Image processing
	function cvtColor(src: Mat, dst: Mat, code: number): void;
	function matchTemplate(image: Mat, templ: Mat, result: Mat, method: number): void;
	function minMaxLoc(src: Mat): MinMaxLocResult;

	// Optical flow
	function calcOpticalFlowPyrLK(
		prevImg: Mat,
		nextImg: Mat,
		prevPts: Mat,
		nextPts: Mat,
		status: Mat,
		err: Mat,
		winSize?: Size,
		maxLevel?: number,
	): void;
	function goodFeaturesToTrack(
		image: Mat,
		corners: Mat,
		maxCorners: number,
		qualityLevel: number,
		minDistance: number,
		mask?: Mat,
		blockSize?: number,
	): void;

	// Mat creation from data
	function matFromImageData(imageData: ImageData): Mat;

	// Constants
	const COLOR_RGBA2GRAY: number;
	const CV_8UC1: number;
	const CV_32FC1: number;
	const CV_32FC2: number;
	const TM_CCOEFF_NORMED: number;

	// Runtime
	function onRuntimeInitialized(): void;
}
