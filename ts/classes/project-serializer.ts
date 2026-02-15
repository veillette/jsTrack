/**
 * ProjectSerializer handles saving and loading project data
 * to/from the .jstrack file format.
 */

import type { Coordinate } from './axes';
import type { Project } from './project';

interface SaveScaleData {
	size: string;
	color: string;
	nodes: [Coordinate, Coordinate];
}

interface SaveAxesData {
	position: { x: number; y: number; rotation: number };
	color: string;
}

interface SaveTrackInfo {
	name: string;
	color: string;
	points: Record<string, Coordinate>;
	hidden: boolean;
}

interface SaveData {
	name: string;
	duration: number;
	video: HTMLVideoElement;
	fps: number;
	currentFrame: number;
	uid: string;
	startFrame: number;
	endFrame: number;
	videoName: string;
	videoSpeed: number;
	scale?: SaveScaleData;
	axes?: SaveAxesData;
	activeTrack?: string;
	tracks?: Record<string, SaveTrackInfo>;
}

interface MetaInfo {
	date: string;
	createdWith: string;
	appVersion: number;
	fileVersion: number;
}

export interface ProjectSaveFile {
	meta: MetaInfo;
	project: SaveData;
}

export interface LoadFileData {
	meta?: { fileVersion: number };
	project?: Record<string, unknown>;
	[key: string]: unknown;
}

export class ProjectSerializer {
	private project: Project;

	constructor(project: Project) {
		this.project = project;
	}

	save(): ProjectSaveFile {
		const metaInfo: MetaInfo = {
			date: new Date().toString(),
			createdWith: 'Created with JSTrack by Luca Demian',
			appVersion: 0.1,
			fileVersion: 0.3,
		};

		const saveData: SaveData = {
			name: this.project.name,
			duration: this.project.timeline.duration,
			video: this.project.timeline.video,
			fps: this.project.timeline.fps,
			currentFrame: this.project.timeline.currentFrame,
			uid: this.project.uid,
			startFrame: this.project.timeline.startFrame,
			endFrame: this.project.timeline.endFrame,
			videoName: this.project.videoName,
			videoSpeed: this.project.videoSpeed,
		};

		if (this.project.scale != null) {
			saveData.scale = {
				size: this.project.scale.size.toString(),
				color: this.project.scale.color,
				nodes: [
					{ x: this.project.scale.positions[0].x, y: this.project.scale.positions[0].y },
					{ x: this.project.scale.positions[1].x, y: this.project.scale.positions[1].y },
				],
			};
		}

		if (this.project.axes != null) {
			saveData.axes = {
				position: { x: this.project.axes.x, y: this.project.axes.y, rotation: this.project.axes.theta },
				color: this.project.axes.color,
			};
		}

		if (this.project.track != null) saveData.activeTrack = this.project.track.uid;

		saveData.tracks = {};
		for (const uid in this.project.trackList) {
			const track = this.project.trackList[uid];
			const trackInfo: SaveTrackInfo = {
				name: track.name,
				color: track.color,
				points: {},
				hidden: track.hidden,
			};

			for (const number in track.points) {
				trackInfo.points[number] = {
					x: track.points[number].x,
					y: track.points[number].y,
				};
			}

			saveData.tracks[uid] = trackInfo;
		}

		return { meta: metaInfo, project: saveData };
	}

	load(fileData: LoadFileData): void {
		let version = 0;
		const fileInfo = fileData.meta;

		let data: Record<string, unknown>;
		if (fileInfo !== undefined) {
			version = fileInfo.fileVersion;
			if (version > 0) {
				data = (fileData.project as Record<string, unknown>) || fileData;
			} else {
				data = fileData as Record<string, unknown>;
			}
		} else {
			data = fileData as Record<string, unknown>;
		}

		if (data.fps !== undefined) {
			this.project.timeline.updateTiming(this.project.timeline.video.duration, data.fps as number);
			if (this.project.timeline.frames.length === 1) {
				this.project.timeline.createFrames();
			}
			this._load(data, version);
		} else {
			this.project.timeline.detectFrameRate((fps: number) => {
				this.project.timeline.updateTiming(this.project.timeline.video.duration, fps);
				if (this.project.timeline.frames.length === 1) {
					this.project.timeline.createFrames();
				}

				this._load(data, version);
			});
		}
	}

	_load(data: Record<string, unknown>, version: number): void {
		for (const key in data) {
			const value = data[key];
			switch (key) {
				case 'name':
					this.project.name = value as string;
					break;
				case 'uid':
					this.project.uid = value as string;
					break;
				case 'videoName':
					this.project.videoName = value as string;
					break;
				case 'videoSpeed':
					this.project.videoSpeed = value as number;
					break;
				case 'currentFrame':
					this.project.timeline.seek(value as number);
					break;
				case 'startFrame':
					this.project.timeline.startFrame = value as number;
					break;
				case 'endFrame':
					this.project.timeline.endFrame = value as number;
					break;
				case 'scale': {
					const scaleData = value as SaveScaleData;
					this.project.newScale(
						scaleData.size,
						scaleData.nodes[0].x,
						scaleData.nodes[0].y,
						scaleData.nodes[1].x,
						scaleData.nodes[1].y,
						scaleData.color,
						true,
					);
					break;
				}
				case 'axes': {
					const axesData = value as SaveAxesData;
					const axes = this.project.newAxes(axesData.position.x, axesData.position.y, axesData.color, true);
					if (version > 0) {
						axes.rotate(axesData.position.rotation);
					}
					break;
				}
				case 'tracks': {
					const tracksData = value as Record<string, SaveTrackInfo>;
					for (const uid in tracksData) {
						const trackInfo = tracksData[uid];
						const track = this.project.newTrack(trackInfo.name, trackInfo.color, false, uid);
						for (const number in trackInfo.points) {
							const frame = this.project.timeline.frames[Number(number)];
							if (frame !== undefined)
								track.addPoint(frame, trackInfo.points[number].x, trackInfo.points[number].y);
						}
						track.unselectAll();
						if (version > 0.2) {
							if (trackInfo.hidden) track.hide();
						}
					}
					break;
				}
			}
			if (data.activeTrack != null) {
				this.project.switchTrack(data.activeTrack as string);
			}
		}

		this.project.updateVisiblePoints();
		this.project.created = true;
		this.project.trigger('created');
		this.project.undoManager.clear();
	}
}
