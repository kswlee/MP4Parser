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

	this.readUint24 = function() {
		var bit1 = buffer[this.offset + this.pos++];
		var bit2 = buffer[this.offset + this.pos++];
		var bit3 = buffer[this.offset + this.pos++];

		bit1 = bit1 << 16; bit2 = bit2 << 8; 
		return bit1 + bit2 + bit3;
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
	}

	this.eob = function() {
		return (this.pos >= this.size || (this.offset + this.pos) >= this.buffer.length);
	};
}
  
// Export 
window.BufferView = BufferView;

})();
