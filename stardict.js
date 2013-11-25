
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
    
    function merge_sorted(a, b, callbk) {
        if("undefined" === typeof callbk) {
            callbk = function (x,y) {
                if (x > y) return 1;
                if (x < y) return -1;
                return 0;
            };
        }
        var result = [], ai = 0, bi = 0;
        while (true) {
            if ( ai < a.length && bi < b.length) {
                test = callbk(a[ai],b[bi]);
                if (test == -1) result.push(a[ai++]);
                else if (test == 1) result.push(b[bi++]);
                else {
                    result.push(a[ai++]);
                    result.push(b[bi++]);
                }
            } else if (ai < a.length) {
                result.push.apply(result, a.slice(ai, a.length));
                break;
            } else if (bi < b.length) {
                result.push.apply(result, b.slice(bi, b.length));
                break;
            } else break;
        }
        return result;
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
            var is_dz = false;
            var that = this;
            var dict;
            
            function process_syn() {
                if(files["syn"] != null) {
                    reader = new FileReader();
                    reader.onload = (function (theDict) {
                        return function(e) {
                            blob = e.target.result;
                            var syn_buf = [];
                            for(i = 0, j = 0; i < blob.length; i++) {
                                if(blob[i] == "\0") {
                                    synonym = readUTF8String(blob.slice(j,i));
                                    wid = getUIntAt(blob,i+1);
                                    syn_buf.push([synonym,wid]);
                                    i += 5, j = i;
                                }
                            }
                            synonyms = merge_sorted(synonyms, syn_buf,
                                function (a,b) {
                                    a = a[0].toLowerCase(), b = b[0].toLowerCase();
                                    if (a > b) return 1;
                                    if (a < b) return -1;
                                    return 0;
                            });
                            process_res();
                        };
                    })(that);
                    reader.readAsBinaryString(files["syn"]);
                } else {
                    process_res()
                }
            }
            
            function process_res() {
                if(files["res"].length > 0) {
                    filelist = files["res"];
                    files["res"] = [];
                    that.add_resources(filelist);
                    that.loaded = true;
                    that.onsuccess();
                } else {
                    that.loaded = true;
                    that.onsuccess();
                }
            }
            
            function process_idx() {
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
                    process_syn();
                };
                reader.readAsBinaryString(files["idx"]);
            }
            
            function process_ifo() {
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
            
            function process_dictdata(data, callbk) {
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
                callbk(data_arr);
            }
            
            this.onerror = function (err) { console.err(err); };
            this.onsuccess = function () { };
            this.loaded = false;
            
            this.load = function (main_files, res_files) {
                if(typeof res_files === "undefined") res_files = [];
                files["res"] = res_files;
                
                ["idx","syn","dict","dict.dz","ifo"].forEach(function(d) {
                    files[d] = null;
                    for(var i=0; i < main_files.length; i++) {
                        ext = main_files[i].name.substr(-1-d.length);
                        if(ext == "." + d) files[d] = main_files[i];
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
                
                if(files["dict"] != null) is_dz = false;
                else if(files["dict.dz"] != null) is_dz = true;
                else {
                    this.onerror("Missing *.dict(.dz) file!");
                    return;
                }
                
                process_ifo();
            };
            
            this.lookup_id = function (wid, callbk) {
                var idx = index[wid];
                if(is_dz) {
                    var reader = new DictZipFile(JSInflate.inflate);
                    reader.onsuccess = function () {
                        reader.read(idx[1], idx[2], function (data) {
                            process_dictdata(data, function(output) {
                                callbk(output, idx);
                            });
                        });
                    };
                    reader.load(files["dict.dz"]);
                } else {
                    f = files["dict"].slice(
                        idx[1], idx[1] + idx[2]
                    );
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        process_dictdata(e.target.result, function(output) {
                            callbk(output, idx);
                        });
                    };
                    reader.readAsBinaryString(f);
                }
            };
            
            this.lookup_fuzzy = function (word) {
                var word_lower = word.toLowerCase();
                var matches = [];
                for(var s = 0; s < synonyms.length; s++) {
                    if(synonyms[s][0].substr(0,word.length).toLowerCase() == word_lower) {
                        matches.push(synonyms[s]);
                    }
                    if(matches.length > 20) break;
                }
                return matches;
            };
            
            this.add_resources = function (res_filelist) {
                var filenames = "";
                for(var f = 0; f < res_filelist.length; f++) {
                    files["res"].push(res_filelist[f]);
                    filenames += res_filelist[f].name + ", ";
                }
            };
            
            this.request_res = function (filename) {
                filename = filename.replace(/^\x1E/, '');
                filename = filename.replace(/\x1F$/, '');
                for(var f = 0; f < files["res"].length; f++) {
                    var fname = files["res"][f].name;
                    if(filename == fname.substring(
                        fname.lastIndexOf("/")+1
                    )) return files["res"][f];
                }
                console.log("Resource "+filename+" not available");
                return null;
            };
            
            this.get_key = function (key) {
                return keywords[key];
            };
        }
        
        return cls;
    })()
    
    GLOBAL.StarDict = StarDict;
}(this));
