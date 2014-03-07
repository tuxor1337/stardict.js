stardict.js
==========

JavaScript library for handling dictionaries in StarDict format.

The code depends on two further javascript libraries, namely:

- https://github.com/tuxor1337/dictzip.js
- https://github.com/dasmoth/jszlib

referred to in the code as "DictZipFile" and "jszlib_inflate_buffer" respectively.

### Example Code

Note that the code in the "demo" subdirectory depends on the files "inflate.js",
"dictzip.js" and "dictzip_sync.js" from the JSZLib project and the dictzip.js
project respectively. If you want to run the demo code, copy versions of those
files into the demo directory.

### Documentation: Synchronous interface

Use `importScripts` to import stardict_sync.js into your worker's scope. This will define the global variable `StarDict`. You create a new instance of `StarDict` as follows:

    var dict = new StarDict(files);

`files` is an array of File objects (as in the File API http://www.w3.org/TR/FileAPI/). It's supposed to contain exactly one file of type \*.dict(.dz), \*.idx(.dz), \*.ifo. Each instance of `StarDict` provides the following methods:

    var value = dict.keyword(key);
    
`key` is a string and `value` is the value of the respective key in the dictionary's \*.ifo file or `null` if key is not defined in the \*.ifo file. Format specific keys include _version, bookname, wordcount, synwordcount, idxfilesize_ and _sametypesequence_. You will typically be intrested in the value of _bookname_.

A dictionary in the StarDict format comes with a word index and optionally synonyms with references to this index. You access the index as follows:

    var aIdx = dict.index(options);
    
Here `aIdx` is an array of objects, even if it contains only one or no entry. The form of the objects contained in `aIdx` is determined by the optional `options` parameter:

    options = {
        start_offset: unsigned int, // default: 0
        count: unsigned int,        // default: 1 if start_offset != 0 else `wordcount`
        include_term: boolean,      // default: true
        include_dictpos: boolean,   // default: true
        include_offset: boolean     // default: false
    };

All properties are optional. `start_offset` is the offset in the dictionary's \*.idx file from which to start reading and `count` the (maximal) number of objects `aIdx` will contain. The `include_\*` properties determine the format of the objects in `aIdx`:

    aIdx[n] = {
        term: string,                // if include_term == true
        dictpos: [startbyte, size],  // if include_dictpos == true
        offset: unsigned int         // if include_offset == true
    };

Here `dictpos` is of the form which the `entry` method expects (see below) and `offset` corresponds to the `start_offset` property of `options`, thus represents the offset of this `term` in \*.idx.

In a perfectly analogous way you can access the dictionary's synonyms:

    var aSyns = dict.synonyms(options);

Here `aSyns` is an array of objects, even if it contains only one or no entry. The form of the objects contained in `aSyns` is determined by the optional `options` parameter:

    options = {
        start_offset: unsigned int, // default: 0
        count: unsigned int,        // default: 1 if start_offset != 0 else `wordcount`
        include_term: boolean,      // default: true
        include_wid: boolean,       // default: true
        include_offset: boolean     // default: false
    };

All properties are optional. `start_offset` is the offset in the dictionary's \*.syn file from which to start reading and `count` the (maximal) number of objects `aSyns` will contain. The `include_\*` properties determine the format of the objects in `aSyns`:

    aSyns[n] = {
        term: string,          // if include_term == true
        wid: unsigned int,     // if include_wid == true
        offset: unsigned int   // if include_offset == true
    };

`offset` corresponds to the `start_offset` property of `options`, thus represents the offset of this `term` in \*.syn. Note that `wid` is _not_ the value corresponding to the `start_offset` option of the `index` method (cf. above). Instead it's the position of the corresponding object in the array `dict.index()` of _all_ index terms.

You access the articles/entries of the dictionary (contained in \*.dict) via the method

    var aData = dict.entry(dictpos);

`dictpos` is an array `[startbyte, size]` as provided by the `index` method. Because each entry in \*.dict is composed of several data blocks, `aData` is an array of data objects of the following form:

    aData[n] = {
        type: string,                   // one of m,l,g,t,x,y,k,w,h,r,W,P,X
        content: ArrayBuffer or string
    };

The `type` of a data block is defined in the StarDict format documentation (see link below), e.g. m is text/plain, h is text/html etc. `content` is a string for the data types m,g,t,x,y,k,w,h,r and an ArrayBuffer else. It's up to you to interpret the other types according to the StarDict format documentation.

Finally, you can access the resources provided with the dictionary (and usually referenced in the entries) using

    var blob = dict.resource(name);
    
`blob` is a `Blob` object (or `null` if the resource doesn't exist) and `name` is a string.

### Documentation: Asynchronous interface

The asynchronous version of the `StarDict` object provided in `stardict.js` needs to be initialized using the `load` method:

    dict.load().then(function () {
        // start using the other methods
    },
    function (err) {
        // in case of errors; `err` is an instance of Error
    });

After that, all definitions from the synchronous case also apply to this case. But the methods return corresponding `Promise` object, e.g.

    dict.synonym(options).then(function (aSyns) {
        // do something with aSyns
    });
    
Further reading
---

Format documentation (original documentation is lost): http://code.google.com/p/babiloo/wiki/StarDict_format
 
Python lib: http://code.google.com/p/pytoolkits/source/browse/trunk/utils/stardict/StarDict.py  
Java lib: http://code.google.com/p/toolkits/source/browse/trunk/android/YAStarDict/src/com/googlecode/toolkits/stardict/StarDict.java
