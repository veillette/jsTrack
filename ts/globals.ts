/**
 * Shared global state module for trackTS.
 * All modules import from here to access shared state.
 */

import { Modal } from './classes/modal';
import { Project } from './classes/project';
import { Timeline } from './classes/timeline';

// ─── Constants ───

export const EXPORT_FORMATS = [
	'xlsx',
	'xlsm',
	'xlsb',
	'xls',
	'ods',
	'fods',
	'csv',
	'txt',
	'sylk',
	'html',
	'dif',
	'dbf',
	'rtf',
	'prn',
	'eth',
];
export const CUSTOM_EXTENSION = 'trackts';
export const VIDEO_CONVERTOR = 'https://video.online-convert.com/convert-to-mp4';
export const GOOGLE_API_KEY = 'AIzaSyDIijziwMBTuCoKGMXhaVzBzUZibDVwiBM';
export const GOOGLE_CLIENT_ID = '44440188363-5vnafandpsrppr9189u7sc8q755oar9d';

export interface DistanceUnits {
	fullUnits: string[];
	abbreviations: string[];
	unitNames: string[];
	wordPrefixBig: string[];
	abbrPrefixBig: string[];
	wordPrefixSmall: string[];
	abbrPrefixSmall: string[];
}

export const distanceUnits: DistanceUnits = {
	fullUnits: [
		'meter (m)',
		'inch (in)',
		'foot (ft)',
		'yard (yd)',
		'mile (mi)',
		'link (li)',
		'rod (rd)',
		'chain (ch)',
		'angstrom',
		'mil',
	],
	abbreviations: ['m', 'in', 'ft', 'yd', 'mi', 'li', 'rd', 'ch', 'angstrom', 'mil'],
	unitNames: ['meter', 'inch', 'foot', 'yard', 'mile', 'link', 'rod', 'chain', 'angstrom', 'mil'],
	wordPrefixBig: ['deca', 'hecto', 'kilo', 'mega', 'giga', 'tera', 'peta', 'exa', 'zetta', 'yotta'],
	abbrPrefixBig: ['da', 'h', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'],
	wordPrefixSmall: ['deci', 'centi', 'milli', 'micro', 'nano', 'pico', 'femto', 'atto', 'zepto', 'yocto'],
	abbrPrefixSmall: ['d', 'c', 'm', 'u', 'n', 'p', 'f', 'a', 'z', 'y'],
};

// ─── DOM Elements ───

export const sidebar = document.getElementById('sidebar') as HTMLDivElement;
export const videoContainer = document.getElementById('video-container') as HTMLDivElement;
export const canvas = document.getElementById('main') as HTMLCanvasElement;

// ─── Stage & Background ───

export const stage = new createjs.Stage('main');
export const background = new createjs.Bitmap(document.getElementById('video') as HTMLVideoElement);
export const background2 = new createjs.Bitmap(document.getElementById('video-clone') as HTMLVideoElement);
stage.addChild(background2);
stage.addChild(background);

// ─── Master project ───

const tableContainer = document.getElementById('table') as HTMLDivElement;
export const master = new Project(
	'My Project',
	new Timeline(canvas.width, canvas.height, document.getElementById('video') as HTMLVideoElement, 30),
	new Handsontable(tableContainer),
	stage,
	background,
);

master.timeline.video.addEventListener('loadstart', function (this: HTMLVideoElement) {
	const clone = document.getElementById('video-clone') as HTMLVideoElement;
	clone.src = this.src;
	clone.pause();
	clone.style.display = 'none';
});

tableContainer.querySelectorAll('table').forEach((el) => {
	el.id = 'data-table-master';
});

export const video = master.timeline.video;

// ─── Position Text ───

export const posTextBackground = new createjs.Shape();
export const posTextBackgroundCommand = posTextBackground.graphics.beginFill('#000000').drawRect(0, 0, 200, 30).command;
export const posText = new createjs.Text('Frame: 0, X: 0, Y: 0', '13px Arial', '#FFF');
posText.x = 10;
posText.y = canvas.height - 15;
stage.addChild(posTextBackground);
stage.addChild(posText);

stage.enableMouseOver();

createjs.Ticker.addEventListener('tick', stage);
stage.addEventListener('tick', () => {
	if (master.created) master.timeline.update();
});

// ─── Modals ───

export const newProject = new Modal({
	name: 'New Project',
	id: 'new-project-modal',
	fields: {
		name: { label: 'Name', type: 'text', required: true },
		framerate: { label: 'Framerate', type: 'number', required: true, initVal: '30' },
		frameskip: { label: '# of frames to move', type: 'number', required: true, initVal: 1 },
		videospeed: { label: 'Speed of video', type: 'number', required: true, initVal: 1 },
		axesColor: { label: 'Axes Color', type: 'color', defaultValue: '#ff69b4', required: true },
		pointsBackward: { label: 'Points Before Current Time', type: 'number', defaultValue: '7', required: true },
		pointsForward: { label: 'Points Ahead of Current Time', type: 'number', defaultValue: '0', required: true },
	},
	buttons: { submit: { label: 'Create' } },
});

export const saveProject = new Modal({
	name: 'Save Project',
	id: 'save-project-modal',
	fields: {
		filename: { label: 'Filename', type: 'text', required: true },
	},
	buttons: {
		cancel: { label: 'Cancel' },
		saveFile: { label: 'Save as File', image: 'icons/save_file_white.svg' },
		saveDrive: { label: 'Save to Drive', image: 'icons/drive_white.svg' },
	},
});

export const editProject = new Modal({
	name: 'Edit Project',
	id: 'edit-project-modal',
	fields: {
		name: { label: 'Name', type: 'text', required: true },
		frameskip: { label: '# of frames to move', type: 'number', required: true, initVal: 1 },
		axesColor: { label: 'Axes Color', type: 'color', defaultValue: '#ff69b4', required: true },
		pointsBackward: { label: 'Points Before Current Time', type: 'number', defaultValue: '7', required: true },
		pointsForward: { label: 'Points Ahead of Current Time', type: 'number', defaultValue: '0', required: true },
	},
	buttons: { cancel: { label: 'Cancel' }, submit: { label: 'Save' } },
});

export const exportData = new Modal({
	name: 'Export Data',
	id: 'export-modal',
	fields: {
		filename: { label: 'Filename', type: 'text', required: true },
	},
	buttons: { cancel: { label: 'Cancel' }, submit: { label: 'Export' } },
});

export const newScale = new Modal({
	name: 'New Scale',
	id: 'new-scale',
	fields: {
		color: { label: 'Color', type: 'color', required: true },
	},
	buttons: { cancel: { label: 'Cancel' }, submit: { label: 'Create' } },
});

export const editScale = new Modal({
	name: 'Edit Scale',
	id: 'edit-scale',
	fields: {
		color: { label: 'Color', type: 'color', required: true },
	},
	buttons: { cancel: { label: 'Cancel' }, submit: { label: 'Save' } },
});

export const newTrack = new Modal({
	name: 'New Track',
	id: 'new-track',
	fields: {
		name: { label: 'Name', type: 'text', required: true },
		color: { label: 'Color', type: 'color', required: true },
	},
	buttons: { cancel: { label: 'Cancel' }, submit: { label: 'Create' } },
});

export const editTrack = new Modal({
	name: 'Edit Track',
	id: 'edit-track',
	fields: {
		name: { label: 'Name', type: 'text', required: true },
		color: { label: 'Color', type: 'color', required: true },
		uid: { type: 'hidden' },
	},
	buttons: { cancel: { label: 'Cancel' }, submit: { label: 'Save' } },
});

// Wire up Track dblclick → editTrack modal (avoids circular imports)
master.onEditTrack = (data) => editTrack.push(data).show();
