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

function BufferView(buffer, offset, size) {
	this.buffer = buffer;
	this.offset = offset;
	this.size = size;
	this.pos = 0;

	this.peekUint32 = function(offset) {
		var pos = this.pos + offset;
		var bit0 = buffer[this.offset + pos++];
		var bit1 = buffer[this.offset + pos++];
		var bit2 = buffer[this.offset + pos++];
		var bit3 = buffer[this.offset + pos++];

		bit0 = bit0 << 24; bit1 = bit1 << 16; bit2 = bit2 << 8; 
		return bit0 + bit1 + bit2 + bit3;
	};	

	this.peekBoxTypeString = function(offset) {
		var pos = this.pos + offset + 4; // offset the size of 4bytes
		var chars = [];

		var typeString = "";
		for (var i = 0; i < 4; ++i) {
			chars[i] = buffer[this.offset + pos++];
			typeString += String.fromCharCode(chars[i]);
		}		

		return typeString;
	};	

	this.readUint32 = function() {
		var bit0 = buffer[this.offset + this.pos++];
		var bit1 = buffer[this.offset + this.pos++];
		var bit2 = buffer[this.offset + this.pos++];
		var bit3 = buffer[this.offset + this.pos++];

		bit0 = bit0 << 24; bit1 = bit1 << 16; bit2 = bit2 << 8; 
		return bit0 + bit1 + bit2 + bit3;
	};

	this.readUint64 = function() {
		var int32Begin = this.readUint32();
		var int32end = this.readUint32();
		int32Begin = int32Begin << 32;
		return int32Begin + int32end;
	};

	this.readUint8 = function() {
		var bit0 = buffer[this.offset + this.pos++];

		return bit0;
	};

	this.readUint16 = function() {
		var bit2 = buffer[this.offset + this.pos++];
		var bit3 = buffer[this.offset + this.pos++];
		
		bit2 = bit2 << 8; 
		return bit2 + bit3;
	};

	this.readUint15 = function() {
		var byte0 = buffer[this.offset + this.pos++];
		var byte1 = buffer[this.offset + this.pos++];

		var padding = (byte0 & 0x80) >> 7;
		var uint50 = (byte0 & 0x7C) >> 2;
		var uint51 = (byte0 & 0x3) << 3 | (byte1 & 0xE0) >> 5;
		var uint52 = (byte1 & 0x1F);

		return [padding, uint50, uint51, uint52];
	};

	this.readUint24 = function() {
		var bit1 = buffer[this.offset + this.pos++];
		var bit2 = buffer[this.offset + this.pos++];
		var bit3 = buffer[this.offset + this.pos++];

		bit1 = bit1 << 16; bit2 = bit2 << 8; 
		return bit1 + bit2 + bit3;
	};

	this.readRemainingAsString = function() {
		var ret = "";
		var remaining = this.size - this.pos;
		for (var i = 0; i < remaining; ++i) {
			var c = String.fromCharCode(this.readUint8());			
			ret += c;
		}

		return ret;
	};

	this.readBoxTypeString = function() {
		var chars = [];

		var typeString = "";
		for (var i = 0; i < 4; ++i) {
			chars[i] = buffer[this.offset + this.pos++];
			typeString += String.fromCharCode(chars[i]);
		}		

		return typeString;
	};

	this.skip = function(offset) {
		this.pos += offset;
	};

	this.getPos = function() {
		return (this.offset + this.pos);
	};

	this.eob = function() {
		return (this.pos >= this.size || (this.offset + this.pos) >= this.buffer.length);
	};
}
  
// Export 
window.BufferView = BufferView;

})();
