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
/* Box parser based on ISO/IEC 14496-12:2005 */

/*
aligned(8) class Box (unsigned int(32) boxtype,
	optional unsigned int(8)[16] extended_type) {
	unsigned int(32) size;
	unsigned int(32) type = boxtype;
	if (size==1) {
		unsigned int(64) largesize;
	} else if (size==0) {
		// box extends to end of file
	}
	if (boxtype==‘uuid’) {
		unsigned int(8)[16] usertype = extended_type;
	}
}
*/
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
		this.type == 'stbl' || 
		this.type == 'dinf' || 
		this.type == 'udta') {
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
		if (size == 0 || !type) {
			break;
		}

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
	var baseBox = new Box(bufferView);
	var fullBox;
	if (type === 'mvhd') {		
		fullBox = new FullBox(bufferView, baseBox);
		var movieHeaderBox = new MovieHeaderBox(bufferView, fullBox);
		b = movieHeaderBox;
	} else if (type === 'tkhd') {		
		fullBox = new FullBox(bufferView, baseBox);
		var tkhd = new TrackHeaderBox(bufferView, fullBox);
		b = tkhd;
	} else if (type === 'mdhd') {		
		fullBox = new FullBox(bufferView, baseBox);
		var mdhd = new MediaHeaderBox(bufferView, fullBox);
		b = mdhd;
	} else if (type === 'hdlr') {		
		fullBox = new FullBox(bufferView, baseBox);
		var hdlr = new HandlerReferenceBox(bufferView, fullBox);
		b = hdlr;
	} else if (type === 'vmhd') {		
		fullBox = new FullBox(bufferView, baseBox);
		var vmhd = new VideoMediaHeaderBox(bufferView, fullBox);
		b = vmhd;
	} else if (type === 'smhd') {
		fullBox = new FullBox(bufferView, baseBox);
		var smhd = new SoundMediaHeaderBox(bufferView, fullBox);
		b = smhd;				
	} else if (type === 'dref') {
		fullBox = new FullBox(bufferView, baseBox);
		var dref = new DataReferenceBox(bufferView, fullBox);
		b = dref;
	} else if (type === 'url ') {
		fullBox = new FullBox(bufferView, baseBox);
		var url = new DataEntryUrlBox(bufferView, fullBox);
		b = url;
	} else if (type === 'urn ') {
		fullBox = new FullBox(bufferView, baseBox);
		var urn = new DataEntryUrnBox(bufferView, fullBox);
		b = urn;
	} else {
		b = baseBox;
	}

	return b;
};

/*
aligned(8) class FullBox(unsigned int(32) boxtype, unsigned int(8) v, bit(24) f)
	extends Box(boxtype) {
	unsigned int(8) version = v;
	bit(24) flags = f;
}
*/
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

FullBox.overrideProp = function(fullBox) {
	if (fullBox) {
		this.size = fullBox.size;
		this.type = fullBox.type;
		this.version = fullBox.version;
		this.flags = fullBox.flags;
	} 
};

FullBox.extend = function(child) {
	if (child === undefined || child === null) {
		return;
	}
	
	child.prototype = new FullBox();
	child.prototype.constructor = child;
};

FullBox.prototype = new Box();
FullBox.prototype.constructor = FullBox;

/*
aligned(8) class MovieHeaderBox extends FullBox(‘mvhd’, version, 0) {
	if (version==1) {
		unsigned int(64) creation_time;
		unsigned int(64) modification_time;
		unsigned int(32) timescale;
		unsigned int(64) duration;
	} else { // version==0
		unsigned int(32) creation_time;
		unsigned int(32) modification_time;
		unsigned int(32) timescale;
		unsigned int(32) duration;
	}
	template int(32) rate = 0x00010000; // typically 1.0
	template int(16) volume = 0x0100; // typically, full volume
	const bit(16) reserved = 0;
	const unsigned int(32)[2] reserved = 0;
	template int(32)[9] matrix =
		{ 0x00010000,0,0,0,0x00010000,0,0,0,0x40000000 };
	// Unity matrix
	bit(32)[6] pre_defined = 0;
	unsigned int(32) next_track_ID;
}
*/
function MovieHeaderBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	if (this.version == 1) {
		this.creationTime = bufferView.readUint64();
		this.modificationTime = bufferView.readUint64();
		this.timeScale = bufferView.readUint32();
		this.duration = bufferView.readUint64();
	} else if (this.version === 0) {
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
	for (i  = 0; i < 6; ++i) {
		this.preDefined[i] = bufferView.readUint32();
	}

	this.nextTrackID = bufferView.readUint32();
} FullBox.extend(MovieHeaderBox);

/*
aligned(8) class TrackHeaderBox
	extends FullBox(‘tkhd’, version, flags){ if (version==1) {
      unsigned int(64)  creation_time;
      unsigned int(64)  modification_time;
      unsigned int(32)  track_ID;
      const unsigned int(32)  reserved = 0;
      unsigned int(64)  duration;
   } else { // version==0
      unsigned int(32)  creation_time;
      unsigned int(32)  modification_time;
      unsigned int(32)  track_ID;
      const unsigned int(32)  reserved = 0;
      unsigned int(32)  duration;
	}
	const unsigned int(32)[2] reserved = 0;
	template int(16) layer = 0;
	template int(16) alternate_group = 0;
	template int(16) volume = {if track_is_audio 0x0100 else 0}; const unsigned int(16) reserved = 0;
	template int(32)[9] matrix=
		{ 0x00010000,0,0,0,0x00010000,0,0,0,0x40000000 };
	      // unity matrix
	   unsigned int(32) width;
	   unsigned int(32) height;
}
*/
function TrackHeaderBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	if (this.version === 1) {
		this.creationTime = bufferView.readUint64();
		this.modificationTime = bufferView.readUint64();
		this.trackID = bufferView.readUint32();
		this.reserved = bufferView.readUint32();
		this.duration = bufferView.readUint64();
	} else if (this.version === 0) {
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
} FullBox.extend(TrackHeaderBox);

