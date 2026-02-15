/**
 * trackTS: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 */

import { master } from './globals';

export const scrubberCanv = document.getElementById('scrubber') as HTMLCanvasElement;
export const scrubber = new createjs.Stage('scrubber');
scrubber.enableMouseOver(10);

export interface ScrubberLine {
	rectShape: createjs.Shape;
	thumbShape: createjs.Shape;
	rect: createjs.GraphicsCommand;
	thumb: createjs.Shape & { rect: createjs.GraphicsCommand };
	startMarker: createjs.Sprite;
	endMarker: createjs.Sprite;
}

const scrubberLineRectShape = new createjs.Shape();
scrubberLineRectShape.graphics.setStrokeStyle(1).beginStroke('#d8d8d8');
const scrubberLineRect = scrubberLineRectShape.graphics.drawRoundRect(
	0,
	(scrubberCanv.height - 10) / 2,
	scrubberCanv.width - 200,
	10,
	3,
	3,
	3,
	3,
).command;
scrubber.addChild(scrubberLineRectShape);

const thumb = new createjs.Shape() as createjs.Shape & { rect: createjs.GraphicsCommand };
thumb.graphics.beginFill('#000');
thumb.regX = 0;
thumb.regY = 0;
thumb.rect = thumb.graphics.drawRoundRect(-2, -5, 4, scrubberLineRect.h, 3, 3, 3, 3).command;
scrubber.addChild(thumb);

const marker = new createjs.SpriteSheet({
	images: ['icons/marker.png'],
	frames: { width: 10, height: 9 },
	animations: { default: 0 },
});

const startMarkerSprite = new createjs.Sprite(marker, 'default');
const endMarkerSprite = new createjs.Sprite(marker, 'default');
startMarkerSprite.regX = 5;
endMarkerSprite.regX = 5;
scrubber.addChild(startMarkerSprite);
scrubber.addChild(endMarkerSprite);

export const scrubberLine = {
	rectShape: scrubberLineRectShape,
	thumbShape: new createjs.Shape(),
	rect: scrubberLineRect,
	thumb: thumb,
	startMarker: startMarkerSprite,
	endMarker: endMarkerSprite,
};

const buttons = new createjs.SpriteSheet({
	images: ['icons/buttons.png'],
	frames: { width: 20, height: 20 },
	animations: {
		frameBack: 0,
		frameBackClicked: 1,
		frameBackDisabled: 2,
		frameForward: 3,
		frameForwardClicked: 4,
		frameForwardDisabled: 5,
	},
});

export interface FrameArrows {
	forward: {
		sprite: createjs.Sprite;
		button: createjs.ButtonHelper;
		enabled: boolean;
	};
	back: {
		sprite: createjs.Sprite;
		button: createjs.ButtonHelper;
		enabled: boolean;
	};
	update(): void;
}

const forwardSprite = new createjs.Sprite(buttons);
const backSprite = new createjs.Sprite(buttons);

export const frameArrows: FrameArrows = {
	forward: {
		sprite: forwardSprite,
		button: new createjs.ButtonHelper(forwardSprite, 'frameForward', 'frameForward', 'frameForwardClicked', false),
		enabled: true,
	},
	back: {
		sprite: backSprite,
		button: new createjs.ButtonHelper(backSprite, 'frameBack', 'frameBack', 'frameBackClicked', false),
		enabled: true,
	},
	update() {
		if (master.timeline.currentFrame === master.timeline.endFrame) {
			frameArrows.forward.sprite.gotoAndStop('frameForwardDisabled');
			frameArrows.forward.button.enabled = false;
			frameArrows.forward.enabled = false;
		} else {
			frameArrows.forward.sprite.gotoAndStop('frameForward');
			frameArrows.forward.button.enabled = true;
			frameArrows.forward.enabled = true;
		}

		if (master.timeline.currentFrame === master.timeline.startFrame) {
			frameArrows.back.sprite.gotoAndStop('frameBackDisabled');
			frameArrows.back.button.enabled = false;
			frameArrows.back.enabled = false;
		} else {
			frameArrows.back.sprite.gotoAndStop('frameBack');
			frameArrows.back.button.enabled = true;
			frameArrows.back.enabled = true;
		}
		scrubber.update();
	},
};

scrubber.addChild(frameArrows.forward.sprite);
scrubber.addChild(frameArrows.back.sprite);
scrubber.update();

export function updateScrubber(time: number, total: number): void {
	scrubberLine.thumb.x = (time / total) * scrubberLine.rect.w + scrubberLine.rect.x;
	scrubberLine.startMarker.x =
		master.timeline.startFrame * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
	scrubberLine.endMarker.x =
		master.timeline.endFrame * (scrubberLine.rect.w / master.timeline.frameCount) + scrubberLine.rect.x;
	scrubber.update();
}
