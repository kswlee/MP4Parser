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

function MP4(blob /* Uint8Buffer */) {
	this.data = blob;
	this.rootBox = new Box();
	this.rootBox.type = 'isom';
}

MP4.prototype.parse = function() {
	var bufferView = new BufferView(this.data, 0, this.data.length);
	Box.parse(bufferView, this.rootBox);
};

MP4.prototype.getDuration = function() {
	var mvhd = _getMovieHeaderBox(this.rootBox);
	var duration = mvhd.duration / mvhd.timeScale;
	return duration;
};

MP4.prototype.getTrackCount = function() {
	var moov = _getMovieBox(this.rootBox);

	var count = 0;
	for (var i = 0; i < moov.boxes.length; ++i) {
		if (moov.boxes[i].type === 'trak') {
			count++;
		}
	}

	return count;
};

MP4.prototype.getTrackType = function(trackIndex) {
	var moov = _getMovieBox(this.rootBox);
	var tkhd = null;
	var curTrak = 0;
	for (var i = 0; i < moov.boxes.length; ++i) {
		if (moov.boxes[i].type === 'trak') {
			if (curTrak == trackIndex) {
				tkhd = _getBox(moov.boxes[i], 'tkhd');
				break;
			}

			curTrak++;
		}
	}

	return (tkhd.volume == 1)? 'Audio' : 'Video';
};

MP4.prototype.getResolution = function() {
	var moov = _getMovieBox(this.rootBox);
	var tkhd = null;
	var curTrak = 0;
	for (var i = 0; i < moov.boxes.length; ++i) {
		if (moov.boxes[i].type === 'trak') {
			tkhd = _getBox(moov.boxes[i], 'tkhd');
			if (tkhd.volume == 0) {
				break;
			}
		}
	}

	return [tkhd.width, tkhd.height];
};

MP4.prototype.getVolume = function() {
	var moov = _getMovieBox(this.rootBox);
	var tkhd = null;
	var curTrak = 0;
	for (var i = 0; i < moov.boxes.length; ++i) {
		if (moov.boxes[i].type === 'trak') {
			tkhd = _getBox(moov.boxes[i], 'tkhd');
			if (tkhd.volume == 1) {
				break;
			}
		}
	}

	return tkhd.volume;
};

// Private functions
function _getBox(box, type) {
	var queueBox = [];
	for (var i = 0; i < box.boxes.length; ++i) {
		if (box.boxes[i].type === type) {
			return box.boxes[i];
		}

		if (box.boxes[i].boxes.length > 0) {
			queueBox.push(box.boxes[i]);
		}
	}

	for (var i = 0; i < queueBox.length; ++i) {
		return _getBox(queueBox[i], type);
	}
};

function _getMovieHeaderBox(box) {
	var mvhd = _getBox(box, 'mvhd');
	return mvhd;
};

function _getMovieBox(box) {
	var moov = _getBox(box, 'moov');
	return moov;
};

// Export 
window.MP4 = MP4;

})();
