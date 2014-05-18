MP4Parser
=========

A simple JavaScript MP4 parser for reading MP4 boxes.
   
Example:   

var bufferview = new Uint8Array(fileReader.result);
var mp4 = new MP4(bufferview);
mp4.parse();

var duration = mp4.getDuration();

