/**
 * Webcam modal event handlers.
 * Manages webcam recording workflow: permission, preview, recording, review.
 */

import { generateProjectName, hideLoader, showLoader } from './functions';
import { master, newProject, webcamModal, webcamReviewModal } from './globals';
import { hideLaunchModal, loadVideo } from './load';
import { fixWebmDuration, WebcamRecorder } from './webcam';

// ─── State ───

const recorder = new WebcamRecorder();
let recordingStartTime = 0;
let recordingTimerInterval: ReturnType<typeof setInterval> | null = null;
let recordedBlob: Blob | null = null;

// ─── DOM Elements ───

const modalContainer = document.getElementById('modal-container') as HTMLDivElement;
const webcamButton = document.getElementById('webcam-record-button') as HTMLButtonElement;
const cameraSelect = document.getElementById('camera-select') as HTMLSelectElement;
const previewVideo = document.getElementById('webcam-preview') as HTMLVideoElement;
const recordingIndicator = document.querySelector('.webcam-recording-indicator') as HTMLDivElement;
const recordingTimeDisplay = document.querySelector('.recording-time') as HTMLSpanElement;
const webcamStatus = document.querySelector('.webcam-status') as HTMLDivElement;
const cancelButton = document.getElementById('webcam-cancel') as HTMLButtonElement;
const actionButton = document.getElementById('webcam-action') as HTMLButtonElement;

// Review modal elements
const reviewVideo = document.getElementById('webcam-review-video') as HTMLVideoElement;
const rerecordButton = document.getElementById('webcam-rerecord') as HTMLButtonElement;
const useVideoButton = document.getElementById('webcam-use-video') as HTMLButtonElement;

// ─── Helper Functions ───

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showModal(modal: HTMLDivElement): void {
	// Hide all other modals first
	for (const m of document.querySelectorAll('.modal.active')) {
		m.classList.remove('active');
	}
	modalContainer.classList.add('active');
	modal.classList.add('active');
}

function hideAllModals(): void {
	for (const m of document.querySelectorAll('.modal.active')) {
		m.classList.remove('active');
	}
	modalContainer.classList.remove('active');
}

function setStatus(message: string, isError = false): void {
	webcamStatus.textContent = message;
	webcamStatus.classList.toggle('error', isError);
}

function setStatusLoading(message: string): void {
	webcamStatus.innerHTML = `<div class="spinner"></div>${message}`;
	webcamStatus.classList.remove('error');
}

function clearStatus(): void {
	webcamStatus.textContent = '';
	webcamStatus.classList.remove('error');
}

async function populateCameraList(): Promise<void> {
	const cameras = await recorder.getAvailableCameras();
	cameraSelect.innerHTML = '';

	if (cameras.length === 0) {
		const option = document.createElement('option');
		option.value = '';
		option.textContent = 'No cameras found';
		cameraSelect.appendChild(option);
		return;
	}

	cameras.forEach((camera, index) => {
		const option = document.createElement('option');
		option.value = camera.deviceId;
		option.textContent = camera.label || `Camera ${index + 1}`;
		cameraSelect.appendChild(option);
	});
}

function startRecordingTimer(): void {
	recordingStartTime = Date.now();
	recordingTimeDisplay.textContent = '00:00';
	recordingIndicator.classList.remove('hidden');

	recordingTimerInterval = setInterval(() => {
		const elapsed = (Date.now() - recordingStartTime) / 1000;
		recordingTimeDisplay.textContent = formatTime(elapsed);
	}, 1000);
}

function stopRecordingTimer(): void {
	if (recordingTimerInterval) {
		clearInterval(recordingTimerInterval);
		recordingTimerInterval = null;
	}
	recordingIndicator.classList.add('hidden');
}

function setActionButtonState(state: 'start' | 'stop'): void {
	if (state === 'start') {
		actionButton.textContent = 'Start Recording';
		actionButton.classList.remove('recording');
	} else {
		actionButton.textContent = 'Stop Recording';
		actionButton.classList.add('recording');
	}
}

// ─── Modal Flow Functions ───

async function openWebcamModal(): Promise<void> {
	showModal(webcamModal);
	setStatusLoading('Requesting camera access...');
	setActionButtonState('start');
	actionButton.disabled = true;

	const hasPermission = await recorder.requestPermission();

	if (!hasPermission) {
		setStatus('Camera access denied. Please allow camera access in your browser settings.', true);
		webcamStatus.innerHTML = `
			<div class="webcam-permission-denied">
				<h3>Camera Access Denied</h3>
				<p>Please allow camera access in your browser settings to record video.</p>
				<p>You can also <span class="fallback-link" id="fallback-to-file">load a video file instead</span>.</p>
			</div>
		`;

		const fallbackLink = document.getElementById('fallback-to-file');
		if (fallbackLink) {
			fallbackLink.addEventListener('click', () => {
				closeWebcamModal();
			});
		}
		return;
	}

	await populateCameraList();

	try {
		await recorder.startPreview(previewVideo, cameraSelect.value || undefined);
		clearStatus();
		actionButton.disabled = false;
	} catch (err) {
		console.error('Failed to start preview:', err);
		setStatus('Failed to start camera preview. Please try again.', true);
	}
}

