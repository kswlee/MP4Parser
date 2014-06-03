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
function Box(bufferView, parent) {
	if (bufferView === undefined || bufferView === null) {
		this.size = 0;
		this.type = '';
		this.boxes = [];
		return;
	}

	if (parent) {
		this._parent = parent;
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

Box.prototype.getHandlerType = function() {
	var p = this._parent;
	do {
		if (!p) 
			break;

		if (p.handlerType) {
			return p.handlerType;
		}

		if (p.type === 'mdia') {
			var mdia = p;
			for (var i = 0; i < mdia.boxes.length; ++i) {
				p = mdia.boxes[i];
				if (p.handlerType) {
					return p.handlerType;			
				}
			} 

			break;
		}

		p = p._parent;
	} while(true);

	return '';
};

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

		var handlerType = box.getHandlerType();
		var b = Box.createBox(new BufferView(bufferView.buffer, bufferView.getPos() - 2 * 4, size), size, type, box, handlerType);
		boxes.push(b);

		b._parent = box;
		box.boxes.push(b);

		bufferView.skip(size - 2 * 4);

		if (bufferView.eob()) {
			break;
		}
	} while (true);

	return boxes;
};

Box.createBox = function(bufferView, size, type, box, handlerType) {
	var b;
	var baseBox = new Box(bufferView, box);	
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
	} else if (type === 'stsd') {
		fullBox = new FullBox(bufferView, baseBox);
		var urn = new SampleDescriptionBox(bufferView, fullBox, handlerType);
		b = urn;	
	} else if (type === 'stts') {
		fullBox = new FullBox(bufferView, baseBox);
		var stts = new TimeToSampleBox(bufferView, fullBox);
		b = stts;
	} else if (type === 'stss') {
		fullBox = new FullBox(bufferView, baseBox);
		var stss = new SyncSampleBox(bufferView, fullBox);
		b = stss;
	} else if (type === 'stsc') {
		fullBox = new FullBox(bufferView, baseBox);
		var stsc = new SampleToChunkBox(bufferView, fullBox);
		b = stsc;
	} else if (type === 'stsz') {
		fullBox = new FullBox(bufferView, baseBox);
		var stsz = new SampleSizeBox(bufferView, fullBox);
		b = stsz;
	} else if (type === 'stco') {
		fullBox = new FullBox(bufferView, baseBox);
		var stco = new ChunkOffsetBox(bufferView, fullBox);
		b = stco;
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

		if (box._parent) {
			this._parent = box._parent;
		}
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

		if (fullBox._parent) {
			this._parent = fullBox._parent;
		}
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
aligned(8) abstract class SampleEntry (unsigned int(32) format) extends Box(format){
const unsigned int(8)[6] reserved = 0;
unsigned int(16) data_reference_index;
}
*/
function SampleEntry(bufferView, box) {
	if (box) {
		this.size = box.size;
		this.type = box.type;
	}

	this.reserved = [];
	this.data_reference_index = 0;
	if (bufferView) {
		for (var i = 0; i < 6; ++i) {
			this.reserved[i] = bufferView.readUint8();
		}

		this.data_reference_index = bufferView.readUint16();
	}
}
SampleEntry.prototype = new Box();
SampleEntry.prototype.constructor = SampleEntry;

/*
class VisualSampleEntry(codingname) extends SampleEntry (codingname){ unsigned int(16) pre_defined = 0;
const unsigned int(16) reserved = 0;
unsigned int(32)[3] pre_defined = 0;
unsigned int(16) width;
unsigned int(16) height;
template unsigned int(32) horizresolution = 0x00480000; // 72 dpi template unsigned int(32) vertresolution = 0x00480000; // 72 dpi const unsigned int(32) reserved = 0;
template unsigned int(16) frame_count = 1;
string[32] compressorname;
template unsigned int(16) depth = 0x0018;
int(16) pre_defined = -1;
// other boxes from derived specifications
CleanApertureBox clap; // optional
PixelAspectRatioBox pasp; // optional
}
*/
function VisualSampleEntry(bufferView, sampleEntry) {
	if (sampleEntry) {
		this.size = sampleEntry.size;
		this.type = sampleEntry.type;
		this.reserved = sampleEntry.reserved;
		this.data_reference_index = sampleEntry.data_reference_index;
	}	

	if (bufferView) {
		this.pre_defined = bufferView.readUint16();
		this.reservedEx = bufferView.readUint16();

		bufferView.readUint32();	// skip 3 pre-defined of 32bit data
		bufferView.readUint32();		
		bufferView.readUint32();		

		this.width = bufferView.readUint16();
		this.height = bufferView.readUint16();

		this.horizresolution = bufferView.readUint32();
		this.vertresolution = bufferView.readUint32();

		bufferView.readUint32(); // skip reserved

		this.frameCount = bufferView.readUint16();
		this.compressorName = bufferView.readBoxTypeString();
		this.depth = bufferView.readUint16();

		bufferView.readUint16(); // skip predefined
	}
} 
VisualSampleEntry.prototype = new SampleEntry();
VisualSampleEntry.prototype.constructor = VisualSampleEntry;

/*
class AudioSampleEntry(codingname) extends SampleEntry (codingname){ const unsigned int(32)[2] reserved = 0;
template unsigned int(16) channelcount = 2;
template unsigned int(16) samplesize = 16;
unsigned int(16) pre_defined = 0;
const unsigned int(16) reserved = 0 ;
template unsigned int(32) samplerate = { default samplerate of media}<<16;
}
*/
function AudioSampleEntry(bufferView, sampleEntry) {
	if (sampleEntry) {
		this.size = sampleEntry.size;
		this.type = sampleEntry.type;
		this.reserved = sampleEntry.reserved;
		this.data_reference_index = sampleEntry.data_reference_index;
	}	

	if (bufferView) {
		bufferView.readUint32();  // skip two reserved
		bufferView.readUint32(); 

		this.channelCount = bufferView.readUint16();
		this.sampleSize = bufferView.readUint16();

		this.preDefined = bufferView.readUint16();
		this.reserved = bufferView.readUint16();
		this.sampleRate = bufferView.readUint32();
	}
}
AudioSampleEntry.prototype = new SampleEntry();
AudioSampleEntry.prototype.constructor = AudioSampleEntry;

function TimeToSampleBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.entryCount = bufferView.readUint32();

	this.samples = [];
	for (var i = 0; i < this.entryCount; ++i) {
		var entry = {
			'count': bufferView.readUint32(),
			'delta': bufferView.readUint32()
		};

		this.samples.push(entry);
	}

} FullBox.extend(TimeToSampleBox);

