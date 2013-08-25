stardict.js
==========

JavaScript API for handling dictionaries in StarDict format.

The code depends on two further javascript libraries, namely:

https://github.com/tuxor1337/dictzip.js
https://github.com/augustl/js-inflate

referred to in the code as "DictZipFile" and "JSInflate.inflate" respectively.

Example Code
---

    var dict = new StarDict();
    
    $("input[type=file]").change(function(evt) {
        dict.onsuccess = (function (theDict) {
            return function () {
                theDict.onmatch = function (str, type) {
                    console.log("type=" + type);
                    console.log("string=" + str);
                };
                
                theDict.lookup("cat");
            };
        })(dict);
        
        /* We are expecting a list of files here, containing at least an *.ifo,
         * an *.idx and a *.dict (or *.dict.dz) file.
         * Optionaly supported are a *.syn file as well as additional resources
         * in the form of a tuple of *.rifo/ridx/rdic files.
         * As a second argument, we can provide another list of files which contains
         * the contents of the subdirectory "res".
         */
        dict.load(evt.target.files);
    });


Further reading
---

Format documentation (original documentation is lost): http://code.google.com/p/babiloo/wiki/StarDict_format
 
Python API: http://code.google.com/p/pytoolkits/source/browse/trunk/utils/stardict/StarDict.py  
Java API: http://code.google.com/p/toolkits/source/browse/trunk/android/YAStarDict/src/com/googlecode/toolkits/stardict/StarDict.java
