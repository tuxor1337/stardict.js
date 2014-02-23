(function (GLOBAL) {        
    function getUintAt(arr, offs) {
        out = 0;
        for (var j = offs; j < offs+4; j++) {
                out <<= 8;
                out |= arr[j] & 0xff;
        }
        return out;
    }
    
    function readUTF8String(bytes) {
        var ix = 0;
        if(bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF) ix = 3;
        var string = "";
        for( ; ix < bytes.length; ix++ ) {
            var byte1 = bytes[ix];
            if( byte1 < 0x80 ) {
                string += String.fromCharCode(byte1);
            } else if( byte1 >= 0xC2 && byte1 < 0xE0 ) {
                var byte2 = bytes[++ix];
                string += String.fromCharCode(((byte1&0x1F)<<6)
                    + (byte2&0x3F));
            } else if( byte1 >= 0xE0 && byte1 < 0xF0 ) {
                var byte2 = bytes[++ix];
                var byte3 = bytes[++ix];
                string += String.fromCharCode(((byte1&0xFF)<<12)
                    + ((byte2&0x3F)<<6) + (byte3&0x3F));
            } else if( byte1 >= 0xF0 && byte1 < 0xF5) {
                var byte2 = bytes[++ix];
                var byte3 = bytes[++ix];
                var byte4 = bytes[++ix];
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
            var files = {},
                keywords = {
                    "version": "",
                    "bookname": "",
                    "wordcount": "",
                    "synwordcount": "",
                    "idxfilesize": "",
                    "sametypesequence": "",
                    "is_dz": false,
                    "dbwordcount": 0
            };
                
            function check_files(flist) {
                ["idx","syn","dict","dict.dz","ifo","rifo","ridx",
                 "ridx.dz","rdic","rdic.dz"].forEach(function(d) {
                    files[d] = null;
                    for(var i=0; i < flist.length; i++) {
                        ext = flist[i].name.substr(-1-d.length);
                        if(ext == "." + d) {
                            files[d] = flist[i];
                            flist.splice(i,1);
                        }
                    }
                });
                 
                files["res"] = flist;
                
                if(files["dict"] != null) keywords.is_dz = false;
                else if(files["dict.dz"] != null) keywords.is_dz = true;
                else throw new Error("Missing *.dict(.dz) file!");
                
                if(files["idx"] == null) throw new Error("Missing *.idx file!");
                if(files["ifo"] == null) throw new Error("Missing *.ifo file!");
            }
            
            function process_ifo(text) {
                var lines = text.split("\n");
                if(lines.shift() != "StarDict's dict ifo file")
                    throw new Error("Not a proper ifo file");
                lines.forEach(function (l) {
                    w = l.split("=");
                    keywords[w[0]] = w[1];
                });
            }
            
            this.load = function (file_list) {
                return new Promise(function (resolve, reject) {
                    try {
                        check_files(file_list);
                        var reader = new FileReader();
                        reader.onload = function (evt) {
                            process_ifo(evt.target.result);
                            resolve();
                        };
                        reader.readAsText(files["ifo"]);
                    } catch(err) {
                        reject(err);
                    }
                });
            }
            
            this.keyword = function (key) { return keywords[key]; };
            
            this.resource = function (name) {
                name = name.replace(/^\x1E/, '').replace(/\x1F$/, '');
                for(var f = 0; f < files["res"].length; f++) {
                    var filename = files["res"][f].name;
                    if(name == filename.substring(
                        filename.lastIndexOf("/")+1
                    )) return files["res"][f];
                }
                console.log("Resource " + name + " not available");
                return null;
            };
            
            this.entry = function (dictpos) {
                var offset = dictpos[0], size = dictpos[1];
                
                function process_entry_data(buffer) {
                    var rawdata = new Uint8Array(buffer),
                        output_arr = [], is_sts = false;
                    if("" != keywords["sametypesequence"]) {
                        type_str = keywords["sametypesequence"];
                        is_sts = true;
                    };
                    while(true) {
                        if(is_sts) {
                            t = type_str[0];
                            type_str = type_str.substr(1);
                        } else {
                            t = String.fromCharCode(data[0]);
                            rawdata = rawdata.slice(1);
                        }
                        if(is_sts && "" == type_str) d = rawdata;
                        else if(t == t.toUpperCase()) {
                            end = getUIntAt(rawdata,0);
                            d = rawdata.slice(4,end+4);
                            rawdata = rawdata.slice(end+4);
                        } else {
                            end = rawdata.indexOf(0);
                            d = rawdata.slice(0,end);
                            rawdata = rawdata.slice(end+1);
                        }
                        if("mgtxykwh".indexOf(t) != -1) d = readUTF8String(d);
                        output_arr.push({"type": t, "content": d});
                        if(rawdata.length == 0 || (is_sts && type_str == ""))
                            break;
                    }
                    return output_arr;
                }
                
                return new Promise(function (resolve, reject) {
                    if(keywords.is_dz) {
                        var reader = new DictZipFile(
                            files["dict.dz"],
                            jszlib_inflate_buffer
                        );
                        reader.load().then(function () {
                            return reader.read(offset, size);
                        }, reject).then(function(buffer) {
                            resolve(process_entry_data(buffer));
                        }, reject);
                    } else {
                        var f = files["dict"].slice(offset, offset + size),
                            reader = new FileReader();
                        reader.onload = function (evt) {
                            resolve(process_entry_data(evt.target.result));
                        };
                        reader.readAsArrayBuffer(f);
                    }
                });
            };
            
            this.synonyms = function (options) {
                if(files["syn"] == null)  return [];
                if(typeof options === "undefined") options = {};
                
                var options_default = {
                    "count": -1,
                    "start_offset": 0,
                    "include_term": true, 
                    "include_wid": true,
                    "include_offset": false
                };
                
                for(var prop in options_default) {
                    if(typeof options[prop] === "undefined") {
                        if(prop == "count" && typeof options["start_offset"] !== "undefined")
                            options["count"] = 1;
                        else options[prop] = options_default[prop];
                    }
                }
                
                function process_syn_data(buffer) {
                    var output_arr = [], view = new Uint8Array(buffer);
                    for(var i = 0, j = 0; i < view.length; i++) {
                        if(options["count"] >= 0
                           && options["count"] <= output_arr.length) break;
                        if(view[i] == 0) {
                            var syn_obj = {};
                            if(options["include_term"])
                                syn_obj["term"] = readUTF8String(view.subarray(j,i));
                            if(options["include_wid"])
                                syn_obj["wid"] = getUintAt(view,i+1);
                            if(options["include_offset"])
                                syn_obj["offset"] = options["start_offset"] + j;
                            output_arr.push(syn_obj);
                            i += 5; j = i;
                        }
                    }
                    return output_arr;
                }
                
                return new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function (evt) {
                        resolve(process_syn_data(evt.target.result));
                    };
                    reader.readAsArrayBuffer(
                        files["syn"].slice(options["start_offset"])
                    );
                });
            };
            
            this.index = function (options) {
                if(typeof options === "undefined") options = {};
                var options_default = {
                    "count": -1,
                    "start_offset": 0,
                    "include_term": true, 
                    "include_dictpos": true,
                    "include_offset": false
                };
                for(var prop in options_default) {
                    if(typeof options[prop] === "undefined") {
                        if(prop == "count" && typeof options["start_offset"] !== "undefined")
                            options["count"] = 1;
                        else options[prop] = options_default[prop];
                    }
                }
                
                function process_idx_data(buffer) {
                    var output_arr = [], view = new Uint8Array(buffer);
                    for(var i = 0, j = 0; i < view.length; i++) {
                        if(options["count"] >= 0
                           && options["count"] <= output_arr.length) break;
                        if(view[i] == 0) {
                            var idx_obj = {};
                            if(options["include_term"])
                                idx_obj["term"] = readUTF8String(view.subarray(j,i));
                            if(options["include_dictpos"])
                                idx_obj["dictpos"] = [getUintAt(view,i+1),getUintAt(view,i+5)];
                            if(options["include_offset"])
                                idx_obj["offset"] = options["start_offset"] + j;
                            output_arr.push(idx_obj);
                            i += 9; j = i;
                        }
                    }
                    return output_arr;
                }
                
                return new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function (evt) {
                        resolve(process_idx_data(evt.target.result));
                    };
                    reader.readAsArrayBuffer(
                        files["idx"].slice(options["start_offset"])
                    );
                });
            };
        }
        
        return cls;
    })();
    
    GLOBAL.StarDict = StarDict;
}(this));

