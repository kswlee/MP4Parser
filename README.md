MP4Parser
====

**mp4.js** is a simple JavaScript MP4 parser for reading MP4 boxes. Currently, mvhd and tkhd are the one completely parsed.  
Check the online example: http://mp4parser.kennylee.co/example/
   
Example
====

Simply create a Uint8Arrau based on the binary content of the MP4 file and pass it to create MP4 instance to parse the boxes.

```
var bufferview = new Uint8Array(fileReader.result);
var mp4 = new MP4(bufferview);
mp4.parse();

var duration = mp4.getDuration();
```

License
===

MIT