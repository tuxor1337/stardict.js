
(function (GLOBAL) { 
    function getUIntAt(arr, offs) {
        out = 0;
        for (var j = offs; j < offs+4; j++) {
                out <<= 8;
                out |= arr.charCodeAt(j) & 0xff;
        }
        return out;
    }
    
    function readUTF8String(bytes) {
        var ix = 0;
        if( bytes.slice(0,3) == "\xEF\xBB\xBF") ix = 3;
        var string = "";
        for( ; ix < bytes.length; ix++ ) {
            var byte1 = bytes[ix].charCodeAt(0);
            if( byte1 < 0x80 ) {
                string += String.fromCharCode(byte1);
            } else if( byte1 >= 0xC2 && byte1 < 0xE0 ) {
                var byte2 = bytes[++ix].charCodeAt(0);
                string += String.fromCharCode(((byte1&0x1F)<<6)
                    + (byte2&0x3F));
            } else if( byte1 >= 0xE0 && byte1 < 0xF0 ) {
                var byte2 = bytes[++ix].charCodeAt(0);
                var byte3 = bytes[++ix].charCodeAt(0);
                string += String.fromCharCode(((byte1&0xFF)<<12) 
                    + ((byte2&0x3F)<<6) + (byte3&0x3F));
            } else if( byte1 >= 0xF0 && byte1 < 0xF5) {
                var byte2 = bytes[++ix].charCodeAt(0);
                var byte3 = bytes[++ix].charCodeAt(0);
                var byte4 = bytes[++ix].charCodeAt(0);
                var codepoint = ((byte1&0x07)<<18) + ((byte2&0x3F)<<12)
                    + ((byte3&0x3F)<<6) + (byte4&0x3F);
                codepoint -= 0x10000;
                string += String.fromCharCode(
                    (codepoint>>10) + 0xD800,
                    (codepoint&0x3FF) + 0xDC00
                );
            }
        }
        return string;
    }

    var StarDict = (function () {
        var cls = function() {
            var files = { };
            var index = [];
            var synonyms = [];
            var keywords = {
                "version": "",
                "bookname": "",
                "wordcount": "",
                "synwordcount": "",
                "idxfilesize": "",
                "sametypesequence": "",
            };
            var is_dz = false, dict;
            var that = this;
            
            function process_syn() {
                if(files["syn"] != null) {
                    console.log("Processing syn file...");
                    f = f.mozSlice(0,1000); // testing purposes
                    reader = new FileReader();
                    reader.onload = (function (theDict) {
                        return function(e) {
                            blob = e.target.result;
                            for(i = 0, j = 0; i < blob.length; i++) {
                                if(blob[i] == "\0") {
                                    synonym = readUTF8String(blob.slice(j,i));
                                    wid = getUIntAt(blob,i+1);
                                    synonyms.push([synonym,wid]);
                                    i += 5, j = i;
                                }
                            }
                            theDict.onsuccess();
                        };
                    })(that);
                    reader.readAsBinaryString(f);
                } else {
                    that.onsuccess();
                }
            }
            
            function process_dict() {
                if(files["dict"] == null) {
                    console.log("Processing dictzip file...");
                    is_dz = true;
                    dict = new DictZipFile(JSInflate.inflate);
                    dict.onsuccess = process_syn;
                    dict.onread = process_dictdata;
                    dict.load(files["dict.dz"]);
                } else { 
                    is_dz = false;
                    process_syn();
                }
            }
            
            function process_idx() {
                console.log("Processing idx file...");
                reader = new FileReader();
                reader.onload = function(e) {
                    blob = e.target.result;
                    for(var i = 0, j = 0; i < blob.length; i++) {
                        if(blob[i] == "\0") {
                            word = readUTF8String(blob.slice(j,i));
                            offset = getUIntAt(blob,i+1);
                            size = getUIntAt(blob,i+5);
                            synonyms.push([word,index.length]);
                            index.push([word,offset,size]);
                            i += 9, j = i;
                        }
                    }
                    process_dict();
                };
                reader.readAsBinaryString(files["idx"]);
            }
            
            function process_ifo() {
                console.log("Processing ifo file...");
                reader = new FileReader();
                reader.onload = (function (theDict) {
                    return function(e) {
                         lines = e.target.result.split("\n");
                         if(lines.shift() != "StarDict's dict ifo file") {
                             theDict.onerror("Not a proper ifo file");
                             return;
                         }
                         lines.forEach(function (l) {
                             w = l.split("=");
                             keywords[w[0]] = w[1];
                         });
                         process_idx();
                    };
                })(that);
                reader.readAsText(files["ifo"]);
            }
            
            function process_dictdata(data) {
                if("" != keywords["sametypesequence"]) {
                    type_str = keywords["sametypesequence"];
                    is_sts = true;
                }
                data_arr = [];
                while(true) {
                    if(is_sts) {
                        t = type_str[0];
                        type_str = type_str.substr(1);
                    } else {
                        t = data[0];
                        data = data.substr(1);
                    }
                    if(is_sts && "" == type_str) d = data;
                    else if(t == t.toUpperCase()) {
                        end = getUIntAt(data,0);
                        d = data.slice(4,end+4);
                        data = data.slice(end+4);
                    } else {
                        end = data.indexOf("\0");
                        d = data.slice(0,end);
                        data = data.slice(end+1);
                    }
                    if("mgtxykwh".indexOf(t) != -1) d = readUTF8String(d);
                    data_arr.push([d, t]);
                    if(data.length == 0 || (is_sts && type_str == ""))
                        break;
                }
                that.onmatch(data_arr);
            }
            
            this.onmatch = function () { };
            this.onerror = function (err) { console.err(err); };
            this.onsuccess = function () { };
            
            this.load = function (main_files, res_files) {
                if(typeof res_files === "undefined") res_files = [];
                
                ["idx","syn","dict","dict.dz","ifo"].forEach(function(d) {
                    files[d] = null;
                    for(var i=0; i < main_files.length; i++) {
                        ext = main_files[i].name.substr(-1-d.length);
                        if(ext == "." + d) {
                            files[d] = main_files[i];
                            console.log(d+"-file: " + main_files[i].name);
                        }
                    }
                });
                
                if(files["ifo"] == null) {
                    this.onerror("Missing *.ifo file!");
                    return;
                }
                
                if(files["idx"] == null) {
                    this.onerror("Missing *.idx file!");
                    return;
                }
                
                if(files["dict"] == null && files["dict.dz"] == null) {
                    this.onerror("Missing *.dict(.dz) file!");
                    return;
                }
                
                process_ifo();
            }
            
            this.lookup = function (word) {
                var wid = -1;
                console.log("looking up " + word);
                for(var i = 0; i < synonyms.length; i++) {
                    if(synonyms[i][0] == word) {
                        wid = synonyms[i][1]; break;
                    }
                }
                if(wid == -1) dict.onmatch(null);
                if(is_dz) dict.read(index[wid][1], index[wid][2]);
                else {
                    f = files["dict"].slice(
                        index[wid][1], index[wid][1] + index[wid][2]
                    );
                    reader = new FileReader();
                    reader.onload = function (e) {
                        process_dictdata(e.target.result);
                    };
                    reader.readAsBinaryString(f);
                }
            }
            
            this.lookup_fuzzy = function (word) {
                var matches = [];
                console.log("looking up " + word + "%");
                synonyms.forEach(function (syn) {
                    if(syn[0].substr(0,word.length) == word) {
                        matches.push(syn[0]);
                    }
                });
                return matches;
            }
        }
        
        return cls;
    })()
    
    GLOBAL.StarDict = StarDict;
}(this));
