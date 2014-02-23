stardict.js
==========

JavaScript library for handling dictionaries in StarDict format.

The code depends on two further javascript libraries, namely:

- https://github.com/tuxor1337/dictzip.js
- https://github.com/dasmoth/jszlib

referred to in the code as "DictZipFile" and "jszlib_inflate_buffer" respectively.

Example Code
---

Note that the code in the "demo" subdirectory depends on the files "inflate.js",
"dictzip.js" and "dictzip_sync.js" from the JSZLib project and the dictzip.js
project respectively. If you want to run the demo code, copy versions of those
files into the demo directory.
    
Further reading
---

Format documentation (original documentation is lost): http://code.google.com/p/babiloo/wiki/StarDict_format
 
Python lib: http://code.google.com/p/pytoolkits/source/browse/trunk/utils/stardict/StarDict.py  
Java lib: http://code.google.com/p/toolkits/source/browse/trunk/android/YAStarDict/src/com/googlecode/toolkits/stardict/StarDict.java
