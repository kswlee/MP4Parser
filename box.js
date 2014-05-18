 /*
 * MP4 System Layer Parser
 *
 * Copyright (c) 2014 Kenny.SW Lee
 * Dual licensed under the MIT licenses.
 *  - http://www.opensource.org/licenses/mit-license.php
 *
 * Author: Kenny.SW Lee <kswlee@gmail.com>
 * Version: 0.0.1
 */

(function() {
"use strict";

function Box(bufferView) {
	if (bufferView === undefined || bufferView === null) {
		this.size = 0;
		this.type = '';
		this.boxes = [];
		return;
	}

	this.size = bufferView.readUint32();
	this.type = bufferView.readBoxTypeString();

	this.boxes = [];

	if (this.type == 'moov' || 
		this.type == 'trak' || 
		this.type == 'mdia' || 
		this.type == 'minf' || 
		this.type == 'dinf' || 
		this.type == 'stbl') {
		var subBufferView = new BufferView(bufferView.buffer, bufferView.getPos(), this.size - 2 * 4);
		Box.parse(subBufferView, this);
	}
}

Box.getBoxType = function(bufferView) {
	bufferView.skip(4); // skip the box size
	var type = bufferView.readBoxTypeString();
	return type;
};

Box.parse = function(bufferView, box) {
	var boxes = [];

	do {
		var size = bufferView.readUint32();
		var type = bufferView.readBoxTypeString();

		var b = Box.createBox(new BufferView(bufferView.buffer, bufferView.getPos() - 2 * 4, size), size, type);
		boxes.push(b);

		box.boxes.push(b);

		bufferView.skip(size - 2 * 4);

		if (bufferView.eob()) {
			break;
		}
	} while (true);

	return boxes;
};

Box.createBox = function(bufferView, size, type, box) {
	var b;
	if (type === 'mvhd') {
		var baseBox = new Box(bufferView);
		var fullBox = new FullBox(bufferView, baseBox);
		var movieHeaderBox = new MovieHeaderBox(bufferView, fullBox);
		b = movieHeaderBox;
	} else if (type === 'tkhd') {
		var baseBox = new Box(bufferView);
		var fullBox = new FullBox(bufferView, baseBox);
		var tkhd = new TrackHeaderBox(bufferView, fullBox);
		b = tkhd;
	} else {
		b = new Box(bufferView);
	}

	return b;
};

function FullBox(bufferView, box) {
	if (box) {
		this.size = box.size;
		this.type = box.type;
	}

	if (bufferView) {
		this.version = bufferView.readUint8();
		this.flags = bufferView.readUint24();
	} else {
		this.version = 0;
		this.flags = 0;
	}
}

FullBox.prototype = new Box();
FullBox.prototype.constructor = FullBox;

function MovieHeaderBox(bufferView, fullBox) {
	if (fullBox) {
		this.size = fullBox.size;
		this.type = fullBox.type;
		this.version = fullBox.version;
		this.flags = fullBox.flags;
	} 

	if (this.version == 1) {
		this.creationTime = bufferView.readUint64();
		this.modificationTime = bufferView.readUint64();
		this.timeScale = bufferView.readUint32();
		this.duration = bufferView.readUint64();
	} else if (this.version == 0) {
		this.creationTime = bufferView.readUint32();
		this.modificationTime = bufferView.readUint32();
		this.timeScale = bufferView.readUint32();
		this.duration = bufferView.readUint32();
	}

	this.timeScale /= 1000;

	this.rate = bufferView.readUint16() + bufferView.readUint16() / 1000;
	this.volume = bufferView.readUint8() + bufferView.readUint8() / 100;
	this.bit = bufferView.readUint16();
	this.reserved0 = bufferView.readUint32();
	this.reserved1 = bufferView.readUint32();

	this.matrix = [];
	for (var i  = 0; i < 9; ++i) {
		this.matrix[i] = bufferView.readUint32();
	}

	this.preDefined = [];
	for (var i  = 0; i < 6; ++i) {
		this.preDefined[i] = bufferView.readUint32();
	}

	this.nextTrackID = bufferView.readUint32();
}

MovieHeaderBox.prototype = new FullBox();
MovieHeaderBox.prototype.constructor = MovieHeaderBox;

function TrackHeaderBox(bufferView, fullBox) {
	if (fullBox) {
		this.size = fullBox.size;
		this.type = fullBox.type;
		this.version = fullBox.version;
		this.flags = fullBox.flags;
	} 

	if (this.version == 1) {
		this.creationTime = bufferView.readUint64();
		this.modificationTime = bufferView.readUint64();
		this.trackID = bufferView.readUint32();
		this.reserved = bufferView.readUint32();
		this.duration = bufferView.readUint64();
	} else if (this.version == 0) {
		this.creationTime = bufferView.readUint32();
		this.modificationTime = bufferView.readUint32();
		this.trackID = bufferView.readUint32();
		this.reserved = bufferView.readUint32();
		this.duration = bufferView.readUint32();
	}

	bufferView.readUint32(); // skip two reserved
	bufferView.readUint32();

	this.layer = bufferView.readUint16();
	this.alternateGroup = bufferView.readUint16();
	this.volume = bufferView.readUint8() + bufferView.readUint8() / 100;

	bufferView.readUint16(); // skip 16bit reserved

	this.matrix = [];
	for (var i  = 0; i < 9; ++i) {
		this.matrix[i] = bufferView.readUint32();
	}

	this.width = bufferView.readUint16() + bufferView.readUint16() / 100;
	this.height = bufferView.readUint16() + bufferView.readUint16() / 100;
}

TrackHeaderBox.prototype = new FullBox();
TrackHeaderBox.prototype.constructor = TrackHeaderBox;

window.Box = Box;
window.FullBox = FullBox;
window.MovieHeaderBox = MovieHeaderBox;
window.TrackHeaderBox = TrackHeaderBox;

})();