/*
aligned(8) class TimeToSampleBox
   extends FullBox(’stts’, version = 0, 0) {
   unsigned int(32)  entry_count;
      int i;
   for (i=0; i < entry_count; i++) {
      unsigned int(32)  sample_count;
      unsigned int(32)  sample_delta;
   }
}
*/
function SyncSampleBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.entryCount = bufferView.readUint32();

	this.syncSamples = [];
	for (var i = 0; i < this.entryCount; ++i) {
		this.syncSamples.push(bufferView.readUint32());
	}

} FullBox.extend(SyncSampleBox);

/*
aligned(8) class SampleToChunkBox 
 extends FullBox(‘stsc’, version = 0, 0) { 
 unsigned int(32) entry_count; 
 for (i=1; i <= entry_count; i++) { 
 unsigned int(32) first_chunk; 
 unsigned int(32) samples_per_chunk; 
 unsigned int(32) sample_description_index; 
 } 
} 
*/
function SampleToChunkBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.entryCount = bufferView.readUint32();

	this.samples = [];
	for (var i = 0; i < this.entryCount; ++i) {
		var entry = {
			'first_chunk': bufferView.readUint32(),
			'samples_per_chunk': bufferView.readUint32(),
			'sample_description_index': bufferView.readUint32()
		};

		this.samples.push(entry);
	}

} FullBox.extend(SampleToChunkBox);