/*
aligned(8) class MediaHeaderBox extends FullBox(‘mdhd’, version, 0) { if (version==1) {
      unsigned int(64)  creation_time;
      unsigned int(64)  modification_time;
      unsigned int(32)  timescale;
      unsigned int(64)  duration;
	} else { // version==0
      unsigned int(32)  creation_time;
      unsigned int(32)  modification_time;
      unsigned int(32)  timescale;
      unsigned int(32)  duration;
	}
	bit(1) pad=0;
	unsigned int(5)[3] language; // ISO-639-2/T language code unsigned int(16) pre_defined = 0;
}
*/
function MediaHeaderBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	if (this.version === 1) {
		this.creationTime = bufferView.readUint64();
		this.modificationTime = bufferView.readUint64();
		this.timescale = bufferView.readUint32();
		this.duration = bufferView.readUint64();
	} else if (this.version === 0) {
		this.creationTime = bufferView.readUint32();
		this.modificationTime = bufferView.readUint32();
		this.timescale = bufferView.readUint32();
		this.duration = bufferView.readUint32();
	} 

	var uint5_3 = bufferView.readUint15();
	this.bit = uint5_3[0];
	this.languageCode = [];
	this.languageCode[0] = uint5_3[1];
	this.languageCode[1] = uint5_3[2];
	this.languageCode[2] = uint5_3[3];

	this.pre_defined = bufferView.readUint16();
} FullBox.extend(MediaHeaderBox);

/*
aligned(8) class HandlerBox extends FullBox(‘hdlr’, version = 0, 0) { unsigned int(32) pre_defined = 0;
unsigned int(32) handler_type;
const unsigned int(32)[3] reserved = 0;
   string   name;
}
*/
function HandlerReferenceBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.pre_defined = bufferView.readUint32();
	this.handlerType = bufferView.readUint32();

	this.reserved = [];
	for (var i = 0; i < 3; ++i) {
		this.reserved[i] = bufferView.readUint32();
	}

	this.name = bufferView.readRemainingAsString();
} FullBox.extend(HandlerReferenceBox);

/*
aligned(8) class VideoMediaHeaderBox
	extends FullBox(‘vmhd’, version = 0, 1) {
	template unsigned int(16) graphicsmode = 0; // copy, see below template unsigned int(16)[3] opcolor = {0, 0, 0};
}
*/
function VideoMediaHeaderBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.graphicsMode = bufferView.readUint16();
	this.opcolor = [];
	for (var i = 0; i < 3; ++i) {
		this.opcolor[i] = bufferView.readUint16();
	}
} FullBox.extend(VideoMediaHeaderBox);

/*
aligned(8) class SoundMediaHeaderBox
   extends FullBox(‘smhd’, version = 0, 0) {
   template int(16) balance = 0;
   const unsigned int(16)  reserved = 0;
}
*/
function SoundMediaHeaderBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.balance = bufferView.readUint16();
	this.reserved = bufferView.readUint16();
} FullBox.extend(SoundMediaHeaderBox);

/*
aligned(8) class DataReferenceBox
	extends FullBox(‘dref’, version = 0, 0) { unsigned int(32) entry_count;
	for (i=1; i • entry_count; i++) {
		DataEntryBox(entry_version, entry_flags) data_entry; }
}
*/
function DataReferenceBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.entryCount = bufferView.readUint32();

	var accumLength = 0;
	this.boxes = [];
	for (var i = 0; i < this.entryCount; ++i) {
		var curBoxSize = bufferView.peekUint32(accumLength);		
		var bufView = new BufferView(bufferView.buffer, bufferView.getPos() + accumLength, curBoxSize);
		var type = bufView.peekBoxTypeString(accumLength);
		var box = Box.createBox(bufView, curBoxSize, type);
		this.boxes.push(box);

		accumLength += curBoxSize;
	}
} FullBox.extend(DataReferenceBox);

/*
aligned(8) class DataEntryUrlBox (bit(24) flags) extends FullBox(‘url ’, version = 0, flags) {
	string location;
}
*/
function DataEntryUrlBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.location = bufferView.readRemainingAsString();
} FullBox.extend(DataEntryUrlBox);

/*
aligned(8) class DataEntryUrnBox (bit(24) flags) extends FullBox(‘urn ’, version = 0, flags) { 
	string name;
	string location;
}
*/
function DataEntryUrnBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	// this.name
	this.location = bufferView.readRemainingAsString();
} FullBox.extend(DataEntryUrnBox);

// Export
window.Box = Box;
window.FullBox = FullBox;
window.MovieHeaderBox = MovieHeaderBox;
window.TrackHeaderBox = TrackHeaderBox;

})();