/**
 * Video conversion utilities using @ffmpeg/ffmpeg.
 * Converts non-MP4 videos to MP4 format using WebAssembly.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<boolean> | null = null;

/**
 * Load the FFmpeg WASM module.
 * Uses the single-threaded core to avoid SharedArrayBuffer requirements.
 * Safe to call multiple times - returns cached instance.
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
	if (ffmpeg?.loaded) {
		return ffmpeg;
	}

	if (loadPromise) {
		await loadPromise;
		if (!ffmpeg) {
			throw new Error('FFmpeg failed to load');
		}
		return ffmpeg;
	}

	ffmpeg = new FFmpeg();

	// Use single-threaded core to avoid SharedArrayBuffer/COOP/COEP requirements
	const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

	loadPromise = ffmpeg.load({
		coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
		wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
	});

	await loadPromise;
	return ffmpeg;
}

export interface ConversionProgress {
	progress: number; // 0-1
	time?: number; // Current time in seconds
}

export interface ConversionOptions {
	onProgress?: (progress: ConversionProgress) => void;
	onLog?: (message: string) => void;
}

/**
 * Convert a video file to MP4 format.
 * Uses codec copy when possible for fast conversion.
 *
 * @param inputFile - The input video file
 * @param options - Optional callbacks for progress and logging
 * @returns A new File object containing the MP4 video
 */
export async function convertToMp4(inputFile: File, options: ConversionOptions = {}): Promise<File> {
	const ffmpegInstance = await loadFFmpeg();

	// Set up event listeners
	if (options.onLog) {
		ffmpegInstance.on('log', ({ message }) => {
			options.onLog?.(message);
		});
	}

	if (options.onProgress) {
		ffmpegInstance.on('progress', ({ progress, time }) => {
			options.onProgress?.({ progress, time });
		});
	}

	const inputName = inputFile.name;
	const outputName = 'output.mp4';

	// Write input file to FFmpeg's virtual filesystem
	const inputData = await fetchFile(inputFile);
	await ffmpegInstance.writeFile(inputName, inputData);

	// Run conversion - try codec copy first (fast), fall back to re-encode if needed
	try {
		await ffmpegInstance.exec(['-i', inputName, '-c:v', 'copy', '-c:a', 'copy', outputName]);
	} catch (err) {
		// Codec copy failed; fall back to re-encoding
		console.warn('Codec copy failed, falling back to re-encode:', err);
		await ffmpegInstance.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', outputName]);
	}

	// Read the output file
	const outputData = await ffmpegInstance.readFile(outputName);

	// Clean up
	await ffmpegInstance.deleteFile(inputName);
	await ffmpegInstance.deleteFile(outputName);

	// Create the output file
	const dotIndex = inputName.lastIndexOf('.');
	const baseName = dotIndex !== -1 ? inputName.substring(0, dotIndex) : inputName;

	// Create a new Uint8Array to ensure it's backed by a standard ArrayBuffer
	const uint8Array = new Uint8Array(outputData as Uint8Array);

	return new File([uint8Array], `${baseName}.mp4`, { type: 'video/mp4' });
}

/**
 * Check if FFmpeg is loaded and ready.
 */
export function isFFmpegLoaded(): boolean {
	return ffmpeg?.loaded ?? false;
}