/*
aligned(8) class SampleSizeBox extends FullBox(‘stsz’, version = 0, 0) { 
 unsigned int(32) sample_size; 
 unsigned int(32) sample_count; 
 if (sample_size==0) { 
 for (i=1; i <= sample_count; i++) { 
 unsigned int(32) entry_size; 
 } 
 } 
} 
*/
function SampleSizeBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);
	this.sampleSize = bufferView.readUint32();
	this.sampleCount = bufferView.readUint32();

	if (this.sampleSize == 0) {
		this.sampleSizes = [];
		for (var i = 0; i < this.sampleCount; ++i) {
			this.sampleSizes.push(bufferView.readUint32());
		}
	}

} FullBox.extend(SampleSizeBox);

/*
aligned(8) class ChunkOffsetBox
   extends FullBox(‘stco’, version = 0, 0) {
   unsigned int(32)  entry_count;
   for (i=1; i <= entry_count; i++) {
      unsigned int(32)  chunk_offset;
   }
}
*/
function ChunkOffsetBox(bufferView, fullBox) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.entryCount = bufferView.readUint32();

	this.chunkOffset = [];
	for (var i = 0; i < this.entryCount; ++i) {
		this.chunkOffset.push(bufferView.readUint32());
	}

} FullBox.extend(ChunkOffsetBox);
 
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
	this.hadler_type = [];

	this.hadler_type[0] = (this.handlerType & 0xFF000000) >> 24; 
	this.hadler_type[1] = (this.handlerType & 0x00FF0000) >> 16; 
	this.hadler_type[2] = (this.handlerType & 0x0000FF00) >> 8; 
	this.hadler_type[3] = (this.handlerType & 0x000000FF); 

	this.handlerType = "";
	for (var i = 0; i < this.hadler_type.length; ++i) {
		this.hadler_type[i] = String.fromCharCode(this.hadler_type[i]);
		this.handlerType += this.hadler_type[i];
	}
	delete this.hadler_type;

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
		box._parent = this;
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

/*
aligned(8) class SampleDescriptionBox (unsigned int(32) handler_type)
	extends FullBox('stsd', 0, 0){
		int i ;
		unsigned int(32) entry_count;
		for (i = 1 ; i u entry_count ; i++){
			switch (handler_type){
				case ‘soun’: // for audio tracks
					AudioSampleEntry();
				break;
				case ‘vide’: // for video tracks
					VisualSampleEntry();
				break;
				case ‘hint’: // Hint track
					HintSampleEntry();
				break;
		}
	}
}
*/
function SampleDescriptionBox(bufferView, fullBox, handler_type) {
	FullBox.overrideProp.apply(this, [fullBox]);

	this.entryCount = bufferView.readUint32();

	var accumLength = 0;
	this.boxes = [];
	for (var i = 0; i < this.entryCount; ++i) {
		var curBoxSize = bufferView.peekUint32(accumLength);		
		var bufView = new BufferView(bufferView.buffer, bufferView.getPos() + accumLength, curBoxSize);
		var type = bufView.peekBoxTypeString(accumLength);
		var box = Box.createBox(bufView, curBoxSize, type);		
		var sampleEntry = new SampleEntry(bufView, box);

		var vsEntry;
		if (handler_type === 'vide') {
			vsEntry = new VisualSampleEntry(bufView, sampleEntry);
		} else if (handler_type === 'soun') {
			vsEntry = new AudioSampleEntry(bufView, sampleEntry);
		}
		vsEntry._parent = this;
		this.boxes.push(vsEntry);

		accumLength += curBoxSize;
	}	
} FullBox.extend(SampleDescriptionBox);

// Export
window.Box = Box;
window.FullBox = FullBox;
window.MovieHeaderBox = MovieHeaderBox;
window.TrackHeaderBox = TrackHeaderBox;

})();