function closeWebcamModal(): void {
	recorder.cleanup();
	stopRecordingTimer();
	hideAllModals();
}

async function startRecording(): Promise<void> {
	try {
		recorder.startRecording();
		startRecordingTimer();
		setActionButtonState('stop');
	} catch (err) {
		console.error('Failed to start recording:', err);
		setStatus('Failed to start recording. Please try again.', true);
	}
}

async function stopRecording(): Promise<void> {
	stopRecordingTimer();
	setStatusLoading('Processing recording...');
	actionButton.disabled = true;

	try {
		recordedBlob = await recorder.stopRecording();
		recorder.stopPreview();
		clearStatus();

		// Show review modal
		showReviewModal();
	} catch (err) {
		console.error('Failed to stop recording:', err);
		setStatus('Failed to process recording. Please try again.', true);
		setActionButtonState('start');
		actionButton.disabled = false;
	}
}

function showReviewModal(): void {
	if (!recordedBlob) return;

	showModal(webcamReviewModal);
	reviewVideo.src = URL.createObjectURL(recordedBlob);
}

async function useRecordedVideo(): Promise<void> {
	if (!recordedBlob) return;

	showLoader();
	showModal(webcamModal);
	setStatusLoading('Processing video...');

	try {
		// Fix WebM duration (MediaRecorder creates WebM with Infinity duration)
		let videoDuration = 0;
		let processedBlob = recordedBlob;
		if (recordedBlob.type.includes('webm')) {
			setStatusLoading('Fixing video metadata...');
			const fixed = await fixWebmDuration(recordedBlob);
			processedBlob = fixed.blob;
			videoDuration = fixed.duration;
		}

		// Create a File from the blob
		const extension = processedBlob.type.includes('mp4') ? 'mp4' : 'webm';
		const videoFile = new File([processedBlob], `recording.${extension}`, { type: processedBlob.type });

		setStatusLoading('Loading video...');

		// Load the video into the project
		loadVideo(videoFile, () => {
			// For webcam recordings, use 30fps default and the pre-calculated duration
			// This avoids issues with WebM duration detection
			const framerate = 30;

			// Store the known duration for use in updateTiming
			if (videoDuration > 0) {
				master.timeline.knownDuration = videoDuration;
			}

			hideLoader();
			webcamModal.classList.remove('active');
			modalContainer.classList.remove('active');
			hideLaunchModal();
			newProject.push({ name: generateProjectName(), framerate: String(framerate) }).show();
		});

		// Clean up
		recordedBlob = null;
		URL.revokeObjectURL(reviewVideo.src);
		reviewVideo.src = '';
		recorder.cleanup();
	} catch (err) {
		console.error('Failed to process video:', err);
		hideLoader();
		setStatus('Failed to process video. Please try again.', true);
		showModal(webcamReviewModal);
	}
}

async function rerecord(): Promise<void> {
	// Clean up previous recording
	if (recordedBlob) {
		URL.revokeObjectURL(reviewVideo.src);
		reviewVideo.src = '';
		recordedBlob = null;
	}

	// Go back to webcam modal
	showModal(webcamModal);
	setActionButtonState('start');
	actionButton.disabled = true;
	clearStatus();

	try {
		await recorder.startPreview(previewVideo, cameraSelect.value || undefined);
		actionButton.disabled = false;
	} catch (err) {
		console.error('Failed to restart preview:', err);
		setStatus('Failed to restart camera. Please try again.', true);
	}
}

// ─── Event Listeners ───

// Open webcam modal when button is clicked
if (webcamButton) {
	webcamButton.addEventListener('click', openWebcamModal);
}

// Camera selection change
if (cameraSelect) {
	cameraSelect.addEventListener('change', async () => {
		if (recorder.isRecording()) return;

		try {
			await recorder.startPreview(previewVideo, cameraSelect.value || undefined);
		} catch (err) {
			console.error('Failed to switch camera:', err);
			setStatus('Failed to switch camera.', true);
		}
	});
}

// Cancel button
if (cancelButton) {
	cancelButton.addEventListener('click', closeWebcamModal);
}

// Action button (start/stop recording)
if (actionButton) {
	actionButton.addEventListener('click', () => {
		if (recorder.isRecording()) {
			stopRecording();
		} else {
			startRecording();
		}
	});
}

// Review modal: Re-record button
if (rerecordButton) {
	rerecordButton.addEventListener('click', rerecord);
}

// Review modal: Use Video button
if (useVideoButton) {
	useVideoButton.addEventListener('click', useRecordedVideo);
}
